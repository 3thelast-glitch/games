import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyClassicDigital,
  classicDigitalLegalMoves,
  parseClassicDigitalMove,
  validateClassicDigital,
} from '../packages/games/digital-game/classic-engine.ts';
import {
  chooseClassicStartingSeat,
  createDigitalGame,
  createTileSet,
} from '../packages/games/digital-game/state.ts';

test('Classic setup chooses and persists the highest-tile starting seat for 2-4 players', () => {
  const tiles = createTileSet();
  for (const playerCount of [2, 3, 4] as const) {
    for (const seed of [1, 7, 22, 12345, 987654321]) {
      const expected = chooseClassicStartingSeat(tiles, playerCount, seed);
      const state = createDigitalGame(seed, playerCount);
      assert.equal(state.startingSeat, expected);
      assert.equal(state.turn, expected);
      assert.ok(expected >= 0 && expected < playerCount);
      assert.deepEqual(state.rackCounts, Array.from({ length: playerCount }, () => 14));
      assert.equal(state.drawPool.length, 106 - playerCount * 14);
      assert.equal(
        new Set([...state.racks.flat(), ...state.drawPool]).size,
        106,
        'temporary setup draws must not consume tiles from the real deal',
      );
    }
  }
});

test('Classic starting-seat selection is deterministic for the same seed', () => {
  const tiles = createTileSet();
  for (const count of [2, 3, 4] as const) {
    const first = chooseClassicStartingSeat(tiles, count, 424242);
    for (let index = 0; index < 10; index++)
      assert.equal(chooseClassicStartingSeat(tiles, count, 424242), first);
  }
});

test('explicit pass is legal only when the pool is empty and advances without changing racks', () => {
  const state = createDigitalGame(31, 2);
  state.turn = 0;
  state.startingSeat = 0;
  state.drawPool = [];
  state.emptyPoolPasses = 0;
  const before = structuredClone(state.racks);

  assert.deepEqual(validateClassicDigital(state, { type: 'pass' }), { ok: true });
  const next = applyClassicDigital(state, { type: 'pass' });
  assert.deepEqual(next.racks, before);
  assert.equal(next.turn, 1);
  assert.equal(next.ply, state.ply + 1);
  assert.equal(next.lastAction, 'pass');
  assert.equal(next.emptyPoolPasses, 1);
});

test('pass is rejected while tiles remain in the pool', () => {
  const state = createDigitalGame(32, 2);
  assert.ok(state.drawPool.length > 0);
  assert.deepEqual(validateClassicDigital(state, { type: 'pass' }), {
    ok: false,
    code: 'pass-pool-not-empty',
  });
  assert.throws(() => applyClassicDigital(state, { type: 'pass' }), /pass-pool-not-empty/);
});

test('Classic legal move surface exposes draw with a pool and pass without one', () => {
  const withPool = createDigitalGame(33, 2);
  assert.equal(classicDigitalLegalMoves(withPool)[0]?.type, 'draw');

  const empty = createDigitalGame(34, 2);
  empty.drawPool = [];
  assert.equal(classicDigitalLegalMoves(empty)[0]?.type, 'pass');
  assert.equal(classicDigitalLegalMoves(empty).some((move) => move.type === 'draw'), false);
});

test('legacy empty-pool draw remains a temporary compatibility alias for pass', () => {
  const state = createDigitalGame(35, 2);
  state.turn = 0;
  state.drawPool = [];
  const next = applyClassicDigital(state, { type: 'draw' });
  assert.equal(next.lastAction, 'pass');
  assert.equal(next.turn, 1);
  assert.equal(next.emptyPoolPasses, 1);
});

test('clients cannot forge the internal Classic timeout action', () => {
  assert.throws(
    () => parseClassicDigitalMove({ type: '__classic-timeout__' }),
    /invalid-move/,
  );
});
