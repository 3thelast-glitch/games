import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { OfflineMatch } from '../packages/core/src/offline.ts';
import { clientMessageSchema } from '../packages/core/src/protocol.ts';
import {
  CLASSIC_DIGITAL_TURN_MS,
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

test('shared turn timing still supports generic turn clocks', () => {
  const control = turnTimeControl(30),
    clocks = createClocks(control, 3);
  assert.equal(remainingTimeMs(control, clocks, 0, 0, 1000, 21000), 10000);
  assert.equal(remainingTimeMs(control, clocks, 0, 1, 1000, 21000), 30000);
  assert.deepEqual(beginTurn(control, [10000, 30000, 30000], 0, 1), [30000, 30000, 30000]);
});

test('Digital Classic offline always normalizes requested turn clocks to 60 seconds', () => {
  for (const requested of [30, 45, 60, 90] as const) {
    const match = new OfflineMatch(
      games.get('digitalGame'),
      'local',
      () => 0,
      3,
      turnTimeControl(requested),
    );
    assert.deepEqual(match.current.timeControl, turnTimeControl(60));
    assert.deepEqual(match.current.clocks, [60000, 60000, 60000]);
  }
});

test('Digital Classic 60-second timeout rolls back the uncommitted turn to the authoritative table and rack', () => {
  let now = 0;
  const match = new OfflineMatch(
      games.get('digitalGame'),
      'local',
      () => now,
      3,
      turnTimeControl(30),
    ),
    initial = match.current.state as DigitalGameState,
    startingSeat = initial.turn,
    next = nextSeat(startingSeat, 3),
    poolBefore = [...initial.drawPool],
    tableBefore = initial.table.map((meld) => ({ ...meld, tiles: [...meld.tiles] })),
    rackBefore = [...initial.racks[startingSeat]];

  // UI manipulation is transactional and has not been committed to this state.
  // At 59.999s the canonical state is untouched.
  now = CLASSIC_DIGITAL_TURN_MS - 1;
  match.tick();
  assert.equal(match.current.state.turn, startingSeat);
  assert.equal(match.current.state.ply, 0);

  now = CLASSIC_DIGITAL_TURN_MS;
  const after = match.tick(),
    state = after.state as DigitalGameState;

  assert.equal(after.result, null);
  assert.equal(state.turn, next);
  assert.equal(state.ply, 1);
  assert.equal(state.lastAction, 'timeout');
  assert.deepEqual(state.table, tableBefore);
  assert.deepEqual(state.racks[startingSeat].slice(0, rackBefore.length), rackBefore);
  assert.equal(state.racks[startingSeat].length, rackBefore.length + 1);
  assert.equal(state.racks[startingSeat].at(-1), poolBefore.at(-1));
  assert.equal(state.drawPool.length, poolBefore.length - 1);
  assert.equal(after.turnStartedAt, CLASSIC_DIGITAL_TURN_MS);
  assert.deepEqual(after.clocks, [60000, 60000, 60000]);
  assertDigitalInventoryConsistent(state);
});

test('Digital Classic timeout with an empty pool performs a complete rollback without changing any rack or table tile', () => {
  let now = 0;
  const match = new OfflineMatch(
      games.get('digitalGame'),
      'local',
      () => now,
      3,
      turnTimeControl(90),
    ),
    initial = match.current.state as DigitalGameState,
    startingSeat = initial.turn,
    next = nextSeat(startingSeat, 3);

  exhaustDrawPool(initial);
  const tableBefore = initial.table.map((meld) => ({ ...meld, tiles: [...meld.tiles] })),
    racksBefore = initial.racks.map((rack) => [...rack]);

  now = CLASSIC_DIGITAL_TURN_MS;
  const after = match.tick(),
    state = after.state as DigitalGameState;

  assert.equal(after.result, null);
  assert.equal(state.turn, next);
  assert.equal(state.ply, 1);
  assert.equal(state.lastAction, 'timeout');
  assert.deepEqual(state.table, tableBefore);
  assert.deepEqual(state.racks, racksBefore);
  assert.equal(state.drawPool.length, 0);
  assert.equal(after.turnStartedAt, CLASSIC_DIGITAL_TURN_MS);
  assertDigitalInventoryConsistent(state);
});

test('authoritative Digital 60-second timeout persists rollback, advances revision, and rejects a late stale move', () => {
  let now = 0;
  const store = new Store(),
    service = new MatchService(store, games, { now: () => now }),
    a = user(store, 'A'),
    b = user(store, 'B'),
    c = user(store, 'C');
  try {
    const match = service.create('digitalGame', [a.id, b.id, c.id], false, turnTimeControl(60)),
      storedInitial = store.loadMatch(match.id),
      initial = storedInitial.state as DigitalGameState,
      startingSeat = initial.turn,
      tableBefore = initial.table.map((meld) => ({ ...meld, tiles: [...meld.tiles] })),
      rackBefore = [...initial.racks[startingSeat]],
      poolBefore = initial.drawPool.length;

    now = CLASSIC_DIGITAL_TURN_MS;
    const after = service.get(match.id, a.id),
      state = store.loadMatch(match.id).state as DigitalGameState;

    assert.equal(after.result, null);
    assert.equal(after.revision, 1);
    assert.equal(state.turn, nextSeat(startingSeat, 3));
    assert.equal(state.ply, 1);
    assert.equal(state.lastAction, 'timeout');
    assert.deepEqual(state.table, tableBefore);
    assert.deepEqual(state.racks[startingSeat].slice(0, rackBefore.length), rackBefore);
    assert.equal(state.drawPool.length, poolBefore - 1);

    const startingUser = [a, b, c][startingSeat];
    assert.throws(
      () =>
        service.command(startingUser.id, {
          type: 'move',
          matchId: match.id,
          commandId: randomUUID(),
          expectedRevision: 0,
          move: { type: 'draw' },
        }),
      /stale-revision/,
    );
  } finally {
    store.close();
  }
});

test('Digital matchmaking canonicalizes legacy 30/45/90 requests into one 60-second Classic queue', () => {
  const store = new Store(),
    service = new MatchService(store, games),
    lobby = new Lobby(service);
  try {
    const a = user(store, 'A'),
      b = user(store, 'B'),
      c = user(store, 'C'),
      d = user(store, 'D');

    assert.equal(lobby.enqueue(a.id, 'digitalGame', false, 2, 30), null);
    const quick = lobby.enqueue(b.id, 'digitalGame', false, 2, 90);
    assert.ok(quick);
    assert.deepEqual(quick!.timeControl, turnTimeControl(60));

    const room = lobby.createRoom(c.id, 'digitalGame', 2, 45);
    assert.equal(room.turnSeconds, 60);
    const privateMatch = lobby.joinRoomResult(d.id, room.code).match;
    assert.ok(privateMatch);
    assert.deepEqual(privateMatch!.timeControl, turnTimeControl(60));
  } finally {
    store.close();
  }
});

test('legacy protocol timer values remain parseable while Digital Classic normalizes them server-side', () => {
  for (const turnSeconds of [30, 45, 60, 90] as const) {
    const parsed = clientMessageSchema.parse({
      type: 'queue',
      gameId: 'digitalGame',
      ranked: false,
      playerCount: 4,
      turnSeconds,
    });
    assert.equal(parsed.type, 'queue');
  }
  assert.throws(() =>
    clientMessageSchema.parse({
      type: 'queue',
      gameId: 'digitalGame',
      ranked: false,
      playerCount: 4,
      turnSeconds: 15,
    }),
  );
});

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