import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDigitalGame } from '../packages/games/digital-game/state.ts';
import {
  applyDigital,
  calculateRoundScores,
  projectDigitalState,
} from '../packages/games/digital-game/rules.ts';
import { Store } from '../apps/server/src/store.ts';
import { MatchService } from '../apps/server/src/matches.ts';
import { Lobby } from '../apps/server/src/lobby.ts';
import { games } from '../packages/games/registry.ts';
import type { MatchCommand, MatchResult } from '../packages/core/src/protocol.ts';

function users(store: Store, count: number, guests = false) {
  return Array.from({ length: count }, (_, index) =>
    store.createUser(`P${index + 1}`, guests ? 'guest' : 'email', `multi-${count}-${index}-${randomUUID()}`),
  );
}

test('Digital Game deals 14 tiles to 3 and 4 seats and rotates every turn', () => {
  for (const count of [3, 4] as const) {
    let state = createDigitalGame(12345, count);
    assert.equal(state.playerCount, count);
    assert.deepEqual(state.rackCounts, Array.from({ length: count }, () => 14));
    assert.equal(state.drawPool.length, 106 - count * 14);
    for (let seat = 1; seat < count; seat++) {
      state = applyDigital(state, { type: 'draw' });
      assert.equal(state.turn, seat);
    }
    state = applyDigital(state, { type: 'draw' });
    assert.equal(state.turn, 0);
  }
});

test('multiplayer projection exposes only the viewer rack and public table', () => {
  const state = createDigitalGame(22, 4),
    view = projectDigitalState(state, 2);
  assert.equal(view.viewerSeat, 2);
  assert.equal(view.seed, 0);
  assert.deepEqual(view.racks[2], state.racks[2]);
  for (const seat of [0, 1, 3]) {
    assert.equal(view.racks[seat].length, 14);
    assert.ok(view.racks[seat].every((id) => id.startsWith(`hidden-rack-${seat}-`)));
    assert.ok(view.racks[seat].every((id) => !view.tiles[id]));
  }
  assert.equal(view.drawPool.length, state.drawPool.length);
});

test('multiplayer round scoring awards the winner every opponent penalty', () => {
  const state = createDigitalGame(7, 3);
  state.racks = [state.racks[0].slice(0, 1), state.racks[1].slice(0, 2), state.racks[2].slice(0, 3)];
  const scores = calculateRoundScores(state, 0);
  assert.equal(scores.length, 3);
  assert.equal(scores.reduce((sum, value) => sum + value, 0), 0);
  assert.ok(scores[0] > 0 && scores[1] < 0 && scores[2] < 0);
});

test('Digital private rooms wait for all four players before creating a match', () => {
  const store = new Store(), service = new MatchService(store, games), lobby = new Lobby(service);
  try {
    const [a, b, c, d] = users(store, 4);
    const room = lobby.createRoom(a.id, 'digitalGame', 4);
    assert.equal(lobby.joinRoomResult(b.id, room.code).match, null);
    assert.equal(lobby.rooms.get(room.code)?.members.length, 2);
    assert.equal(lobby.joinRoomResult(c.id, room.code).match, null);
    const match = lobby.joinRoomResult(d.id, room.code).match;
    assert.ok(match);
    assert.equal(match!.players.length, 4);
    assert.equal(match!.state.playerCount, 4);
    assert.equal(lobby.rooms.has(room.code), false);
    const extra = store.createUser('Extra', 'email', `extra-${randomUUID()}`);
    assert.throws(() => lobby.createRoom(extra.id, 'quoridor', 3), /player-count-not-supported/);
  } finally {
    store.close();
  }
});

test('quick matchmaking groups exactly three Digital players', () => {
  const store = new Store(), service = new MatchService(store, games), lobby = new Lobby(service);
  try {
    const [a, b, c] = users(store, 3);
    assert.equal(lobby.enqueue(a.id, 'digitalGame', false, 3), null);
    assert.equal(lobby.enqueue(b.id, 'digitalGame', false, 3), null);
    const match = lobby.enqueue(c.id, 'digitalGame', false, 3);
    assert.ok(match);
    assert.equal(match!.players.length, 3);
    assert.equal(lobby.queue.length, 0);
  } finally {
    store.close();
  }
});

test('four-player draw requires unanimous acceptance and persists one result row per seat', () => {
  const store = new Store(), service = new MatchService(store, games);
  try {
    const ps = users(store, 4);
    let match = service.create('digitalGame', ps.map((user) => user.id), true);
    const send = (user: string, type: 'draw-offer' | 'draw-answer', accept?: boolean) => {
      const command = {
        type,
        matchId: match.id,
        commandId: randomUUID(),
        expectedRevision: match.revision,
        ...(type === 'draw-answer' ? { accept } : {}),
      } as MatchCommand;
      match = service.command(user, command);
    };
    send(ps[0].id, 'draw-offer');
    send(ps[1].id, 'draw-answer', true);
    assert.equal(match.result, null);
    send(ps[2].id, 'draw-answer', true);
    assert.equal(match.result, null);
    send(ps[3].id, 'draw-answer', true);
    const finalResult = match.result as MatchResult | null;
    assert.equal(finalResult?.reason, 'agreement');
    assert.equal(finalResult?.winner, null);
    assert.equal(finalResult?.ratingDelta.length, 4);
    const rows = store.db.prepare('SELECT opponents_json,player_count FROM results WHERE match_id=?').all(match.id) as {
      opponents_json: string;
      player_count: number;
    }[];
    assert.equal(rows.length, 4);
    assert.ok(rows.every((row) => row.player_count === 4 && JSON.parse(row.opponents_json).length === 3));
  } finally {
    store.close();
  }
});
