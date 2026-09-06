import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createArenaServer } from '../apps/server/src/server.ts';
import { Store } from '../apps/server/src/store.ts';
import {
  PROTOCOL_VERSION,
  type MatchSnapshot,
  type ServerMessage,
} from '../packages/core/src/protocol.ts';
import type { DigitalGameState } from '../packages/games/digital-game/state.ts';

type Client = ReturnType<typeof connectClient>;

function connectClient(port: number, sockets: WebSocket[]) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
    origin: 'http://localhost',
  });
  sockets.push(ws);
  const messages: ServerMessage[] = [];
  const waiters: {
    predicate: (message: ServerMessage) => boolean;
    resolve: (message: ServerMessage) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }[] = [];

  ws.on('message', (raw) => {
    const message = JSON.parse(raw.toString()) as ServerMessage;
    const index = waiters.findIndex((waiter) => waiter.predicate(message));
    if (index >= 0) {
      const [waiter] = waiters.splice(index, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    } else messages.push(message);
  });

  return {
    send(message: unknown) {
      ws.send(JSON.stringify(message));
    },
    async open() {
      await new Promise<void>((resolve) => ws.once('open', resolve));
    },
    next(predicate: (message: ServerMessage) => boolean): Promise<ServerMessage> {
      const index = messages.findIndex(predicate);
      if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const waiter = {
          predicate,
          resolve,
          reject,
          timer: setTimeout(() => {
            const index = waiters.indexOf(waiter);
            if (index >= 0) waiters.splice(index, 1);
            reject(new Error('WebSocket response timeout'));
          }, 5000),
        };
        waiters.push(waiter);
      });
    },
  };
}

function asMatch(message: ServerMessage): MatchSnapshot {
  assert.equal(message.type, 'match');
  if (message.type !== 'match') throw new Error('expected match message');
  return message.match;
}

function sharedSnapshot(match: MatchSnapshot) {
  const state = match.state as DigitalGameState;
  return {
    id: match.id,
    revision: match.revision,
    turn: state.turn,
    ply: state.ply,
    rackCounts: state.rackCounts,
    drawPoolCount: state.drawPool.length,
    table: state.table,
    lastAction: state.lastAction,
    emptyPoolPasses: state.emptyPoolPasses,
    clockMs: match.clockMs,
    turnStartedAt: match.turnStartedAt,
    result: match.result,
    endedAt: match.endedAt,
  };
}

function assertInventoryConsistent(state: DigitalGameState) {
  const placed = [
    ...state.racks.flat(),
    ...state.table.flatMap((meld) => meld.tiles),
    ...state.drawPool,
  ];
  const catalog = Object.keys(state.tiles);
  assert.equal(placed.length, catalog.length);
  assert.equal(new Set(placed).size, catalog.length);
  assert.ok(placed.every((id) => state.tiles[id] !== undefined));
  assert.deepEqual(state.rackCounts, state.racks.map((rack) => rack.length));
}

