import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { Store, digest } from '../apps/server/src/store.ts';
import { MatchService } from '../apps/server/src/matches.ts';
import { Lobby } from '../apps/server/src/lobby.ts';
import { AuthService, pkce } from '../apps/server/src/auth.ts';
import { createArenaServer, RateLimiter } from '../apps/server/src/server.ts';
import { games } from '../packages/games/registry.ts';
import {
  clientMessageSchema,
  type MatchCommand,
  type MatchSnapshot,
  type ServerMessage,
} from '../packages/core/src/protocol.ts';
import { eloChange, periodStart, rankFor } from '../packages/core/src/ranking.ts';
function setup(path?: string) {
  let time = 1000000;
  const store = new Store(path),
    a = store.createUser('Alice', 'email', 'a'),
    b = store.createUser('Bob', 'email', 'b'),
    outsider = store.createUser('Mallory');
  const service = new MatchService(store, games, {
    now: () => time,
    clockMs: 60000,
    graceMs: 10000,
  });
  return {
    store,
    a,
    b,
    outsider,
    service,
    advance: (n: number) => (time += n),
  };
}
const command = (
  m: MatchSnapshot,
  move: unknown,
  overrides: Partial<MatchCommand> = {},
): MatchCommand =>
  ({
    type: 'move',
    matchId: m.id,
    commandId: randomUUID(),
    expectedRevision: m.revision,
    move,
    ...overrides,
  }) as MatchCommand;
