import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseMove } from '../packages/core/src/ai.ts';
import { games } from '../packages/games/registry.ts';
import {
  applyDotsAndBoxes,
  dotsAndBoxesEngine,
  parseDotsAndBoxesMove,
} from '../packages/games/dots-and-boxes/rules.ts';
import {
  boxIndex,
  createDotsAndBoxes,
  horizontalEdgeIndex,
  verticalEdgeIndex,
} from '../packages/games/dots-and-boxes/state.ts';

test('Dots and Boxes starts with a 5x5 field and 60 legal edges', () => {
  const state = createDotsAndBoxes();
  assert.equal(state.boxRows, 5);
  assert.equal(state.boxCols, 5);
  assert.equal(state.boxes.length, 25);
  assert.equal(state.horizontalEdges.length, 30);
  assert.equal(state.verticalEdges.length, 30);
  assert.deepEqual(state.scores, [0, 0]);
  assert.equal(dotsAndBoxesEngine.legalMoves(state).length, 60);
  assert.equal(games.get('dotsAndBoxes').id, 'dotsAndBoxes');
});

test('Dots and Boxes rejects malformed, out-of-range and duplicate edges', () => {
  const state = createDotsAndBoxes();
  for (const move of [
    null,
    {},
    { orientation: 'x', row: 0, col: 0 },
    { orientation: 'h', row: -1, col: 0 },
    { orientation: 'h', row: 0.5, col: 0 },
    { orientation: 'h', row: 0, col: 0, winner: 0 },
  ])
    assert.throws(() => parseDotsAndBoxesMove(move));
  assert.throws(() => applyDotsAndBoxes(state, { orientation: 'h', row: 6, col: 0 }), /invalid-edge/);
  const next = applyDotsAndBoxes(state, { orientation: 'h', row: 0, col: 0 });
  assert.throws(() => applyDotsAndBoxes(next, { orientation: 'h', row: 0, col: 0 }), /edge-drawn/);
});

test('a normal edge passes the turn without mutating the previous state', () => {
  const state = createDotsAndBoxes();
  const before = structuredClone(state);
  const next = applyDotsAndBoxes(state, { orientation: 'h', row: 0, col: 0 });
  assert.deepEqual(state, before);
  assert.equal(next.turn, 1);
  assert.equal(next.ply, 1);
  assert.equal(next.horizontalEdges[0], 0);
  assert.deepEqual(next.scores, [0, 0]);
});

test('completing a box claims it, scores and keeps the same turn', () => {
  const state = createDotsAndBoxes(1, 1);
  state.horizontalEdges[horizontalEdgeIndex(state, 0, 0)] = 0;
  state.horizontalEdges[horizontalEdgeIndex(state, 1, 0)] = 1;
  state.verticalEdges[verticalEdgeIndex(state, 0, 0)] = 0;
  state.turn = 1;
  const next = applyDotsAndBoxes(state, { orientation: 'v', row: 0, col: 1 });
  assert.equal(next.boxes[0], 1);
  assert.deepEqual(next.scores, [0, 1]);
  assert.equal(next.turn, 1);
  assert.equal(next.winner, 1);
});

test('one edge can complete two adjacent boxes and awards both points', () => {
  const state = createDotsAndBoxes(1, 2);
  for (const col of [0, 1]) {
    state.horizontalEdges[horizontalEdgeIndex(state, 0, col)] = 0;
    state.horizontalEdges[horizontalEdgeIndex(state, 1, col)] = 1;
  }
  state.verticalEdges[verticalEdgeIndex(state, 0, 0)] = 0;
  state.verticalEdges[verticalEdgeIndex(state, 0, 2)] = 1;
  const next = applyDotsAndBoxes(state, { orientation: 'v', row: 0, col: 1 });
  assert.deepEqual(next.boxes, [0, 0]);
  assert.deepEqual(next.scores, [2, 0]);
  assert.equal(next.winner, 0);
});

test('the final edge resolves a winner from box scores', () => {
  const state = createDotsAndBoxes(2, 2);
  state.horizontalEdges.fill(0);
  state.verticalEdges.fill(1);
  const finalIndex = horizontalEdgeIndex(state, 2, 1);
  state.horizontalEdges[finalIndex] = null;
  state.boxes = [0, 0, 0, null];
  state.scores = [3, 0];
  state.turn = 1;
  const next = applyDotsAndBoxes(state, { orientation: 'h', row: 2, col: 1 });
  assert.equal(next.boxes[boxIndex(next, 1, 1)], 1);
  assert.deepEqual(next.scores, [3, 1]);
  assert.equal(next.winner, 0);
  assert.equal(next.drawReason, null);
  assert.deepEqual(dotsAndBoxesEngine.legalMoves(next), []);
});

test('an even custom board can resolve a score tie', () => {
  const state = createDotsAndBoxes(2, 2);
  state.horizontalEdges.fill(0);
  state.verticalEdges.fill(1);
  state.horizontalEdges[horizontalEdgeIndex(state, 2, 1)] = null;
  state.boxes = [0, 1, 0, null];
  state.scores = [2, 1];
  state.turn = 1;
  const next = applyDotsAndBoxes(state, { orientation: 'h', row: 2, col: 1 });
  assert.deepEqual(next.scores, [2, 2]);
  assert.equal(next.winner, null);
  assert.equal(next.drawReason, 'score-tie');
});

test('all AI levels return a legal move and stop after the match ends', () => {
  const game = games.get('dotsAndBoxes');
  const state = createDotsAndBoxes(1, 1);
  state.horizontalEdges[0] = 0;
  state.horizontalEdges[1] = 1;
  state.verticalEdges[0] = 0;
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    const move = chooseMove(game, state, difficulty, { budgetMs: 60, random: () => 0 });
    assert.deepEqual(move, { orientation: 'v', row: 0, col: 1 });
    assert.doesNotThrow(() => game.apply(state, move));
  }
  const finished = applyDotsAndBoxes(state, { orientation: 'v', row: 0, col: 1 });
  assert.equal(chooseMove(game, finished, 'easy'), null);
});

test('Dots and Boxes state remains JSON serializable for local and online controllers', () => {
  const game = games.get('dotsAndBoxes');
  let state = game.create();
  state = game.apply(state, { orientation: 'h', row: 0, col: 0 });
  state = game.apply(state, { orientation: 'v', row: 0, col: 0 });
  const restored = JSON.parse(JSON.stringify(state));
  assert.deepEqual(restored, state);
  assert.doesNotThrow(() => game.apply(restored, game.legalMoves(restored)[0]));
});