test('four Digital clients stay synchronized after an empty-pool timeout pass', async () => {
  const store = new Store(),
    app = createArenaServer({
      store,
      env: {},
      allowedOrigins: ['http://localhost'],
    });
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const port = (app.server.address() as { port: number }).port,
    base = `http://127.0.0.1:${port}`,
    sockets: WebSocket[] = [];

  async function guest(name: string) {
    const response = await fetch(base + '/api/auth/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    assert.equal(response.status, 201);
    return response.json() as Promise<{ token: string; profile: { id: string } }>;
  }

  try {
    const users = await Promise.all([
        guest('Alice4'),
        guest('Bob4'),
        guest('Carol4'),
        guest('Dave4'),
      ]),
      clients: Client[] = Array.from({ length: 4 }, () => connectClient(port, sockets));

    await Promise.all(clients.map((client) => client.open()));
    clients.forEach((client, index) =>
      client.send({
        type: 'auth',
        version: PROTOCOL_VERSION,
        token: users[index].token,
      }),
    );
    await Promise.all(clients.map((client) => client.next((message) => message.type === 'ready')));

    clients[0].send({
      type: 'create-room',
      gameId: 'digitalGame',
      playerCount: 4,
      turnSeconds: 30,
    });
    const room = await clients[0].next((message) => message.type === 'room');
    assert.equal(room.type, 'room');
    if (room.type !== 'room') throw new Error('expected room message');

    clients[1].send({ type: 'join-room', code: room.code });
    await clients[1].next((message) => message.type === 'room');
    clients[2].send({ type: 'join-room', code: room.code });
    await clients[2].next((message) => message.type === 'room');
    clients[3].send({ type: 'join-room', code: room.code });

    const initial = (
      await Promise.all(
        clients.map((client) =>
          client.next((message) => message.type === 'match' && message.match.revision === 0),
        ),
      )
    ).map(asMatch);
    const matchId = initial[0].id;
    assert.ok(initial.every((match) => match.id === matchId && match.revision === 0));
    assert.ok(initial.every((match) => (match.state as DigitalGameState).turn === 0));

    const stored = store.loadMatch(matchId),
      state = stored.state as DigitalGameState;
    assert.equal(state.playerCount, 4);
    assert.equal(state.turn, 0);
    assert.ok(state.drawPool.length > 0);

    // Exhaust the pool while preserving every tile in the authoritative inventory.
    state.racks[3].push(...state.drawPool);
    state.drawPool = [];
    state.rackCounts = state.racks.map((rack) => rack.length);
    const racksBefore = state.racks.map((rack) => [...rack]);
    assertInventoryConsistent(state);

    stored.turnStartedAt = Date.now() - 30001;
    store.saveMatch(stored);

    const synchronized = (
      await Promise.all(
        clients.map((client) =>
          client.next(
            (message) =>
              message.type === 'match' &&
              message.match.id === matchId &&
              message.match.revision === 1,
          ),
        ),
      )
    ).map(asMatch);

    const canonical = store.loadMatch(matchId),
      canonicalState = canonical.state as DigitalGameState;
    assert.equal(canonical.revision, 1);
    assert.equal(canonical.result, null);
    assert.equal(canonical.endedAt, null);
    assert.equal(canonicalState.turn, 1);
    assert.equal(canonicalState.ply, 1);
    assert.equal(canonicalState.lastAction, 'draw');
    assert.equal(canonicalState.emptyPoolPasses, 1);
    assert.equal(canonicalState.drawPool.length, 0);
    assert.deepEqual(canonicalState.racks, racksBefore);
    assert.deepEqual(canonical.clockMs, [30000, 30000, 30000, 30000]);
    assertInventoryConsistent(canonicalState);

    const baseline = sharedSnapshot(synchronized[0]);
    for (const match of synchronized) {
      const projected = match.state as DigitalGameState;
      assert.deepEqual(sharedSnapshot(match), baseline);
      assert.equal(match.revision, 1);
      assert.equal(projected.turn, 1);
      assert.equal(projected.ply, 1);
      assert.equal(projected.lastAction, 'draw');
      assert.equal(projected.emptyPoolPasses, 1);
      assert.equal(projected.drawPool.length, 0);
    }
    assert.deepEqual(baseline, {
      id: matchId,
      revision: canonical.revision,
      turn: canonicalState.turn,
      ply: canonicalState.ply,
      rackCounts: canonicalState.rackCounts,
      drawPoolCount: canonicalState.drawPool.length,
      table: canonicalState.table,
      lastAction: canonicalState.lastAction,
      emptyPoolPasses: canonicalState.emptyPoolPasses,
      clockMs: canonical.clockMs,
      turnStartedAt: canonical.turnStartedAt,
      result: canonical.result,
      endedAt: canonical.endedAt,
    });

    for (let clientIndex = 0; clientIndex < synchronized.length; clientIndex++) {
      const match = synchronized[clientIndex],
        projected = match.state as DigitalGameState,
        seat = match.players.findIndex((player) => player.id === users[clientIndex].profile.id);
      assert.ok(seat >= 0);
      assert.equal(projected.viewerSeat, seat);
      assert.deepEqual(projected.rackCounts, canonicalState.rackCounts);
      assert.deepEqual(projected.racks[seat], canonicalState.racks[seat]);
      assert.ok(projected.racks.every((rack, index) => rack.length === canonicalState.rackCounts[index]));
    }

    const resultRows = store.db
      .prepare('SELECT reason FROM results WHERE match_id=?')
      .all(matchId) as { reason: string }[];
    assert.deepEqual(resultRows, []);
  } finally {
    sockets.forEach((socket) => socket.terminate());
    await app.close();
    store.close();
  }
});
