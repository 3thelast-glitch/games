import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WORM_LEVEL_COUNT, findWormSolution, moveWorm, restoreWorm, startWorm, wormLevel,
  type Direction,
} from '../packages/games/apple-worm/engine.ts';

test('Apple Worm has thirty distinct, valid original offline levels', () => {
  assert.equal(WORM_LEVEL_COUNT, 30);
  const layouts = new Set<string>();
  for (let level = 1; level <= WORM_LEVEL_COUNT; level++) {
    const board = wormLevel(level);
    const blocks = new Set(board.blocks.map(p => p.x + ':' + p.y));
    assert.equal(board.number, level);
    assert.ok(!blocks.has(board.apple.x + ':' + board.apple.y), 'apple on ground: ' + level);
    assert.ok(!blocks.has(board.portal.x + ':' + board.portal.y), 'portal on ground: ' + level);
    assert.ok(!board.start.some(p => blocks.has(p.x + ':' + p.y)));
    layouts.add(JSON.stringify([board.width, board.blocks, board.apple, board.portal, board.spikes]));
  }
  assert.equal(layouts.size, 30);
  assert.throws(() => wormLevel(0), RangeError);
  assert.throws(() => wormLevel(31), RangeError);
});

test('Apple Worm: each of the thirty levels has a valid solution with gravity', () => {
  for (let level = 1; level <= WORM_LEVEL_COUNT; level++) {
    let state = startWorm(level);
    const solution = findWormSolution(state);
    assert.ok(solution && solution.length > 0, 'unsolvable level ' + level);
    for (const move of solution as Direction[]) {
      const next = moveWorm(state, move);
      assert.notEqual(next, state, 'invalid step in level ' + level);
      assert.notEqual(next.phase, 'lost', 'fatal solution for level ' + level);
      state = next;
    }
    assert.equal(state.phase, 'won', 'did not reach exit in level ' + level);
    assert.equal(state.eaten, true, 'did not eat apple in level ' + level);
    assert.equal(state.body.length, 3, 'did not grow in level ' + level);
  }
});

test('Apple Worm: eat to grow, do not mutate input and never move through ground', () => {
  const initial = startWorm(1);
  const after = moveWorm(initial, 'right');
  assert.notEqual(initial, after);
  assert.equal(initial.body.length, 2);
  assert.equal(initial.moves, 0);
  assert.equal(after.moves, 1);
  const eaten = moveWorm(after, 'right');
  assert.equal(eaten.eaten, true);
  assert.equal(eaten.body.length, 3);
  const invalid = moveWorm(eaten, 'down');
  assert.equal(invalid, eaten);
});

test('Apple Worm: restore only valid and bounded saves', () => {
  assert.deepEqual(restoreWorm(startWorm(1)), startWorm(1));
  assert.equal(restoreWorm({ level: 999, body: [], eaten: false, phase: 'playing', moves: 0 }), null);
  assert.equal(restoreWorm({ ...startWorm(1), body: [{ x: 1, y: 6 }, { x: 1, y: 6 }] }), null);
  assert.equal(restoreWorm({ ...startWorm(1), moves: -1 }), null);
  assert.equal(restoreWorm(null), null);
});
