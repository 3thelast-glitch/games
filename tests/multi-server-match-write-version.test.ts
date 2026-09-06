import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RuleError } from '../packages/core/src/game.ts';
import { games } from '../packages/games/registry.ts';
import type { DigitalGameState } from '../packages/games/digital-game/state.ts';
import { MatchService, type StoredMatch } from '../apps/server/src/matches.ts';
import { Store } from '../apps/server/src/store.ts';

class ControlledStore extends Store {
  private queued: StoredMatch[] = [];

  fresh(id: string) {
    return super.loadMatch(id);
  }

  queue(match: StoredMatch) {
    this.queued.push(match);
  }

  override loadMatch(id: string): StoredMatch {
    const queued = this.queued.shift();
    if (queued) {
      assert.equal(queued.id, id);
      return queued;
    }
    return super.loadMatch(id);
  }
}

function sharedServices(prefix: string) {
  let now = 1_000;
  const directory = mkdtempSync(join(tmpdir(), `board-arena-${prefix}-`)),
    database = join(directory, 'arena.sqlite'),
    storeA = new ControlledStore(database),
    storeB = new ControlledStore(database),
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

function user(store: Store, name: string) {
  return store.createUser(name, 'email', `${name}-${randomUUID()}`);
}

function expectStale(fn: () => unknown) {
  assert.throws(fn, (error: unknown) => error instanceof RuleError && error.code === 'stale-revision');
}

test('same-revision Digital manipulation metadata uses write-version CAS across servers', () => {
  const fixture = sharedServices('metadata-write-version');
  try {
    const users = [user(fixture.storeA, 'META-A'), user(fixture.storeA, 'META-B')],
      created = fixture.serviceA.create('digitalGame', users.map((entry) => entry.id)),
      staleA = fixture.storeA.fresh(created.id),
      staleB = fixture.storeB.fresh(created.id),
      state = staleA.state as DigitalGameState,
      activeUser = users[state.turn];

    assert.equal(staleA.revision, 0);
    assert.equal(staleB.revision, 0);
    assert.equal(staleA.writeVersion, 0);
    assert.equal(staleB.writeVersion, 0);
    fixture.storeA.queue(staleA);
    fixture.storeB.queue(staleB);

    const started = fixture.serviceA.command(activeUser.id, {
      type: 'move',
      matchId: created.id,
      commandId: randomUUID(),
      expectedRevision: 0,
      move: { type: 'manipulation-start', ply: state.ply },
    });
    assert.equal(started.revision, 0);
    assert.equal((started.state as DigitalGameState).manipulationInProgress, true);
    assert.equal('writeVersion' in started, false);

    expectStale(() =>
      fixture.serviceB.command(activeUser.id, {
        type: 'move',
        matchId: created.id,
        commandId: randomUUID(),
        expectedRevision: 0,
        move: { type: 'manipulation-reset', ply: state.ply },
      }),
    );

    const canonical = fixture.storeA.fresh(created.id);
    assert.equal(canonical.revision, 0);
    assert.equal(canonical.writeVersion, 1);
    assert.equal((canonical.state as DigitalGameState).manipulationInProgress, true);
  } finally {
    fixture.close();
  }
});

test('dirty metadata racing a 60-second timeout cannot be overwritten by a stale timeout snapshot', () => {
  const fixture = sharedServices('metadata-timeout-write-version');
  try {
    const users = [user(fixture.storeA, 'TIME-A'), user(fixture.storeA, 'TIME-B')],
      created = fixture.serviceA.create('digitalGame', users.map((entry) => entry.id)),
      staleTimeout = fixture.storeB.fresh(created.id),
      before = staleTimeout.state as DigitalGameState,
      activeUser = users[before.turn],
      rackBefore = before.racks[before.turn].length,
      poolBefore = before.drawPool.length;

    fixture.setNow(10_000);
    fixture.serviceA.command(activeUser.id, {
      type: 'move',
      matchId: created.id,
      commandId: randomUUID(),
      expectedRevision: 0,
      move: { type: 'manipulation-start', ply: before.ply },
    });

    const dirty = fixture.storeA.fresh(created.id);
    assert.equal(dirty.revision, 0);
    assert.equal(dirty.writeVersion, 1);
    assert.equal((dirty.state as DigitalGameState).manipulationInProgress, true);

    fixture.setNow(60_000);
    const expired = fixture.serviceB.expire(staleTimeout),
      canonical = fixture.storeA.fresh(created.id),
      state = canonical.state as DigitalGameState;

    assert.equal(expired.revision, 1);
    assert.equal(canonical.revision, 1);
    assert.equal(state.lastAction, 'timeout');
    assert.equal(state.manipulationInProgress, false);
    assert.equal(state.racks[before.turn].length, rackBefore + 3);
    assert.equal(state.drawPool.length, poolBefore - 3);
    assert.deepEqual(expired.state, canonical.state);
  } finally {
    fixture.close();
  }
});

test('disconnect presence retries merge two stale same-revision server writes instead of losing one', () => {
  const fixture = sharedServices('presence-write-version');
  try {
    const users = [user(fixture.storeA, 'PRESENCE-A'), user(fixture.storeA, 'PRESENCE-B')],
      created = fixture.serviceA.create('connectFour', users.map((entry) => entry.id)),
      staleA = fixture.storeA.fresh(created.id),
      staleB = fixture.storeB.fresh(created.id);

    fixture.storeA.queue(staleA);
    fixture.storeB.queue(staleB);
    fixture.setNow(5_000);
    fixture.serviceA.connection(users[0].id, false);
    fixture.serviceB.connection(users[1].id, false);

    const canonical = fixture.storeA.fresh(created.id);
    assert.equal(canonical.revision, 0);
    assert.equal(canonical.writeVersion, 2);
    assert.equal(canonical.disconnectedAt[0], 5_000);
    assert.equal(canonical.disconnectedAt[1], 5_000);
  } finally {
    fixture.close();
  }
});

test('multi-server rematch voting creates one replacement match and reuses it idempotently', () => {
  const fixture = sharedServices('rematch-write-version');
  try {
    const users = [user(fixture.storeA, 'REMATCH-A'), user(fixture.storeA, 'REMATCH-B')],
      created = fixture.serviceA.create('connectFour', users.map((entry) => entry.id));

    fixture.serviceA.command(users[0].id, {
      type: 'resign',
      matchId: created.id,
      commandId: randomUUID(),
      expectedRevision: 0,
    });

    const firstVote = fixture.serviceA.rematch(users[0].id, created.id);
    assert.equal(firstVote.id, created.id);
    assert.deepEqual(firstVote.rematchVotes, [0]);

    const replacement = fixture.serviceB.rematch(users[1].id, created.id),
      repeated = fixture.serviceA.rematch(users[0].id, created.id),
      parent = fixture.storeA.fresh(created.id),
      active = fixture.storeA
        .activeMatches()
        .filter((match) => match.players.some((player) => users.some((entry) => entry.id === player.id)));

    assert.notEqual(replacement.id, created.id);
    assert.equal(repeated.id, replacement.id);
    assert.equal(parent.rematchId, replacement.id);
    assert.deepEqual(parent.rematchVotes.sort(), [0, 1]);
    assert.equal(active.length, 1);
    assert.equal(active[0].id, replacement.id);
  } finally {
    fixture.close();
  }
});
