import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../apps/server/src/store.ts';
import { MatchService } from '../apps/server/src/matches.ts';
import { Lobby } from '../apps/server/src/lobby.ts';
import { games } from '../packages/games/registry.ts';

function setup() {
  let now = 1_000_000;
  const store = new Store();
  const service = new MatchService(store, games, {
    now: () => now,
    clockMs: 60_000,
    graceMs: 10_000,
  });
  return {
    store,
    service,
    lobby: new Lobby(service),
    advance(ms: number) {
      now += ms;
    },
  };
}

function account(store: Store, name: string) {
  return store.createUser(name, 'email', `${name.toLowerCase()}-subject`);
}

function setRating(store: Store, userId: string, gameId: string, rating: number) {
  store.db
    .prepare(
      `INSERT INTO ratings(user_id,game_id,rating,played) VALUES(?,?,?,0)
       ON CONFLICT(user_id,game_id) DO UPDATE SET rating=excluded.rating`,
    )
    .run(userId, gameId, rating);
}

test('ranked multiplayer matchmaking requires pairwise-compatible ratings and includes the triggering player', () => {
  const { store, lobby } = setup();
  try {
    const low = account(store, 'Low'),
      high = account(store, 'High'),
      middle = account(store, 'Middle'),
      trigger = account(store, 'Trigger');
    setRating(store, low.id, 'digitalGame', 850);
    setRating(store, high.id, 'digitalGame', 1150);
    setRating(store, middle.id, 'digitalGame', 1000);
    setRating(store, trigger.id, 'digitalGame', 1000);

    assert.equal(lobby.enqueue(low.id, 'digitalGame', true, 3, 60), null);
    assert.equal(lobby.enqueue(high.id, 'digitalGame', true, 3, 60), null);
    // Both are individually within 150 points of Middle, but Low and High are
    // 300 apart. A three-player ranked match must therefore not be formed.
    assert.equal(lobby.enqueue(middle.id, 'digitalGame', true, 3, 60), null);
    assert.equal(lobby.queue.length, 3);

    const match = lobby.enqueue(trigger.id, 'digitalGame', true, 3, 60);
    assert.ok(match);
    const ids = new Set(match.players.map((player) => player.id));
    assert.ok(ids.has(trigger.id));
    assert.ok(ids.has(low.id));
    assert.ok(ids.has(middle.id));
    assert.ok(!ids.has(high.id));
    assert.equal(lobby.queue.length, 1);
  } finally {
    store.close();
  }
});

test('owner cancellation immediately expires the private room for remaining members', () => {
  const { store, lobby } = setup();
  try {
    const owner = store.createUser('Owner'),
      member = store.createUser('Member');
    const room = lobby.createRoom(owner.id, 'digitalGame', 3, 30);
    const joined = lobby.joinRoomResult(member.id, room.code);
    assert.equal(joined.match, null);
    assert.equal(joined.room.turnSeconds, 60);

    const changed = lobby.cancel(owner.id);
    assert.equal(changed.length, 1);
    assert.equal(changed[0].code, room.code);
    assert.equal(changed[0].expiresAt, 0);
    assert.deepEqual(changed[0].members, [member.id]);
    assert.equal(lobby.rooms.has(room.code), false);
  } finally {
    store.close();
  }
});

test('Digital Classic lobby timer is canonicalized to exactly 60 seconds', () => {
  const { store, lobby } = setup();
  try {
    assert.equal(lobby.canonicalTurnSeconds('digitalGame', 30), 60);
    assert.equal(lobby.canonicalTurnSeconds('digitalGame', 45), 60);
    assert.equal(lobby.canonicalTurnSeconds('digitalGame', 60), 60);
    assert.equal(lobby.canonicalTurnSeconds('digitalGame', 90), 60);
    assert.equal(lobby.canonicalTurnSeconds('abalone'), null);
  } finally {
    store.close();
  }
});


test('Reversi supports optional per-turn timers and an Off fallback', () => {
  const { store, lobby } = setup();
  try {
    assert.equal(lobby.canonicalTurnSeconds('reversi'), null);
    for (const seconds of [15, 30, 45, 60, 90] as const)
      assert.equal(lobby.canonicalTurnSeconds('reversi', seconds), seconds);
    assert.throws(() => lobby.canonicalTurnSeconds('abalone', 15), /turn-timer-not-supported/);

    const timedA = account(store, 'TimedA'), timedB = account(store, 'TimedB');
    assert.equal(lobby.enqueue(timedA.id, 'reversi', false, 2, 15), null);
    const timed = lobby.enqueue(timedB.id, 'reversi', false, 2, 15);
    assert.ok(timed);
    assert.deepEqual(timed.timeControl, { mode: 'turn', turnMs: 15000 });

    const offA = account(store, 'OffA'), offB = account(store, 'OffB');
    assert.equal(lobby.enqueue(offA.id, 'reversi', false, 2), null);
    const off = lobby.enqueue(offB.id, 'reversi', false, 2);
    assert.ok(off);
    assert.deepEqual(off.timeControl, { mode: 'bank', initialMs: 60000 });
  } finally {
    store.close();
  }
});
