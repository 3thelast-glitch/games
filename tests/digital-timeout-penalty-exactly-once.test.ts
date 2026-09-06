import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { RuleError } from '../packages/core/src/game.ts';
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
  assert.ok(placed.every((id) => state.tiles[id] !== undefined));
  assert.deepEqual(state.rackCounts, state.racks.map((rack) => rack.length));
}

async function raceAtDeadline(
  service: MatchService,
  matchId: string,
  users: ReturnType<typeof user>[],
  expectedRevision: number,
) {
  return Promise.all(
    users.map(
      (current, index) =>
        new Promise<string>((resolve) => {
          setImmediate(() => {
            try {
              service.command(current.id, {
                type: 'move',
                matchId,
                commandId: randomUUID(),
                expectedRevision,
                move: { type: 'draw' },
              });
              resolve('accepted');
            } catch (error) {
              resolve(error instanceof RuleError ? error.code : `unexpected-${index}`);
            }
          });
        }),
    ),
  );
}

test('unfinished Digital Classic timeout applies the three-tile penalty exactly once under concurrent deadline commands', async () => {
  let now = 0;
  const store = new Store(),
    service = new MatchService(store, games, { now: () => now }),
    users = [user(store, 'A'), user(store, 'B'), user(store, 'C'), user(store, 'D')];

  try {
    const created = service.create('digitalGame', users.map((entry) => entry.id), false, turnTimeControl(60)),
      initialStored = store.loadMatch(created.id),
      initial = initialStored.state as DigitalGameState,
      startingSeat = initial.turn,
      startingUser = users[startingSeat],
      tableBefore = structuredClone(initial.table),
      rackBefore = [...initial.racks[startingSeat]],
      poolBefore = [...initial.drawPool];

    now = 10_000;
    const marked = service.command(startingUser.id, {
      type: 'move',
      matchId: created.id,
      commandId: randomUUID(),
      expectedRevision: 0,
      move: { type: 'manipulation-start', ply: initial.ply },
    });
    assert.equal(marked.revision, 0);
    assert.equal(marked.turnStartedAt, 0);
    assert.equal((store.loadMatch(created.id).state as DigitalGameState).manipulationInProgress, true);

    now = 60_000;
    const raceResults = await raceAtDeadline(service, created.id, users, 0);
    assert.deepEqual(raceResults, ['stale-revision', 'stale-revision', 'stale-revision', 'stale-revision']);

    const afterRace = store.loadMatch(created.id),
      state = afterRace.state as DigitalGameState;
    assert.equal(afterRace.revision, 1);
    assert.equal(afterRace.turnStartedAt, 60_000);
    assert.equal(state.turn, nextSeat(startingSeat, 4));
    assert.equal(state.ply, 1);
    assert.equal(state.lastAction, 'timeout');
    assert.equal(state.manipulationInProgress, false);
    assert.deepEqual(state.table, tableBefore);
    assert.deepEqual(state.racks[startingSeat].slice(0, rackBefore.length), rackBefore);
    assert.deepEqual(state.racks[startingSeat].slice(-3), poolBefore.slice(-3).reverse());
    assert.equal(state.racks[startingSeat].length, rackBefore.length + 3);
    assert.equal(state.drawPool.length, poolBefore.length - 3);
    assertInventoryConsistent(state);

    // Re-reading and maintenance ticks at the same wall-clock instant must not
    // process the just-finished timeout a second time. The next seat owns a new
    // 60-second deadline anchored at 60_000.
    const canonicalAfterFirstTimeout = structuredClone(afterRace);
    for (let index = 0; index < 8; index++) {
      service.get(created.id, users[index % users.length].id);
      service.tick();
    }
    const afterRepeatedProcessing = store.loadMatch(created.id);
    assert.equal(afterRepeatedProcessing.revision, canonicalAfterFirstTimeout.revision);
    assert.equal(afterRepeatedProcessing.turnStartedAt, canonicalAfterFirstTimeout.turnStartedAt);
    assert.deepEqual(afterRepeatedProcessing.state, canonicalAfterFirstTimeout.state);
  } finally {
    store.close();
  }
});

test('unfinished Digital Classic timeout with an empty pool is idempotent under concurrent processing', async () => {
  let now = 0;
  const store = new Store(),
    service = new MatchService(store, games, { now: () => now }),
    users = [user(store, 'E'), user(store, 'F'), user(store, 'G'), user(store, 'H')];

  try {
    const created = service.create('digitalGame', users.map((entry) => entry.id), false, turnTimeControl(60)),
      stored = store.loadMatch(created.id),
      initial = stored.state as DigitalGameState,
      startingSeat = initial.turn,
      startingUser = users[startingSeat],
      poolHolder = nextSeat(startingSeat, 4);

    initial.racks[poolHolder].push(...initial.drawPool);
    initial.drawPool = [];
    initial.rackCounts = initial.racks.map((rack) => rack.length);
    assertInventoryConsistent(initial);
    store.saveMatch(stored);

    const tableBefore = structuredClone(initial.table),
      racksBefore = structuredClone(initial.racks);

    now = 12_000;
    const marked = service.command(startingUser.id, {
      type: 'move',
      matchId: created.id,
      commandId: randomUUID(),
      expectedRevision: 0,
      move: { type: 'manipulation-start', ply: initial.ply },
    });
    assert.equal(marked.revision, 0);
    assert.equal(marked.turnStartedAt, 0);

    now = 60_000;
    const raceResults = await raceAtDeadline(service, created.id, users, 0);
    assert.deepEqual(raceResults, ['stale-revision', 'stale-revision', 'stale-revision', 'stale-revision']);

    const afterRace = store.loadMatch(created.id),
      state = afterRace.state as DigitalGameState;
    assert.equal(afterRace.revision, 1);
    assert.equal(afterRace.turnStartedAt, 60_000);
    assert.equal(state.turn, nextSeat(startingSeat, 4));
    assert.equal(state.ply, 1);
    assert.equal(state.lastAction, 'timeout');
    assert.equal(state.manipulationInProgress, false);
    assert.deepEqual(state.table, tableBefore);
    assert.deepEqual(state.racks, racksBefore);
    assert.equal(state.drawPool.length, 0);
    assertInventoryConsistent(state);

    // Multiple callers observing the expired turn plus repeated maintenance
    // ticks must leave the post-timeout state byte-for-byte stable.
    const canonicalAfterFirstTimeout = structuredClone(afterRace);
    await Promise.all(
      users.map(
        (current) =>
          new Promise<void>((resolve) => {
            setImmediate(() => {
              service.get(created.id, current.id);
              resolve();
            });
          }),
      ),
    );
    for (let index = 0; index < 8; index++) service.tick();

    const afterRepeatedProcessing = store.loadMatch(created.id);
    assert.equal(afterRepeatedProcessing.revision, canonicalAfterFirstTimeout.revision);
    assert.equal(afterRepeatedProcessing.turnStartedAt, canonicalAfterFirstTimeout.turnStartedAt);
    assert.deepEqual(afterRepeatedProcessing.state, canonicalAfterFirstTimeout.state);
  } finally {
    store.close();
  }
});
