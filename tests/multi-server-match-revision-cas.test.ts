import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RuleError } from '../packages/core/src/game.ts';
import { games } from '../packages/games/registry.ts';
import type { ConnectFourState } from '../packages/games/connect-four/state.ts';
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
  const directory = mkdtempSync(join(tmpdir(), `board-arena-${prefix}-`)),
    database = join(directory, 'arena.sqlite'),
    storeA = new ControlledStore(database),
    storeB = new ControlledStore(database),
    serviceA = new MatchService(storeA, games, { now: () => 1_000 }),
    serviceB = new MatchService(storeB, games, { now: () => 1_000 });

  return {
    storeA,
    storeB,
    serviceA,
    serviceB,
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

test('two server instances cannot both persist different moves from the same revision', () => {
  const fixture = sharedServices('command-move-cas');
  try {
    const users = [user(fixture.storeA, 'MOVE-A'), user(fixture.storeA, 'MOVE-B')],
      created = fixture.serviceA.create('connectFour', users.map((entry) => entry.id)),
      staleA = fixture.storeA.fresh(created.id),
      staleB = fixture.storeB.fresh(created.id),
      activeUser = users[staleA.state.turn];

    assert.equal(staleA.revision, 0);
    assert.equal(staleB.revision, 0);
    fixture.storeA.queue(staleA);
    fixture.storeB.queue(staleB);

    const accepted = fixture.serviceA.command(activeUser.id, {
      type: 'move',
      matchId: created.id,
      commandId: randomUUID(),
      expectedRevision: 0,
      move: { column: 0 },
    });
    assert.equal(accepted.revision, 1);

    expectStale(() =>
      fixture.serviceB.command(activeUser.id, {
        type: 'move',
        matchId: created.id,
        commandId: randomUUID(),
        expectedRevision: 0,
        move: { column: 6 },
      }),
    );

    const canonical = fixture.storeA.fresh(created.id),
      state = canonical.state as ConnectFourState;
    assert.equal(canonical.revision, 1);
    assert.equal(state.board[35], 0);
    assert.equal(state.board[41], null);
    assert.equal(state.lastMove, 35);
    assert.deepEqual(fixture.storeB.fresh(created.id), canonical);
  } finally {
    fixture.close();
  }
});

test('two server instances cannot overwrite competing draw offers at one revision', () => {
  const fixture = sharedServices('draw-offer-cas');
  try {
    const users = [user(fixture.storeA, 'DRAW-A'), user(fixture.storeA, 'DRAW-B')],
      created = fixture.serviceA.create('connectFour', users.map((entry) => entry.id)),
      staleA = fixture.storeA.fresh(created.id),
      staleB = fixture.storeB.fresh(created.id);

    fixture.storeA.queue(staleA);
    fixture.storeB.queue(staleB);

    const first = fixture.serviceA.command(users[0].id, {
      type: 'draw-offer',
      matchId: created.id,
      commandId: randomUUID(),
      expectedRevision: 0,
    });
    assert.equal(first.revision, 1);
    assert.equal(first.drawOffer, 0);

    expectStale(() =>
      fixture.serviceB.command(users[1].id, {
        type: 'draw-offer',
        matchId: created.id,
        commandId: randomUUID(),
        expectedRevision: 0,
      }),
    );

    const canonical = fixture.storeA.fresh(created.id);
    assert.equal(canonical.revision, 1);
    assert.equal(canonical.drawOffer, 0);
    assert.deepEqual(canonical.drawAccepts, [0]);
  } finally {
    fixture.close();
  }
});

test('competing multi-server resignations settle once and update ratings/results once', () => {
  const fixture = sharedServices('terminal-resign-cas');
  try {
    const users = [user(fixture.storeA, 'RESIGN-A'), user(fixture.storeA, 'RESIGN-B')],
      created = fixture.serviceA.create('connectFour', users.map((entry) => entry.id), true),
      staleA = fixture.storeA.fresh(created.id),
      staleB = fixture.storeB.fresh(created.id);

    fixture.storeA.queue(staleA);
    fixture.storeB.queue(staleB);

    const first = fixture.serviceA.command(users[0].id, {
      type: 'resign',
      matchId: created.id,
      commandId: randomUUID(),
      expectedRevision: 0,
    });
    assert.equal(first.revision, 1);
    assert.equal(first.result?.winner, 1);
    assert.equal(first.result?.reason, 'resignation');

    const ratingsAfterFirst = users.map((entry) => fixture.storeA.rating(entry.id, 'connectFour'));
    expectStale(() =>
      fixture.serviceB.command(users[1].id, {
        type: 'resign',
        matchId: created.id,
        commandId: randomUUID(),
        expectedRevision: 0,
      }),
    );

    const canonical = fixture.storeA.fresh(created.id),
      ratingsAfterRace = users.map((entry) => fixture.storeA.rating(entry.id, 'connectFour')),
      rows = fixture.storeA.db
        .prepare('SELECT user_id,result,delta FROM results WHERE match_id=? ORDER BY user_id')
        .all(created.id) as { user_id: string; result: string; delta: number }[];

    assert.equal(canonical.revision, 1);
    assert.equal(canonical.result?.winner, 1);
    assert.equal(canonical.result?.reason, 'resignation');
    assert.deepEqual(ratingsAfterRace, ratingsAfterFirst);
    assert.equal(ratingsAfterRace[0] + ratingsAfterRace[1], 2000);
    assert.equal(rows.length, 2);
    assert.equal(rows.filter((row) => row.result === 'win').length, 1);
    assert.equal(rows.filter((row) => row.result === 'loss').length, 1);
    assert.equal(rows.reduce((sum, row) => sum + row.delta, 0), 0);
  } finally {
    fixture.close();
  }
});

test('a terminal winning move claims the original revision before a stale server can overwrite it', () => {
  const fixture = sharedServices('terminal-move-cas');
  try {
    const users = [user(fixture.storeA, 'WIN-A'), user(fixture.storeA, 'WIN-B')],
      created = fixture.serviceA.create('connectFour', users.map((entry) => entry.id)),
      setup = fixture.storeA.fresh(created.id),
      setupState = setup.state as ConnectFourState;

    setupState.board[35] = 0;
    setupState.board[36] = 0;
    setupState.board[37] = 0;
    setupState.turn = 0;
    setupState.ply = 6;
    setupState.lastMove = 37;
    fixture.storeA.saveMatch(setup);

    const staleA = fixture.storeA.fresh(created.id),
      staleB = fixture.storeB.fresh(created.id);
    fixture.storeA.queue(staleA);
    fixture.storeB.queue(staleB);

    const won = fixture.serviceA.command(users[0].id, {
      type: 'move',
      matchId: created.id,
      commandId: randomUUID(),
      expectedRevision: 0,
      move: { column: 3 },
    });
    assert.equal(won.revision, 2);
    assert.equal(won.result?.winner, 0);
    assert.equal(won.result?.reason, 'four-in-row');

    expectStale(() =>
      fixture.serviceB.command(users[0].id, {
        type: 'move',
        matchId: created.id,
        commandId: randomUUID(),
        expectedRevision: 0,
        move: { column: 6 },
      }),
    );

    const canonical = fixture.storeA.fresh(created.id),
      state = canonical.state as ConnectFourState,
      resultCount = fixture.storeA.db
        .prepare('SELECT COUNT(*) AS count FROM results WHERE match_id=?')
        .get(created.id) as { count: number };
    assert.equal(canonical.revision, 2);
    assert.equal(canonical.result?.winner, 0);
    assert.equal(state.board[38], 0);
    assert.equal(state.board[41], null);
    assert.equal(resultCount.count, 2);
  } finally {
    fixture.close();
  }
});
