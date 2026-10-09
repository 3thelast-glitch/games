import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BLACK_OPENING_REPERTOIRE,
  BLACK_STRATEGIC_IDEAS,
  chooseChessExpertMove,
} from '../packages/games/chess/expert.ts';
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

test('Chess expert opening repertoire includes the requested first-move families', () => {
  assert.deepEqual(
    BLACK_OPENING_REPERTOIRE.map((entry) => entry.whiteFirstMove),
    ['e4', 'd4', 'c4', 'Nf3'],
  );
  const names = BLACK_OPENING_REPERTOIRE.flatMap((entry) => entry.replies.map((reply) => reply.name));
  for (const expected of [
    'Sicilian Defence',
    'Open Game',
    'French Defense',
    'Caro-Kann',
    'Scandinavian Defense',
    'Pirc Defense',
    "Alekhine's Defense",
    'Indian Defenses',
    "Queen's Pawn Game",
    'Dutch Defense',
    'Benoni Defense',
    'Reversed English',
    'Symmetrical English',
    'Anglo-Indian Defense',
    'Réti: ...d5',
    'Symmetrical Réti',
  ]) {
    assert.ok(names.includes(expected), expected);
  }
});

test('Chess expert can vary all seven black replies to 1.e4 while staying legal', () => {
  let state = createChess();
  state = applyChess(state, { from: 52, to: 36 }); // 1.e4
  const expected = [
    '10-26-', // ...c5 Sicilian
    '12-28-', // ...e5 Open Game
    '12-20-', // ...e6 French
    '10-18-', // ...c6 Caro-Kann
    '11-27-', // ...d5 Scandinavian
    '11-19-', // ...d6 Pirc
    '6-21-',  // ...Nf6 Alekhine
  ];
  const actual = expected.map((_, index) => {
    const move = chooseChessExpertMove(state, {
      random: () => (index + 0.1) / expected.length,
    });
    assert.ok(move);
    assert.ok(chessLegalMoves(state).some((candidate) => moveKey(candidate) === moveKey(move)));
    return moveKey(move!);
  });
  assert.deepEqual(actual, expected);
});

test('Chess expert keeps Sicilian as the first deterministic injected repertoire choice', () => {
  let state = createChess();
  state = applyChess(state, { from: 52, to: 36 }); // 1.e4
  const move = chooseChessExpertMove(state, { random: () => 0 });
  assert.deepEqual(move, { from: 10, to: 26 }); // ...c5 Sicilian Defence
});

test('Chess expert branches Indian setups into e6, g6, or c5 follow-ups', () => {
  const expected = [
    { roll: 0, move: '12-20-' },   // ...e6 Nimzo/Queen's Indian structures
    { roll: 0.5, move: '14-22-' }, // ...g6 King's Indian
    { roll: 0.99, move: '10-26-' },// ...c5 Benoni
  ];
  for (const item of expected) {
    let state = createChess();
    state = applyChess(state, { from: 51, to: 35 }); // 1.d4
    state = applyChess(state, { from: 6, to: 21 });  // ...Nf6
    state = applyChess(state, { from: 50, to: 34 }); // 2.c4
    const move = chooseChessExpertMove(state, { random: () => item.roll });
    assert.ok(move);
    assert.equal(moveKey(move!), item.move);
  }
});

test('Chess expert recognizes the Benko ...b5 pawn-sacrifice motif', () => {
  let state = createChess();
  state = applyChess(state, { from: 51, to: 35 }); // 1.d4
  state = applyChess(state, { from: 6, to: 21 });  // ...Nf6
  state = applyChess(state, { from: 50, to: 34 }); // 2.c4
  state = applyChess(state, { from: 10, to: 26 }); // ...c5
  state = applyChess(state, { from: 35, to: 27 }); // 3.d5
  const move = chooseChessExpertMove(state, { random: () => 0 });
  assert.deepEqual(move, { from: 9, to: 25 }); // ...b5 Benko Gambit
});

test('Chess expert advertises and evaluates the requested strategic motif set', () => {
  const names = BLACK_STRATEGIC_IDEAS.map((idea) => idea.name);
  for (const expected of [
    'Fianchetto',
    'Undermining the Center',
    'Pawn Chain Break',
    'Prophylaxis',
    'The Blockade',
    'Minority Attack',
    'Outpost Creation',
    'Pawn Storm',
    'The Exchange Sacrifice',
  ]) {
    assert.ok(names.includes(expected), expected);
  }
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
