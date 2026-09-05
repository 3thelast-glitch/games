import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { OfflineMatch } from '../packages/core/src/offline.ts';
import { clientMessageSchema, type MatchCommand } from '../packages/core/src/protocol.ts';
import {
  TURN_TIMER_SECONDS,
  beginTurn,
  createClocks,
  remainingTimeMs,
  turnTimeControl,
} from '../packages/core/src/timing.ts';
import { games } from '../packages/games/registry.ts';
import { Lobby } from '../apps/server/src/lobby.ts';
import { MatchService } from '../apps/server/src/matches.ts';
import { Store } from '../apps/server/src/store.ts';

function user(store: Store, name: string) {
  return store.createUser(name, 'email', `${name}-${randomUUID()}`);
}

test('shared turn timing counts down only the active seat and resets on turn advance', () => {
  const control = turnTimeControl(30),
    clocks = createClocks(control, 3);
  assert.equal(remainingTimeMs(control, clocks, 0, 0, 1000, 21000), 10000);
  assert.equal(remainingTimeMs(control, clocks, 0, 1, 1000, 21000), 30000);
  assert.deepEqual(beginTurn(control, [10000, 30000, 30000], 0, 1), [30000, 30000, 30000]);
});

for (const seconds of TURN_TIMER_SECONDS) {
  test(`Digital local ${seconds}-second timer advances the turn, then records timeout at the exact deadline`, () => {
    let now = 0;
    const durationMs = seconds * 1000,
      moveAt = Math.min(5000, durationMs - 1000),
      match = new OfflineMatch(
        games.get('digitalGame'),
        'local',
        () => now,
        3,
        turnTimeControl(seconds),
      );

    now = moveAt;
    match.move({ type: 'draw' });
    assert.equal(match.current.state.turn, 1);
    assert.deepEqual(match.current.clocks, [durationMs, durationMs, durationMs]);
    assert.equal(match.current.turnStartedAt, moveAt);

    now = moveAt + durationMs - 1;
    assert.equal(match.tick().result, null);
    assert.equal(match.current.state.turn, 1);

    now = moveAt + durationMs;
    const finished = match.tick();
    assert.equal(finished.result?.reason, 'timeout');
    assert.notEqual(finished.result?.winner, 1);
    assert.equal(finished.endedAt, now);
  });
}

for (const seconds of TURN_TIMER_SECONDS) {
  test(`authoritative Digital ${seconds}-second timer advances the turn and persists timeout`, () => {
    let now = 0;
    const durationMs = seconds * 1000,
      moveAt = Math.min(5000, durationMs - 1000),
      store = new Store(),
      service = new MatchService(store, games, { now: () => now }),
      a = user(store, `A-${seconds}`),
      b = user(store, `B-${seconds}`),
      c = user(store, `C-${seconds}`);
    try {
      let match = service.create(
        'digitalGame',
        [a.id, b.id, c.id],
        false,
        turnTimeControl(seconds),
      );
      assert.deepEqual(match.timeControl, turnTimeControl(seconds));
      assert.deepEqual(match.clockMs, [durationMs, durationMs, durationMs]);

      now = moveAt;
      match = service.command(a.id, {
        type: 'move',
        matchId: match.id,
        commandId: randomUUID(),
        expectedRevision: match.revision,
        move: { type: 'draw' },
      } as MatchCommand);
      assert.equal(match.state.turn, 1);
      assert.deepEqual(match.clockMs, [durationMs, durationMs, durationMs]);
      assert.equal(match.turnStartedAt, moveAt);

      now = moveAt + durationMs - 1;
      const beforeDeadline = service.get(match.id, b.id);
      assert.equal(beforeDeadline.result, null);
      assert.equal(beforeDeadline.state.turn, 1);

      now = moveAt + durationMs;
      const finished = service.get(match.id, b.id);
      assert.equal(finished.result?.reason, 'timeout');
      assert.notEqual(finished.result?.winner, 1);
      assert.equal(finished.endedAt, now);

      const stored = store.loadMatch(match.id);
      assert.equal(stored.result?.reason, 'timeout');
      assert.equal(stored.endedAt, now);

      const rows = store.db
        .prepare('SELECT reason,ended_at FROM results WHERE match_id=? ORDER BY user_id')
        .all(match.id) as { reason: string; ended_at: number }[];
      assert.equal(rows.length, 3);
      assert.ok(rows.every((row) => row.reason === 'timeout' && row.ended_at === now));
    } finally {
      store.close();
    }
  });
}

test('Digital matchmaking isolates timer choices and private rooms preserve them', () => {
  const store = new Store(),
    service = new MatchService(store, games),
    lobby = new Lobby(service);
  try {
    const a = user(store, 'A'),
      b = user(store, 'B'),
      c = user(store, 'C'),
      d = user(store, 'D'),
      e = user(store, 'E');
    assert.equal(lobby.enqueue(a.id, 'digitalGame', false, 2, 30), null);
    assert.equal(lobby.enqueue(b.id, 'digitalGame', false, 2, 45), null);
    const quick = lobby.enqueue(c.id, 'digitalGame', false, 2, 30);
    assert.ok(quick);
    assert.deepEqual(quick!.timeControl, turnTimeControl(30));
    assert.equal(lobby.queue.length, 1);

    const room = lobby.createRoom(d.id, 'digitalGame', 2, 90);
    assert.equal(room.turnSeconds, 90);
    const privateMatch = lobby.joinRoomResult(e.id, room.code).match;
    assert.ok(privateMatch);
    assert.deepEqual(privateMatch!.timeControl, turnTimeControl(90));
  } finally {
    store.close();
  }
});

test('protocol accepts only 30/45/60/90 seconds and classic games reject turn clocks', () => {
  const parsed = clientMessageSchema.parse({
    type: 'queue',
    gameId: 'digitalGame',
    ranked: false,
    playerCount: 4,
    turnSeconds: 60,
  });
  assert.equal(parsed.type, 'queue');
  assert.equal('turnSeconds' in parsed ? parsed.turnSeconds : undefined, 60);
  assert.throws(() =>
    clientMessageSchema.parse({
      type: 'queue',
      gameId: 'digitalGame',
      ranked: false,
      playerCount: 4,
      turnSeconds: 15,
    }),
  );
  const store = new Store(),
    service = new MatchService(store, games),
    lobby = new Lobby(service),
    a = user(store, 'A');
  try {
    assert.throws(() => lobby.createRoom(a.id, 'quoridor', 2, 30), /turn-timer-not-supported/);
  } finally {
    store.close();
  }
});
