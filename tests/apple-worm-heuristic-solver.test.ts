import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveAppleWormLevelHeuristic } from '../packages/games/apple-worm/heuristic-solver.ts';
import { replayAppleWormRoute } from '../packages/games/apple-worm/solvability.ts';

/**
 * The heuristic solver must be a *search-order* improvement only: same
 * engine, same honesty rules as the BFS solver. A "won" here is always
 * backed by a full replay through the real engine.
 */
test('heuristic solver re-solves known proven stages with replayable routes', () => {
  for (const level of [1, 11, 25]) {
    const result = solveAppleWormLevelHeuristic(level, { maxStates: 50_000, maxMillis: 30_000 });
    assert.equal(result.status, 'won', `stage ${level} should be solved`);
    assert.ok(result.route && result.routeLength && result.routeLength > 0);
    const replay = replayAppleWormRoute(level, result.route!, { source: 'full-video' });
    assert.equal(replay.won, true, `route for stage ${level} must replay to a win`);
    assert.equal(replay.legalMoves, result.route!.length);
  }
});

test('heuristic solver reports budget honestly on a tiny state cap', () => {
  const result = solveAppleWormLevelHeuristic(83, { maxStates: 5, maxMillis: 30_000 });
  assert.equal(result.status, 'budget');
  assert.equal(result.route, null);
});

test('heuristic solver validates its options', () => {
  assert.throws(() => solveAppleWormLevelHeuristic(1, { maxStates: 0 }), RangeError);
  assert.throws(() => solveAppleWormLevelHeuristic(1, { weight: 0.5 }), RangeError);
});
