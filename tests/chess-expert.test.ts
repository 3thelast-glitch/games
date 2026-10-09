import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BLACK_OPENING_FOLLOW_UPS,
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
    ['e4', 'd4', 'c4', 'Nf3', 'f4'],
  );
  const names = new Set<string>(
    BLACK_OPENING_REPERTOIRE.flatMap((entry) => entry.replies.map((reply) => reply.name)),
  );
  for (const expected of [
    'Sicilian Defence',
    'Open Game',
    'French Defense',
    'Caro-Kann',
    'Scandinavian Defense',
    'Pirc Defense',
    "Alekhine's Defense",
    'Modern Defense',
    'Nimzowitsch Defense',
    "Owen's Defense",
    'St. George Defense',
    'Indian Defenses',
    "Queen's Pawn Game",
    'Dutch Defense',
    'Benoni Defense',
    'Englund Gambit',
    'Reversed English',
    'Symmetrical English',
    'Anglo-Indian Defense',
    'Réti: ...d5',
    'Symmetrical Réti',
    "From's Gambit",
  ]) {
    assert.ok(names.has(expected), expected);
  }
});

test('Chess expert can vary all eleven direct black replies to 1.e4 while staying legal', () => {
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
    '14-22-', // ...g6 Modern
    '1-18-',  // ...Nc6 Nimzowitsch
    '9-17-',  // ...b6 Owen
    '8-16-',  // ...a6 St. George
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

test('Chess expert branches Indian setups across five major structures', () => {
  const expected = [
    { roll: 0, move: '12-20-' },    // ...e6 Nimzo/Queen's Indian
    { roll: 0.21, move: '14-22-' }, // ...g6 King's Indian / Grünfeld
    { roll: 0.41, move: '10-26-' }, // ...c5 Benoni
    { roll: 0.61, move: '11-19-' }, // ...d6 Old Indian
    { roll: 0.99, move: '12-28-' }, // ...e5 Budapest
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

test('Chess expert varies classical, Petroff, Philidor, Latvian, and Elephant paths after 1.e4 e5 2.Nf3', () => {
  const expected = [
    { roll: 0, move: '6-21-' },      // ...Nf6 Petroff
    { roll: 0.21, move: '11-19-' },  // ...d6 Philidor
    { roll: 0.41, move: '1-18-' },   // ...Nc6 classical Open Game
    { roll: 0.61, move: '13-29-' },  // ...f5 Latvian Gambit
    { roll: 0.99, move: '11-27-' },  // ...d5 Elephant Gambit
  ];
  for (const item of expected) {
    let state = createChess();
    state = applyChess(state, { from: 52, to: 36 }); // 1.e4
    state = applyChess(state, { from: 12, to: 28 }); // ...e5
    state = applyChess(state, { from: 62, to: 45 }); // 2.Nf3
    const move = chooseChessExpertMove(state, { random: () => item.roll });
    assert.ok(move);
    assert.ok(chessLegalMoves(state).some((candidate) => moveKey(candidate) === moveKey(move)));
    assert.equal(moveKey(move!), item.move);
  }
});

test('Chess expert follows Modern, Nimzowitsch, Owen, and St. George plans', () => {
  const cases = [
    {
      blackFirst: { from: 14, to: 22 }, // ...g6
      expected: '5-14-',                // ...Bg7
    },
    {
      blackFirst: { from: 1, to: 18 },  // ...Nc6
      expected: '11-27-',               // ...d5
    },
    {
      blackFirst: { from: 9, to: 17 },  // ...b6
      expected: '2-9-',                 // ...Bb7
    },
    {
      blackFirst: { from: 8, to: 16 },  // ...a6
      expected: '9-25-',                // ...b5
    },
  ];
  for (const item of cases) {
    let state = createChess();
    state = applyChess(state, { from: 52, to: 36 }); // 1.e4
    state = applyChess(state, item.blackFirst);
    state = applyChess(state, { from: 51, to: 35 }); // 2.d4
    const move = chooseChessExpertMove(state, { random: () => 0 });
    assert.ok(move);
    assert.equal(moveKey(move!), item.expected);
  }
});

test('Chess expert supports Slav, Chigorin, Albin, Baltic, and Tarrasch setups after 1.d4 d5 2.c4', () => {
  const expected = [
    { roll: 0, move: '10-18-' },     // ...c6 Slav
    { roll: 0.21, move: '1-18-' },   // ...Nc6 Chigorin
    { roll: 0.41, move: '12-28-' },  // ...e5 Albin
    { roll: 0.61, move: '2-29-' },   // ...Bf5 Baltic
    { roll: 0.99, move: '12-20-' },  // ...e6 Tarrasch setup
  ];
  for (const item of expected) {
    let state = createChess();
    state = applyChess(state, { from: 51, to: 35 }); // 1.d4
    state = applyChess(state, { from: 11, to: 27 }); // ...d5
    state = applyChess(state, { from: 50, to: 34 }); // 2.c4
    const move = chooseChessExpertMove(state, { random: () => item.roll });
    assert.ok(move);
    assert.ok(chessLegalMoves(state).some((candidate) => moveKey(candidate) === moveKey(move)));
    assert.equal(moveKey(move!), item.move);
  }
});

test("Chess expert answers 1.f4 with From's Gambit", () => {
  let state = createChess();
  state = applyChess(state, { from: 53, to: 37 }); // 1.f4
  const move = chooseChessExpertMove(state, { random: () => 0 });
  assert.deepEqual(move, { from: 12, to: 28 }); // ...e5
  assert.ok(chessLegalMoves(state).some((candidate) => moveKey(candidate) === moveKey(move!)));
});

test('Chess expert continues the Tarrasch setup with ...c5', () => {
  let state = createChess();
  state = applyChess(state, { from: 51, to: 35 }); // 1.d4
  state = applyChess(state, { from: 11, to: 27 }); // ...d5
  state = applyChess(state, { from: 50, to: 34 }); // 2.c4
  state = applyChess(state, { from: 12, to: 20 }); // ...e6
  state = applyChess(state, { from: 62, to: 45 }); // 3.Nf3
  const move = chooseChessExpertMove(state, { random: () => 0 });
  assert.deepEqual(move, { from: 10, to: 26 }); // ...c5
});

test('Chess expert continues Slav into a Semi-Slav structure', () => {
  let state = createChess();
  state = applyChess(state, { from: 51, to: 35 }); // 1.d4
  state = applyChess(state, { from: 11, to: 27 }); // ...d5
  state = applyChess(state, { from: 50, to: 34 }); // 2.c4
  state = applyChess(state, { from: 10, to: 18 }); // ...c6
  state = applyChess(state, { from: 62, to: 45 }); // 3.Nf3
  const move = chooseChessExpertMove(state, { random: () => 0 });
  assert.deepEqual(move, { from: 12, to: 20 }); // ...e6
});

test('Chess expert reaches Nimzo, Queen’s Indian, Grünfeld, and Old Indian continuations', () => {
  {
    let state = createChess();
    state = applyChess(state, { from: 51, to: 35 }); // d4
    state = applyChess(state, { from: 6, to: 21 });  // ...Nf6
    state = applyChess(state, { from: 50, to: 34 }); // c4
    state = applyChess(state, { from: 12, to: 20 }); // ...e6
    state = applyChess(state, { from: 57, to: 42 }); // Nc3
    assert.deepEqual(chooseChessExpertMove(state, { random: () => 0 }), { from: 5, to: 33 }); // ...Bb4
  }
  {
    let state = createChess();
    state = applyChess(state, { from: 51, to: 35 });
    state = applyChess(state, { from: 6, to: 21 });
    state = applyChess(state, { from: 50, to: 34 });
    state = applyChess(state, { from: 12, to: 20 });
    state = applyChess(state, { from: 62, to: 45 }); // Nf3
    assert.deepEqual(chooseChessExpertMove(state, { random: () => 0 }), { from: 9, to: 17 }); // ...b6
  }
  {
    let state = createChess();
    state = applyChess(state, { from: 51, to: 35 });
    state = applyChess(state, { from: 6, to: 21 });
    state = applyChess(state, { from: 50, to: 34 });
    state = applyChess(state, { from: 14, to: 22 }); // ...g6
    state = applyChess(state, { from: 57, to: 42 }); // Nc3
    assert.deepEqual(chooseChessExpertMove(state, { random: () => 0 }), { from: 11, to: 27 }); // ...d5
  }
  {
    let state = createChess();
    state = applyChess(state, { from: 51, to: 35 });
    state = applyChess(state, { from: 6, to: 21 });
    state = applyChess(state, { from: 50, to: 34 });
    state = applyChess(state, { from: 11, to: 19 }); // ...d6
    state = applyChess(state, { from: 57, to: 42 }); // Nc3
    assert.deepEqual(chooseChessExpertMove(state, { random: () => 0 }), { from: 1, to: 11 }); // ...Nbd7
  }
});

test('Chess expert recognizes the Blumenfeld ...b5 motif', () => {
  let state = createChess();
  state = applyChess(state, { from: 51, to: 35 }); // 1.d4
  state = applyChess(state, { from: 6, to: 21 });  // ...Nf6
  state = applyChess(state, { from: 50, to: 34 }); // 2.c4
  state = applyChess(state, { from: 12, to: 20 }); // ...e6
  state = applyChess(state, { from: 62, to: 45 }); // 3.Nf3
  state = applyChess(state, { from: 10, to: 26 }); // ...c5
  state = applyChess(state, { from: 35, to: 27 }); // 4.d5
  assert.deepEqual(chooseChessExpertMove(state, { random: () => 0 }), { from: 9, to: 25 }); // ...b5
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

test('Chess expert exposes the requested deeper black opening plans', () => {
  const names = new Set<string>(BLACK_OPENING_FOLLOW_UPS.map((plan) => plan.name));
  for (const expected of [
    'Latvian Gambit',
    'Elephant Gambit',
    'Albin Countergambit',
    'Tarrasch Defense',
    'Baltic Defense',
    "From's Gambit",
    'Petroff Defense',
    'Philidor Defense',
    'Modern Defense fianchetto',
    'Nimzowitsch Defense center strike',
    "Owen's Defense fianchetto",
    'St. George queenside expansion',
    'Nimzo-Indian Defense',
    "King's Indian Defense",
    'Grünfeld Defense',
    "Queen's Indian Defense",
    'Budapest Gambit',
    'Old Indian Defense',
    'Benko Gambit',
    'Blumenfeld Gambit',
    'Slav Defense',
    'Semi-Slav Defense',
    'Chigorin Defense',
    'French ...d5 break',
    'Caro-Kann ...d5 break',
    'Pirc fianchetto setup',
    'Alekhine retreat to d5',
    'Open Game development',
    'Scandinavian recapture',
  ]) {
    assert.ok(names.has(expected), expected);
  }
});

test('Chess expert advertises and evaluates the requested strategic motif set', () => {
  const names = new Set<string>(BLACK_STRATEGIC_IDEAS.map((idea) => idea.name));
  for (const expected of [
    'Deflection',
    'Decoy',
    'The Pin',
    'The Skewer',
    'Discovered Attack',
    'Fianchetto',
    'Undermining the Center',
    'Pawn Chain Break',
    'Isolated Queen Pawn',
    'Prophylaxis',
    'The Blockade',
    'Minority Attack',
    'Outpost Creation',
    'Good vs Bad Bishop',
    'Pawn Storm',
    'Zugzwang',
    'Overloading',
    'The Exchange Sacrifice',
    'Interference',
    'X-Ray Attack',
    'Battery',
    'Zwischenzug',
    'Smothered Mate',
    'The Windmill',
    'Underpromotion',
    'Clearance Sacrifice',
    'The Desperado Piece',
    'Luft',
    'Hanging Pawns',
    'Backward Pawn',
    'Overprotection',
    'Triangulation',
    'The Opposition',
  ]) {
    assert.ok(names.has(expected), expected);
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
