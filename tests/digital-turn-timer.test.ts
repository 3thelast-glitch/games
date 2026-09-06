import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { OfflineMatch } from '../packages/core/src/offline.ts';
import { clientMessageSchema } from '../packages/core/src/protocol.ts';
import {
  TURN_TIMER_SECONDS,
  bankTimeControl,
  beginTurn,
  createClocks,
  remainingTimeMs,
  turnTimeControl,
} from '../packages/core/src/timing.ts';
import { games } from '../packages/games/registry.ts';
import type { DigitalGameState } from '../packages/games/digital-game/state.ts';
import { Lobby } from '../apps/server/src/lobby.ts';
import { MatchService } from '../apps/server/src/matches.ts';
import { Store } from '../apps/server/src/store.ts';

function user(store: Store, name: string) {
  return store.createUser(name, 'email', `${name}-${randomUUID()}`);
}

function exhaustDrawPool(state: DigitalGameState, targetSeat = state.playerCount - 1) {
  state.racks[targetSeat].push(...state.drawPool);
  state.drawPool = [];
  state.rackCounts = state.racks.map((rack) => rack.length);
}

function assertDigitalInventoryConsistent(state: DigitalGameState) {
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

const nextSeat = (seat: number, count: number, steps = 1) => (seat + steps) % count;

test('shared turn timing counts down only the active seat and resets on turn advance', () => {
  const control = turnTimeControl(30),
    clocks = createClocks(control, 3);
  assert.equal(remainingTimeMs(control, clocks, 0, 0, 1000, 21000), 10000);
  assert.equal(remainingTimeMs(control, clocks, 0, 1, 1000, 21000), 30000);
  assert.deepEqual(beginTurn(control, [10000, 30000, 30000], 0, 1), [30000, 30000, 30000]);
});

for (const seconds of TURN_TIMER_SECONDS) {
  test(`Digital local ${seconds}-second timeout automatically draws one tile and advances the turn`, () => {
    let now = 0;
    const durationMs = seconds * 1000,
      match = new OfflineMatch(
        games.get('digitalGame'),
        'local',
        () => now,
        3,
        turnTimeControl(seconds),
      ),
      initial = match.current.state as DigitalGameState,
      initialPool = initial.drawPool.length,
      startingSeat = initial.turn,
      secondSeat = nextSeat(startingSeat, 3),
      thirdSeat = nextSeat(startingSeat, 3, 2);

    assert.equal(initial.startingSeat, startingSeat);
    now = durationMs - 1;
    assert.equal(match.tick().result, null);
    assert.equal(match.current.state.turn, startingSeat);
    assert.equal((match.current.state as DigitalGameState).rackCounts[startingSeat], 14);

    now = durationMs;
    const afterFirst = match.tick(),
      firstState = afterFirst.state as DigitalGameState;
    assert.equal(afterFirst.result, null);
    assert.equal(firstState.turn, secondSeat);
    assert.equal(firstState.ply, 1);
    assert.equal(firstState.rackCounts[startingSeat], 15);
    assert.equal(firstState.rackCounts[secondSeat], 14);
    assert.equal(firstState.drawPool.length, initialPool - 1);
    assert.equal(firstState.lastAction, 'draw');
    assert.equal(afterFirst.turnStartedAt, durationMs);
    assert.deepEqual(afterFirst.clocks, [durationMs, durationMs, durationMs]);

    now = durationMs * 2;
    const afterSecond = match.tick(),
      secondState = afterSecond.state as DigitalGameState;
    assert.equal(afterSecond.result, null);
    assert.equal(secondState.turn, thirdSeat);
    assert.equal(secondState.ply, 2);
    assert.equal(secondState.rackCounts[secondSeat], 15);
    assert.equal(secondState.drawPool.length, initialPool - 2);
    assert.equal(afterSecond.turnStartedAt, durationMs * 2);
  });
}

for (const seconds of TURN_TIMER_SECONDS) {
  test(`Digital local ${seconds}-second timeout with an empty pool records an empty draw pass and advances consistently`, () => {
    let now = 0;
    const durationMs = seconds * 1000,
      match = new OfflineMatch(
        games.get('digitalGame'),
        'local',
        () => now,
        3,
        turnTimeControl(seconds),
      ),
      initial = match.current.state as DigitalGameState,
      startingSeat = initial.turn,
      next = nextSeat(startingSeat, 3);

    exhaustDrawPool(initial);
    const racksBefore = initial.racks.map((rack) => [...rack]);
    assert.equal(initial.drawPool.length, 0);
    assert.equal(initial.emptyPoolPasses, 0);
    assertDigitalInventoryConsistent(initial);

    now = durationMs - 1;
    assert.equal(match.tick().result, null);
    assert.equal(match.current.state.turn, startingSeat);

    now = durationMs;
    const after = match.tick(),
      state = after.state as DigitalGameState;
    assert.equal(after.result, null);
    assert.equal(after.endedAt, null);
    assert.equal(state.turn, next);
    assert.equal(state.ply, 1);
    assert.equal(state.lastAction, 'draw');
    assert.equal(state.emptyPoolPasses, 1);
    assert.equal(state.drawPool.length, 0);
    assert.deepEqual(state.racks, racksBefore);
    assert.deepEqual(after.clocks, [durationMs, durationMs, durationMs]);
    assert.equal(after.turnStartedAt, durationMs);
    assertDigitalInventoryConsistent(state);
  });
}

for (const seconds of TURN_TIMER_SECONDS) {
  test(`authoritative Digital ${seconds}-second timeout auto-draws, advances revision, and keeps match active`, () => {
    let now = 0;
    const durationMs = seconds * 1000,
      store = new Store(),
      service = new MatchService(store, games, { now: () => now }),
      a = user(store, `A-${seconds}`),
      b = user(store, `B-${seconds}`),
      c = user(store, `C-${seconds}`);
    try {
      const match = service.create(
          'digitalGame',
          [a.id, b.id, c.id],
          false,
          turnTimeControl(seconds),
        ),
        initialState = match.state as DigitalGameState,
        initialPool = initialState.drawPool.length,
        startingSeat = initialState.turn,
        secondSeat = nextSeat(startingSeat, 3),
        thirdSeat = nextSeat(startingSeat, 3, 2);
      assert.deepEqual(match.timeControl, turnTimeControl(seconds));
      assert.deepEqual(match.clockMs, [durationMs, durationMs, durationMs]);

      now = durationMs - 1;
      const beforeDeadline = service.get(match.id, a.id);
      assert.equal(beforeDeadline.result, null);
      assert.equal(beforeDeadline.state.turn, startingSeat);
      assert.equal(beforeDeadline.revision, 0);

      now = durationMs;
      const afterFirst = service.get(match.id, a.id),
        firstState = afterFirst.state as DigitalGameState;
      assert.equal(afterFirst.result, null);
      assert.equal(afterFirst.endedAt, null);
      assert.equal(afterFirst.revision, 1);
      assert.equal(firstState.turn, secondSeat);
      assert.equal(firstState.ply, 1);
      assert.equal(firstState.rackCounts[startingSeat], 15);
      assert.equal(firstState.drawPool.length, initialPool - 1);
      assert.equal(firstState.lastAction, 'draw');
      assert.equal(afterFirst.turnStartedAt, durationMs);
      assert.deepEqual(afterFirst.clockMs, [durationMs, durationMs, durationMs]);

      const storedAfterFirst = store.loadMatch(match.id);
      assert.equal(storedAfterFirst.result, null);
      assert.equal(storedAfterFirst.revision, 1);
      assert.equal((storedAfterFirst.state as DigitalGameState).rackCounts[startingSeat], 15);
      const rowsAfterFirst = store.db
        .prepare('SELECT reason FROM results WHERE match_id=?')
        .all(match.id) as { reason: string }[];
      assert.equal(rowsAfterFirst.length, 0);

      now = durationMs * 2;
      const afterSecond = service.get(match.id, b.id),
        secondState = afterSecond.state as DigitalGameState;
      assert.equal(afterSecond.result, null);
      assert.equal(afterSecond.revision, 2);
      assert.equal(secondState.turn, thirdSeat);
      assert.equal(secondState.ply, 2);
      assert.equal(secondState.rackCounts[secondSeat], 15);
      assert.equal(secondState.drawPool.length, initialPool - 2);
      assert.equal(afterSecond.turnStartedAt, durationMs * 2);
    } finally {
      store.close();
    }
  });
}

for (const seconds of TURN_TIMER_SECONDS) {
  test(`authoritative Digital ${seconds}-second timeout with an empty pool persists the empty-pass event without a timeout result`, () => {
    let now = 0;
    const durationMs = seconds * 1000,
      store = new Store(),
      service = new MatchService(store, games, { now: () => now }),
      a = user(store, `EA-${seconds}`),
      b = user(store, `EB-${seconds}`),
      c = user(store, `EC-${seconds}`);
    try {
      const match = service.create(
        'digitalGame',
        [a.id, b.id, c.id],
        false,
        turnTimeControl(seconds),
      );
      const stored = store.loadMatch(match.id),
        initial = stored.state as DigitalGameState,
        startingSeat = initial.turn,
        next = nextSeat(startingSeat, 3);
      exhaustDrawPool(initial);
      const racksBefore = initial.racks.map((rack) => [...rack]);
      assertDigitalInventoryConsistent(initial);
      store.saveMatch(stored);

      now = durationMs - 1;
      const beforeDeadline = service.get(match.id, a.id);
      assert.equal(beforeDeadline.result, null);
      assert.equal(beforeDeadline.revision, 0);
      assert.equal(beforeDeadline.state.turn, startingSeat);

      now = durationMs;
      const after = service.get(match.id, a.id),
        projectedState = after.state as DigitalGameState;
      assert.equal(after.result, null);
      assert.equal(after.endedAt, null);
      assert.equal(after.revision, 1);
      assert.equal(projectedState.turn, next);
      assert.equal(projectedState.ply, 1);
      assert.equal(projectedState.lastAction, 'draw');
      assert.equal(projectedState.emptyPoolPasses, 1);
      assert.equal(projectedState.drawPool.length, 0);
      assert.deepEqual(after.clockMs, [durationMs, durationMs, durationMs]);
      assert.equal(after.turnStartedAt, durationMs);

      const storedAfter = store.loadMatch(match.id),
        authoritativeState = storedAfter.state as DigitalGameState;
      assert.equal(storedAfter.result, null);
      assert.equal(storedAfter.revision, 1);
      assert.equal(authoritativeState.lastAction, 'draw');
      assert.equal(authoritativeState.emptyPoolPasses, 1);
      assert.equal(authoritativeState.drawPool.length, 0);
      assert.deepEqual(authoritativeState.racks, racksBefore);
      assertDigitalInventoryConsistent(authoritativeState);

      const resultRows = store.db
        .prepare('SELECT reason FROM results WHERE match_id=?')
        .all(match.id) as { reason: string }[];
      assert.deepEqual(resultRows, []);
    } finally {
      store.close();
    }
  });
}

test('games without an automatic timeout move still end with timeout', () => {
  let now = 0;
  const match = new OfflineMatch(
    games.get('quoridor'),
    'local',
    () => now,
    2,
    bankTimeControl(1000),
  );
  now = 999;
  assert.equal(match.tick().result, null);
  now = 1000;
  assert.equal(match.tick().result?.reason, 'timeout');
});

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