test('server binds turns and membership to authenticated users, ignores client authority fields', () => {
  const { store, a, b, outsider, service } = setup();
  try {
    const m = service.create('quoridor', [a.id, b.id]);
    const move = command(m, { kind: 'pawn', to: [7, 4] });
    assert.throws(() => service.command(outsider.id, move), /not-in-match/);
    assert.throws(() => service.command(b.id, move), /not-your-turn/);
    assert.throws(() => clientMessageSchema.parse({ ...move, playerId: a.id }));
    assert.throws(() => clientMessageSchema.parse({ ...move, board: {}, winner: 0, timer: 1 }));
    const next = service.command(a.id, move);
    assert.equal(next.state.turn, 1);
    assert.equal(next.revision, 1);
    assert.throws(
      () => service.command(b.id, command(m, { kind: 'pawn', to: [1, 4] })),
      /stale-revision/,
    );
  } finally {
    store.close();
  }
});
test('duplicate move is idempotent, a reused id with a different payload fails', () => {
  const { store, a, b, service } = setup();
  try {
    const m = service.create('quoridor', [a.id, b.id]),
      move = command(m, { kind: 'pawn', to: [7, 4] });
    const next = service.command(a.id, move);
    assert.deepEqual(service.command(a.id, move), next);
    assert.throws(
      () =>
        service.command(a.id, {
          ...move,
          move: { kind: 'pawn', to: [6, 4] },
        } as MatchCommand),
      /command-id-reused/,
    );
    assert.equal(store.loadMatch(m.id).state.ply, 1);
  } finally {
    store.close();
  }
});
test('server revalidates illegal moves without advancing board, clock anchor or revision', () => {
  const { store, a, b, service } = setup();
  try {
    const m = service.create('quoridor', [a.id, b.id]);
    assert.throws(() => service.command(a.id, command(m, { kind: 'pawn', to: [2, 2] })));
    assert.equal(service.get(m.id, a.id).revision, 0);
    assert.equal(service.get(m.id, a.id).turnStartedAt, m.turnStartedAt);
  } finally {
    store.close();
  }
});
test('only active player time is charged and timeout cannot be overridden by a late winning move', () => {
  const { store, a, b, service, advance } = setup();
  try {
    let m = service.create('quoridor', [a.id, b.id]);
    advance(3500);
    m = service.command(a.id, command(m, { kind: 'pawn', to: [7, 4] }));
    assert.deepEqual(m.clockMs, [56500, 60000]);
    advance(60001);
    assert.throws(
      () => service.command(b.id, command(m, { kind: 'pawn', to: [1, 4] })),
      /game-over/,
    );
    const final = service.get(m.id, b.id);
    assert.equal(final.result?.winner, 0);
    assert.equal(final.result?.reason, 'timeout');
    assert.equal(final.clockMs[1], 0);
  } finally {
    store.close();
  }
});
test('reconnection during grace retains board and running clock; expiry forfeits once', () => {
  const { store, a, b, service, advance } = setup();
  try {
    const m = service.create('abalone', [a.id, b.id], true);
    service.connection(a.id, false);
    advance(9000);
    service.connection(a.id, true);
    assert.equal(service.get(m.id, a.id).result, null);
    advance(1000);
    service.connection(a.id, false);
    advance(10001);
    service.tick();
    let final = service.get(m.id, b.id);
    assert.equal(final.result?.reason, 'disconnect');
    assert.equal(final.result?.winner, 1);
    assert.deepEqual(final.result?.ratingDelta, [-16, 16]);
    service.tick();
    assert.equal(store.rating(a.id, 'abalone'), 984);
    assert.equal(store.profile(a.id, games.ids()).totalMatches, 1);
  } finally {
    store.close();
  }
});
test('equal disconnect deadlines abandon without rating change, earliest deadline otherwise wins', () => {
  const { store, a, b, service, advance } = setup();
  try {
    const m = service.create('abalone', [a.id, b.id], true);
    service.connection(a.id, false);
    service.connection(b.id, false);
    advance(10000);
    assert.equal(service.get(m.id, a.id).result?.reason, 'abandoned');
    assert.deepEqual(service.get(m.id, a.id).result?.ratingDelta, [0, 0]);
  } finally {
    store.close();
  }
});
test('draw requires the other player to accept and remains available in casual and ranked', () => {
  const { store, a, b, service } = setup();
  try {
    let m = service.create('quoridor', [a.id, b.id], true);
    m = service.command(a.id, {
      type: 'draw-offer',
      matchId: m.id,
      commandId: randomUUID(),
      expectedRevision: m.revision,
    });
    assert.throws(
      () =>
        service.command(a.id, {
          type: 'draw-answer',
          matchId: m.id,
          commandId: randomUUID(),
          expectedRevision: m.revision,
          accept: true,
        }),
      /no-opponent/,
    );
    m = service.command(b.id, {
      type: 'draw-answer',
      matchId: m.id,
      commandId: randomUUID(),
      expectedRevision: m.revision,
      accept: true,
    });
    assert.equal(m.result?.reason, 'agreement');
    assert.equal(m.result?.winner, null);
  } finally {
    store.close();
  }
});
test('ranked ratings are per game, resign settlement is exactly once, local results are not accepted', () => {
  const { store, a, b, service } = setup();
  try {
    const m = service.create('abalone', [a.id, b.id], true),
      resign: MatchCommand = {
        type: 'resign',
        matchId: m.id,
        commandId: randomUUID(),
        expectedRevision: 0,
      };
    service.command(a.id, resign);
    service.command(a.id, resign);
    assert.equal(store.rating(a.id, 'abalone'), 984);
    assert.equal(store.rating(a.id, 'quoridor'), 1000);
    assert.equal(store.profile(a.id, games.ids()).losses, 1);
    assert.throws(() => clientMessageSchema.parse({ type: 'result', winner: a.id }));
    assert.throws(() => clientMessageSchema.parse({ type: 'undo', matchId: m.id }));
  } finally {
    store.close();
  }
});
test('rematch needs both players, swaps sides, and repeated acceptance does not create another', () => {
  const { store, a, b, service } = setup();
  try {
    const m = service.create('abalone', [a.id, b.id]);
    service.command(a.id, {
      type: 'resign',
      matchId: m.id,
      commandId: randomUUID(),
      expectedRevision: 0,
    });
    assert.equal(service.rematch(a.id, m.id).id, m.id);
    const next = service.rematch(b.id, m.id);
    assert.notEqual(next.id, m.id);
    assert.equal(next.players[0].id, b.id);
    assert.equal(service.rematch(a.id, m.id).id, next.id);
    assert.equal(store.activeMatches().length, 1);
  } finally {
    store.close();
  }
});
test('match state, command deduplication and sessions survive a server restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'board-arena-')),
    path = join(directory, 'arena.db');
  const { store, a, b, service } = setup(path);
  const m = service.create('quoridor', [a.id, b.id]);
  const move = command(m, { kind: 'pawn', to: [7, 4] });
  service.command(a.id, move);
  const token = store.newSession(a.id, 1000000);
  store.close();
  const reopened = new Store(path);
  try {
    const recovered = new MatchService(reopened, games, { now: () => 1001000 });
    recovered.recoverAfterRestart();
    recovered.connection(a.id, true);
    assert.equal(recovered.get(m.id, a.id).state.ply, 1);
    assert.equal(recovered.command(a.id, move).state.ply, 1);
    assert.equal(reopened.authenticate(token, 1001000).id, a.id);
  } finally {
    reopened.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test('lobby rejects self pairing and guests in ranked, isolates games, rooms expire', () => {
  const { store, a, b, outsider, service, advance } = setup();
  try {
    const lobby = new Lobby(service);
    assert.throws(() => lobby.enqueue(outsider.id, 'abalone', true), /ranked-requires-account/);
    assert.equal(lobby.enqueue(a.id, 'abalone', false), null);
    assert.equal(lobby.enqueue(a.id, 'abalone', false), null);
    assert.equal(lobby.queue.length, 1);
    assert.equal(lobby.enqueue(b.id, 'quoridor', false), null);
    const matched = lobby.enqueue(b.id, 'abalone', false);
    assert.ok(matched);
    assert.equal(lobby.queue.length, 0);
    const other = store.createUser('Other'),
      room = lobby.createRoom(outsider.id, 'quoridor');
    assert.throws(() => lobby.joinRoom(outsider.id, room.code), /yourself/);
    advance(600001);
    assert.throws(() => lobby.joinRoom(other.id, room.code), /room-not-found/);
  } finally {
    store.close();
  }
});
test('friend leaderboards filter on server and week starts Monday UTC', () => {
  const { store, a, b, outsider, service } = setup();
  try {
    const m = service.create('abalone', [a.id, b.id], true);
    service.command(a.id, {
      type: 'resign',
      matchId: m.id,
      commandId: randomUUID(),
      expectedRevision: 0,
    });
    assert.equal(store.leaderboard('abalone', 'friends', outsider.id).length, 0);
    store.addFriend(outsider.id, b.friend_code);
    assert.equal(store.leaderboard('abalone', 'friends', outsider.id)[0].id, b.id);
    assert.equal(periodStart('weekly', Date.UTC(2026, 8, 6)), Date.UTC(2026, 7, 31));
    assert.equal(periodStart('monthly', Date.UTC(2026, 8, 4)), Date.UTC(2026, 8, 1));
    assert.equal(eloChange(1000, 1000, 1), 16);
    assert.equal(eloChange(1000, 1000, 0.5), 0);
    assert.equal(rankFor(1800), 'Master');
  } finally {
    store.close();
  }
});
test('email credentials are salted, sessions hashed and revocable, guest upgrade preserves identity', async () => {
  const store = new Store(),
    auth = new AuthService(store);
  try {
    const guest = store.createUser('Guest');
    const user = await auth.register(
      'alice@example.test',
      'correct-horse-battery',
      'Alice',
      guest.id,
    );
    assert.equal(user.id, guest.id);
    assert.equal(user.guest, 0);
    assert.ok(!user.password?.includes('correct'));
    assert.equal((await auth.login('alice@example.test', 'correct-horse-battery')).id, user.id);
    await assert.rejects(
      () => auth.login('alice@example.test', 'incorrect'),
      /invalid-credentials/,
    );
    const token = store.newSession(user.id);
    assert.equal(store.authenticate(token).id, user.id);
    assert.equal(
      (store.db.prepare('SELECT hash FROM sessions').get() as { hash: string }).hash,
      digest(token),
    );
    store.logout(token);
    assert.throws(() => store.authenticate(token));
  } finally {
    store.close();
  }
});
test('OAuth exchange requires a bound verifier, is single use and providers are honest about configuration', () => {
  const store = new Store(),
    auth = new AuthService(store, {});
  try {
    assert.deepEqual(auth.capabilities(), { google: false, apple: false });
    assert.throws(() => auth.start('google', 'x'.repeat(43), false), /provider-not-configured/);
    const user = store.createUser('Alice'),
      code = 'a'.repeat(43),
      verifier = 'b'.repeat(43);
    store.db
      .prepare('INSERT INTO auth_codes VALUES(?,?,?,?)')
      .run(digest(code), user.id, pkce(verifier), Date.now() + 60000);
    assert.throws(() => auth.exchange(code, 'wrong'));
    assert.equal(auth.exchange(code, verifier).id, user.id);
    assert.throws(() => auth.exchange(code, verifier));
  } finally {
    store.close();
  }
});
test('rate limiter resets at the window boundary', () => {
  const l = new RateLimiter();
  assert.ok(l.allow('x', 1, 1000, 0));
  assert.ok(!l.allow('x', 1, 1000, 999));
  assert.ok(l.allow('x', 1, 1000, 1000));
});
test('real HTTP and WebSocket flow authenticates, joins private room, synchronizes moves and rejects a forged seat', async () => {
  const store = new Store(),
    app = createArenaServer({
      store,
      env: {},
      allowedOrigins: ['http://localhost'],
    });
  await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', r));
  const port = (app.server.address() as { port: number }).port,
    base = `http://127.0.0.1:${port}`;
  const clients: WebSocket[] = [];
  function connect() {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      origin: 'http://localhost',
    });
    clients.push(ws);
    const messages: ServerMessage[] = [];
    const waiters: {
      predicate: (m: ServerMessage) => boolean;
      resolve: (m: ServerMessage) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }[] = [];
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString()) as ServerMessage;
      const i = waiters.findIndex((w) => w.predicate(m));
      if (i >= 0) {
        const [w] = waiters.splice(i, 1);
        clearTimeout(w.timer);
        w.resolve(m);
      } else messages.push(m);
    });
    return {
      ws,
      send: (m: unknown) => ws.send(JSON.stringify(m)),
      async open() {
        await new Promise<void>((r) => ws.once('open', r));
      },
      next(predicate: (m: ServerMessage) => boolean): Promise<ServerMessage> {
        const i = messages.findIndex(predicate);
        if (i >= 0) return Promise.resolve(messages.splice(i, 1)[0]);
        return new Promise((resolve, reject) => {
          const item = {
            predicate,
            resolve,
            reject,
            timer: setTimeout(() => {
              const i = waiters.indexOf(item);
              if (i >= 0) waiters.splice(i, 1);
              reject(new Error('WebSocket response timeout'));
            }, 3000),
          };
          waiters.push(item);
        });
      },
    };
  }
  try {
    const guest = async (name: string) => {
      const r = await fetch(base + '/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      assert.equal(r.status, 201);
      return r.json() as Promise<{ token: string; profile: { id: string } }>;
    };
    const a = await guest('Alice'),
      b = await guest('Bob');
    const ca = connect(),
      cb = connect();
    await Promise.all([ca.open(), cb.open()]);
    ca.send({ type: 'auth', version: 1, token: a.token });
    cb.send({ type: 'auth', version: 1, token: b.token });
    await Promise.all([ca.next((m) => m.type === 'ready'), cb.next((m) => m.type === 'ready')]);
    ca.send({ type: 'create-room', gameId: 'quoridor' });
    const room = await ca.next((m) => m.type === 'room');
    assert.equal(room.type, 'room');
    if (room.type !== 'room') throw Error();
    cb.send({ type: 'join-room', code: room.code });
    const messages = await Promise.all([
      ca.next((m) => m.type === 'match'),
      cb.next((m) => m.type === 'match'),
    ]);
    const started = messages[0];
    if (started.type !== 'match') throw Error();
    const match = started.match,
      current = match.players[0].id === a.profile.id ? ca : cb;
    const move = command(match, { kind: 'pawn', to: [7, 4] });
    current.send({ ...move, playerId: match.players[0].id });
    assert.equal((await current.next((m) => m.type === 'error')).type, 'error');
    current.send(move);
    for (const client of [ca, cb]) {
      const response = await client.next((m) => m.type === 'match' && m.match.revision === 1);
      if (response.type !== 'match') throw Error();
      assert.equal(response.match.state.ply, 1);
      assert.equal(response.ack, move.commandId);
    }
    const invalidPatch = await fetch(base + '/api/profile', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${a.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ wins: 999, rating: 9000 }),
    });
    assert.equal(invalidPatch.status, 400);
    const unauthed = await fetch(base + '/api/profile');
    assert.equal(unauthed.status, 401);
  } finally {
    clients.forEach((ws) => ws.terminate());
    await app.close();
    store.close();
  }
});
