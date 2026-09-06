import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { turnTimeControl } from '../packages/core/src/timing.ts';
import { games } from '../packages/games/registry.ts';
import type { DigitalGameState } from '../packages/games/digital-game/state.ts';
import { MatchService } from '../apps/server/src/matches.ts';
import { Store } from '../apps/server/src/store.ts';

function user(store: Store, name: string) {
  return store.createUser(name, 'email', `${name}-${randomUUID()}`);
}

function nextSeat(seat: number, count: number) {
  return (seat + 1) % count;
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
  assert.deepEqual(state.rackCounts, state.racks.map((rack) => rack.length));
}

function sharedServices(prefix: string) {
  let now = 0;
  const directory = mkdtempSync(join(tmpdir(), `board-arena-${prefix}-`)),
    database = join(directory, 'arena.sqlite'),
    storeA = new Store(database),
    storeB = new Store(database),
    serviceA = new MatchService(storeA, games, { now: () => now }),
    serviceB = new MatchService(storeB, games, { now: () => now });
  return {
    storeA,
    storeB,
    serviceA,
    serviceB,
    setNow(value: number) {
      now = value;
    },
    close() {
      storeB.close();
      storeA.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test('two server instances use revision CAS so only one dirty timeout transition can persist the three-tile penalty', () => {
  const fixture = sharedServices('cas-penalty');
  try {
    const users = [
        user(fixture.storeA, 'CAS-A'),
        user(fixture.storeA, 'CAS-B'),
        user(fixture.storeA, 'CAS-C'),
        user(fixture.storeA, 'CAS-D'),
      ],
      created = fixture.serviceA.create(
        'digitalGame',
        users.map((entry) => entry.id),
        false,
        turnTimeControl(60),
      ),
      initial = fixture.storeA.loadMatch(created.id),
      initialState = initial.state as DigitalGameState,
      startingSeat = initialState.turn,
      startingUser = users[startingSeat],
      rackBefore = [...initialState.racks[startingSeat]],
      poolBefore = [...initialState.drawPool];

    fixture.setNow(10_000);
    fixture.serviceA.command(startingUser.id, {
      type: 'move',
      matchId: created.id,
      commandId: randomUUID(),
      expectedRevision: 0,
      move: { type: 'manipulation-start', ply: initialState.ply },
    });

    // Both independent server instances read the same revision before either
    // writes the timeout transition.
    const staleA = fixture.storeA.loadMatch(created.id),
      staleB = fixture.storeB.loadMatch(created.id),
      staleBState = staleB.state as DigitalGameState;
    assert.equal(staleA.revision, 0);
    assert.equal(staleB.revision, 0);
    assert.equal((staleA.state as DigitalGameState).manipulationInProgress, true);

    // Make the second in-memory snapshot observably different. A non-CAS
    // overwrite would persist a different three-tile draw order.
    staleBState.drawPool.reverse();

    fixture.setNow(60_000);
    const fromA = fixture.serviceA.expire(staleA),
      fromB = fixture.serviceB.expire(staleB),
      canonical = fixture.storeA.loadMatch(created.id),
      state = canonical.state as DigitalGameState;

    assert.equal(canonical.revision, 1);
    assert.equal(fromA.revision, 1);
    assert.equal(fromB.revision, 1);
    assert.equal(state.turn, nextSeat(startingSeat, 4));
    assert.equal(state.ply, 1);
    assert.equal(state.lastAction, 'timeout');
    assert.equal(state.manipulationInProgress, false);
    assert.equal(state.racks[startingSeat].length, rackBefore.length + 3);
    assert.deepEqual(state.racks[startingSeat].slice(-3), poolBefore.slice(-3).reverse());
    assert.equal(state.drawPool.length, poolBefore.length - 3);

    // The losing server must return/reload the canonical winner instead of its
    // divergent stale calculation.
    assert.deepEqual(fromB.state, canonical.state);
    assert.deepEqual(fixture.storeB.loadMatch(created.id), canonical);
    assertInventoryConsistent(state);

    // Further maintenance on both instances at the same wall-clock instant is
    // idempotent and cannot apply another penalty.
    const snapshot = structuredClone(canonical);
    for (let index = 0; index < 4; index++) {
      fixture.serviceA.tick();
      fixture.serviceB.tick();
    }
    assert.deepEqual(fixture.storeA.loadMatch(created.id), snapshot);
  } finally {
    fixture.close();
  }
});

test('multi-server revision CAS keeps empty-pool dirty timeout rollback single and prevents stale overwrite', () => {
  const fixture = sharedServices('cas-empty-pool');
  try {
    const users = [
        user(fixture.storeA, 'EMPTY-A'),
        user(fixture.storeA, 'EMPTY-B'),
        user(fixture.storeA, 'EMPTY-C'),
        user(fixture.storeA, 'EMPTY-D'),
      ],
      created = fixture.serviceA.create(
        'digitalGame',
        users.map((entry) => entry.id),
        false,
        turnTimeControl(60),
      ),
      stored = fixture.storeA.loadMatch(created.id),
      stateBefore = stored.state as DigitalGameState,
      startingSeat = stateBefore.turn,
      startingUser = users[startingSeat],
      holder = nextSeat(startingSeat, 4);

    stateBefore.racks[holder].push(...stateBefore.drawPool);
    stateBefore.drawPool = [];
    stateBefore.rackCounts = stateBefore.racks.map((rack) => rack.length);
    fixture.storeA.saveMatch(stored);
    assertInventoryConsistent(stateBefore);

    fixture.setNow(12_000);
    fixture.serviceA.command(startingUser.id, {
      type: 'move',
      matchId: created.id,
      commandId: randomUUID(),
      expectedRevision: 0,
      move: { type: 'manipulation-start', ply: stateBefore.ply },
    });

    const staleA = fixture.storeA.loadMatch(created.id),
      staleB = fixture.storeB.loadMatch(created.id),
      staleBState = staleB.state as DigitalGameState,
      canonicalBefore = structuredClone(staleA.state as DigitalGameState);
    assert.equal(staleA.revision, 0);
    assert.equal(staleB.revision, 0);
    assert.equal(canonicalBefore.drawPool.length, 0);

    // Harmless but observable stale mutation: without CAS, the second server's
    // unconditional save would overwrite the winner with this score.
    staleBState.scores[0] += 10_000;

    fixture.setNow(60_000);
    const fromA = fixture.serviceA.expire(staleA),
      fromB = fixture.serviceB.expire(staleB),
      canonical = fixture.storeA.loadMatch(created.id),
      state = canonical.state as DigitalGameState;

    assert.equal(canonical.revision, 1);
    assert.equal(fromA.revision, 1);
    assert.equal(fromB.revision, 1);
    assert.equal(state.turn, nextSeat(startingSeat, 4));
    assert.equal(state.ply, 1);
    assert.equal(state.lastAction, 'timeout');
    assert.equal(state.manipulationInProgress, false);
    assert.equal(state.drawPool.length, 0);
    assert.deepEqual(state.table, canonicalBefore.table);
    assert.deepEqual(state.racks, canonicalBefore.racks);
    assert.deepEqual(state.scores, canonicalBefore.scores);
    assert.deepEqual(fromB.state, canonical.state);
    assertInventoryConsistent(state);

    const snapshot = structuredClone(canonical);
    for (let index = 0; index < 4; index++) {
      fixture.serviceB.tick();
      fixture.serviceA.tick();
    }
    assert.deepEqual(fixture.storeB.loadMatch(created.id), snapshot);
  } finally {
    fixture.close();
  }
});
