import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDigital,
  calculateBlockedScores,
  hasClassicLegalPlay,
  isClassicBlocked,
} from '../packages/games/digital-game/rules.ts';
import {
  createDigitalGame,
  type DigitalColor,
  type DigitalGameState,
} from '../packages/games/digital-game/state.ts';

function tile(
  state: DigitalGameState,
  color: DigitalColor,
  value: number,
  copyIndex: 0 | 1 = 0,
): string {
  const found = Object.values(state.tiles).find(
    (item) =>
      !item.isJoker &&
      item.color === color &&
      item.value === value &&
      item.copyIndex === copyIndex,
  );
  assert.ok(found, `missing ${color} ${value} copy ${copyIndex}`);
  return found.id;
}

test('Classic blocked scoring is relative to the winner rack penalty', () => {
  const s = createDigitalGame(100, 3);
  s.racks = [
    [tile(s, 'red', 3)],
    [tile(s, 'blue', 9)],
    [tile(s, 'black', 11)],
  ];
  s.rackCounts = s.racks.map((rack) => rack.length);
  assert.deepEqual(calculateBlockedScores(s, 0), [14, -6, -8]);
});

test('empty-pool pass cycle does not end while any player still has a legal play', () => {
  const s = createDigitalGame(101, 2);
  s.racks = [
    [tile(s, 'red', 3)],
    [tile(s, 'blue', 1), tile(s, 'blue', 2), tile(s, 'blue', 3)],
  ];
  s.rackCounts = s.racks.map((rack) => rack.length);
  s.drawPool = [];
  s.hasCompletedInitialMeld = [true, true];
  s.turn = 0;

  const one = applyDigital(s, { type: 'draw' });
  assert.equal(one.winner, null);
  const two = applyDigital(one, { type: 'draw' });
  assert.equal(two.winner, null);
  assert.equal(two.drawReason, null);
  assert.equal(isClassicBlocked(two), false);
});

test('Classic blocked oracle returns true only when nobody can make a legal play', () => {
  const s = createDigitalGame(102, 2);
  s.racks = [[tile(s, 'red', 3)], [tile(s, 'blue', 9)]];
  s.rackCounts = [1, 1];
  s.drawPool = [];
  s.hasCompletedInitialMeld = [true, true];
  assert.equal(hasClassicLegalPlay(s, 0), false);
  assert.equal(hasClassicLegalPlay(s, 1), false);
  assert.equal(isClassicBlocked(s), true);
});

test('Classic solver finds a legal table manipulation even without a rack-only meld', () => {
  const s = createDigitalGame(103, 2);
  const run = [tile(s, 'blue', 3), tile(s, 'blue', 4), tile(s, 'blue', 5)];
  const extension = tile(s, 'blue', 6);
  s.table = [{ id: 'run', tiles: run, type: 'run' }];
  s.racks = [[extension], [tile(s, 'red', 13)]];
  s.rackCounts = [1, 1];
  s.drawPool = [];
  s.hasCompletedInitialMeld = [true, true];
  assert.equal(hasClassicLegalPlay(s, 0), true);
  assert.equal(isClassicBlocked(s), false);
});

test('Classic solver requires 30 or more from the rack for an unopened player', () => {
  const thirty = createDigitalGame(104, 2);
  thirty.racks = [
    [tile(thirty, 'red', 10), tile(thirty, 'blue', 10), tile(thirty, 'black', 10)],
    [],
  ];
  thirty.rackCounts = [3, 0];
  thirty.drawPool = [];
  thirty.hasCompletedInitialMeld = [false, true];
  assert.equal(hasClassicLegalPlay(thirty, 0), true);

  const twentySeven = createDigitalGame(105, 2);
  twentySeven.racks = [
    [
      tile(twentySeven, 'red', 9),
      tile(twentySeven, 'blue', 9),
      tile(twentySeven, 'black', 9),
    ],
    [],
  ];
  twentySeven.rackCounts = [3, 0];
  twentySeven.drawPool = [];
  twentySeven.hasCompletedInitialMeld = [false, true];
  assert.equal(hasClassicLegalPlay(twentySeven, 0), false);
});

test('blocked finish uses Classic relative scoring after a full no-play pass cycle', () => {
  const s = createDigitalGame(106, 2);
  s.racks = [[tile(s, 'red', 3)], [tile(s, 'blue', 9)]];
  s.rackCounts = [1, 1];
  s.drawPool = [];
  s.hasCompletedInitialMeld = [true, true];
  s.turn = 0;

  const one = applyDigital(s, { type: 'draw' });
  assert.equal(one.winner, null);
  const two = applyDigital(one, { type: 'draw' });
  assert.equal(two.winner, 0);
  assert.deepEqual(two.scores, [6, -6]);
});
