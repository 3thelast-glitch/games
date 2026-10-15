import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChessGuidance, explainChessGuidance } from '../packages/games/chess/guidance.ts';
import { applyChess, chessLegalMoves } from '../packages/games/chess/rules.ts';
import { createChess } from '../packages/games/chess/state.ts';

test('beginner guidance only accepts a legal move from the current position', () => {
  const state = createChess();
  const suggestion = buildChessGuidance(state, { from: 52, to: 36 });
  assert.ok(suggestion);
  assert.equal(suggestion?.positionPly, 0);
  assert.deepEqual(suggestion?.move, { from: 52, to: 36 });
  assert.ok(suggestion?.legalDestinations.includes(44));
  assert.ok(suggestion?.legalDestinations.includes(36));
  assert.equal(buildChessGuidance(state, { from: 52, to: 28 }), null);
});

test('guidance identifies development and current-position captures', () => {
  const state = createChess();
  assert.equal(explainChessGuidance(state, { from: 62, to: 45 }), 'development');

  let next = applyChess(state, { from: 52, to: 36 });
  next = applyChess(next, { from: 11, to: 27 });
  const capture = buildChessGuidance(next, { from: 36, to: 27 });
  assert.ok(capture);
  assert.equal(capture?.reason, 'capture');
  assert.ok(capture?.captureDestinations.includes(27));
});

test('every emitted guidance destination belongs to the selected piece legal moves', () => {
  const state = createChess();
  const suggestion = buildChessGuidance(state, { from: 62, to: 45 });
  assert.ok(suggestion);
  const legal = chessLegalMoves(state)
    .filter((move) => move.from === suggestion?.move.from)
    .map((move) => move.to)
    .sort((a, b) => a - b);
  assert.deepEqual([...suggestion!.legalDestinations].sort((a, b) => a - b), [...new Set(legal)]);
});
