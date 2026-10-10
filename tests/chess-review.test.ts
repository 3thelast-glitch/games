import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeChessEvaluation,
  analyzeChessStrategicPosition,
  reviewChessMove,
} from '../packages/games/chess/expert.ts';
import {
  chessEvaluationWhitePercent,
  chessMoveAccuracy,
  chessMoveGrade,
  chessMoveNotation,
  formatChessEvaluation,
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

test('Chess evaluation model exposes a neutral starting bar and strategic profile', () => {
  const state = createChess();
  const evaluation = analyzeChessEvaluation(state);
  assert.equal(evaluation.mate, null);
  assert.ok(evaluation.whitePercent >= 40 && evaluation.whitePercent <= 60);
  assert.equal(chessEvaluationWhitePercent(0), 50);
  assert.equal(formatChessEvaluation({ centipawns: 84, mate: null, whitePercent: 56 }), '+0.8');

  const strategy = analyzeChessStrategicPosition(state);
  for (const side of [strategy.white, strategy.black]) {
    for (const value of Object.values(side)) {
      assert.ok(value >= 0 && value <= 100);
    }
  }
  assert.equal(strategy.white.material, 50);
  assert.equal(strategy.black.material, 50);
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
  assert.ok(review?.evaluationBefore);
  assert.ok(review?.evaluationAfter);
  assert.equal(review?.evaluationAfter?.mate, 0);
  assert.equal(review?.evaluationAfter?.whitePercent, 0);
  assert.ok(review?.strategicAfter);
  assert.equal(Object.keys(review?.strategicAfter?.white ?? {}).length, 10);
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

  reviews[0].evaluationAfter = { centipawns: 20, mate: null, whitePercent: 52 };
  reviews[0].strategicAfter = analyzeChessStrategicPosition(createChess());
  reviews[1].evaluationAfter = { centipawns: -15, mate: null, whitePercent: 49 };
  reviews[1].strategicAfter = analyzeChessStrategicPosition(createChess());
  reviews[2].evaluationAfter = { centipawns: -180, mate: null, whitePercent: 36 };
  reviews[2].strategicAfter = analyzeChessStrategicPosition(createChess());

  const summary = summarizeChessReviews(reviews);
  assert.equal(summary.totalMoves, 3);
  assert.equal(summary.players[0].moves, 2);
  assert.equal(summary.players[0].accuracy, 70);
  assert.equal(summary.players[0].grades.best, 1);
  assert.equal(summary.players[0].grades.mistake, 1);
  assert.equal(summary.players[1].accuracy, 92);
  assert.equal(summary.players[1].grades.excellent, 1);
  assert.equal(summary.quality, 81);
  assert.equal(summary.turningPoint?.ply, 3);
  assert.equal(summary.players[0].biggestMistake?.ply, 3);
  assert.equal(summary.players[0].bestMove?.ply, 1);
  assert.equal(summary.finalEvaluation?.centipawns, -180);
  assert.ok(summary.finalStrategic);
});
