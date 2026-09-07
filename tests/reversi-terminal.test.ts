import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyReversi, calculateReversiScore, hasReversiLegalMove } from '../packages/games/reversi/rules.ts';
import { createReversi, reversiIndex } from '../packages/games/reversi/state.ts';

test('Reversi ends when neither player can move even with empty squares remaining', () => {
  const state = createReversi();
  state.board.fill(null);
  state.board[reversiIndex(0, 1)] = 1;
  state.board[reversiIndex(0, 2)] = 0;
  state.scores = calculateReversiScore(state.board);
  state.turn = 0;

  const final = applyReversi(state, { row: 0, col: 0 });

  assert.equal(final.board.filter((cell) => cell !== null).length, 3);
  assert.equal(hasReversiLegalMove(final.board, 0), false);
  assert.equal(hasReversiLegalMove(final.board, 1), false);
  assert.deepEqual(final.scores, [3, 0]);
  assert.equal(final.winner, 0);
  assert.equal(final.drawReason, null);
});
