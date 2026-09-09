import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chooseChessExpertMove } from '../packages/games/chess/expert.ts';
import { applyChess, chessLegalMoves } from '../packages/games/chess/rules.ts';
import { createChess } from '../packages/games/chess/state.ts';

const moveKey = (move: { from: number; to: number; promotion?: string }) =>
  `${move.from}-${move.to}-${move.promotion ?? ''}`;

test('Chess AI has one dedicated expert route instead of shared difficulty behavior', () => {
  const worker = readFileSync('apps/mobile/src/ai.worker.ts', 'utf8');
  const css = readFileSync('apps/mobile/src/chess.css', 'utf8');
  assert.match(worker, /state\.gameId === 'chess'/);
  assert.match(worker, /chooseChessExpertMove\(state as ChessState\)/);
  assert.match(css, /fixed AI strength: the dedicated expert engine/);
  assert.match(css, /mode-card:nth-child\(2\)\.selected/);
});

test('Chess expert uses a deterministic principled opening response', () => {
  let state = createChess();
  state = applyChess(state, { from: 52, to: 36 }); // 1.e4
  const move = chooseChessExpertMove(state);
  assert.deepEqual(move, { from: 10, to: 26 }); // ...c5 Sicilian Defence
  assert.ok(chessLegalMoves(state).some((candidate) => moveKey(candidate) === moveKey(move!)));
});

test('Chess expert finds the immediate checkmate in the Fools Mate pattern', () => {
  let state = createChess();
  state = applyChess(state, { from: 53, to: 45 }); // 1.f3
  state = applyChess(state, { from: 12, to: 28 }); // ...e5
  state = applyChess(state, { from: 54, to: 38 }); // 2.g4

  const move = chooseChessExpertMove(state, {
    useBook: false,
    budgetMs: 800,
    maxDepth: 4,
  });
  assert.deepEqual(move, { from: 3, to: 39 }); // ...Qh4#
  const final = applyChess(state, move!);
  assert.equal(final.winner, 1);
  assert.equal(final.inCheck, true);
});

test('Chess expert always returns a legal move under a short bounded search', () => {
  let state = createChess();
  state = applyChess(state, { from: 51, to: 35 }); // 1.d4
  state = applyChess(state, { from: 6, to: 21 }); // ...Nf6
  state = applyChess(state, { from: 50, to: 34 }); // 2.c4

  const legal = chessLegalMoves(state);
  const move = chooseChessExpertMove(state, {
    useBook: false,
    budgetMs: 250,
    maxDepth: 3,
  });
  assert.ok(move);
  assert.ok(legal.some((candidate) => moveKey(candidate) === moveKey(move)));
});
