import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewChessMove } from '../packages/games/chess/expert.ts';
import {
  chessMoveAccuracy,
  chessMoveGrade,
  chessMoveNotation,
  summarizeChessReviews,
  type ChessMoveReview,
} from '../packages/games/chess/review.ts';
import { applyChess } from '../packages/games/chess/rules.ts';
import { createChess } from '../packages/games/chess/state.ts';

test('Chess move review notation and grade thresholds are stable', () => {
  assert.equal(chessMoveNotation({ from: 52, to: 36 }), 'e2–e4');
  assert.equal(chessMoveNotation({ from: 8, to: 0, promotion: 'knight' }), 'a7–a8=N');
  assert.equal(chessMoveGrade(0, true), 'best');
  assert.equal(chessMoveGrade(25), 'excellent');
  assert.equal(chessMoveGrade(60), 'good');
  assert.equal(chessMoveGrade(120), 'inaccuracy');
  assert.equal(chessMoveGrade(250), 'mistake');
  assert.equal(chessMoveGrade(400), 'blunder');
  assert.equal(chessMoveAccuracy(0, true), 100);
  assert.ok(chessMoveAccuracy(80) < 100);
  assert.ok(chessMoveAccuracy(80) > chessMoveAccuracy(300));
});

test('Chess move review marks an immediate forced mate as Best with 100% accuracy', () => {
  let state = createChess();
  state = applyChess(state, { from: 53, to: 45 }); // 1.f3
  state = applyChess(state, { from: 12, to: 28 }); // ...e5
  state = applyChess(state, { from: 54, to: 38 }); // 2.g4

  const review = reviewChessMove(
    state,
    { from: 3, to: 39 }, // ...Qh4#
    { budgetMs: 800, maxDepth: 4 },
  );
  assert.ok(review);
  assert.equal(review?.grade, 'best');
  assert.equal(review?.accuracy, 100);
  assert.equal(review?.centipawnLoss, 0);
  assert.equal(review?.notation, 'd8–h4');
  assert.equal(review?.bestNotation, 'd8–h4');
});

test('Chess game review summarizes both players independently and computes game quality', () => {
  const reviews: ChessMoveReview[] = [
    {
      player: 0,
      ply: 1,
      move: { from: 52, to: 36 },
      notation: 'e2–e4',
      grade: 'best',
      accuracy: 100,
      centipawnLoss: 0,
      bestMove: { from: 52, to: 36 },
      bestNotation: 'e2–e4',
    },
    {
      player: 1,
      ply: 2,
      move: { from: 10, to: 26 },
      notation: 'c7–c5',
      grade: 'excellent',
      accuracy: 92,
      centipawnLoss: 15,
      bestMove: { from: 10, to: 26 },
      bestNotation: 'c7–c5',
    },
    {
      player: 0,
      ply: 3,
      move: { from: 62, to: 45 },
      notation: 'g1–f3',
      grade: 'mistake',
      accuracy: 40,
      centipawnLoss: 165,
      bestMove: { from: 57, to: 42 },
      bestNotation: 'b1–c3',
    },
  ];

  const summary = summarizeChessReviews(reviews);
  assert.equal(summary.totalMoves, 3);
  assert.equal(summary.players[0].moves, 2);
  assert.equal(summary.players[0].accuracy, 70);
  assert.equal(summary.players[0].grades.best, 1);
  assert.equal(summary.players[0].grades.mistake, 1);
  assert.equal(summary.players[1].accuracy, 92);
  assert.equal(summary.players[1].grades.excellent, 1);
  assert.equal(summary.quality, 81);
});
