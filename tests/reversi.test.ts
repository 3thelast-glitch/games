import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseMove } from '../packages/core/src/ai.ts';
import { asPlugin, type Difficulty } from '../packages/core/src/game.ts';
import { games } from '../packages/games/registry.ts';
import {
  REVERSI_DIRECTIONS,
  applyReversi,
  calculateReversiScore,
  determineReversiWinner,
  getCapturedDiscsForMove,
  getCapturedDiscsInDirection,
  getReversiLegalMoves,
  hasReversiLegalMove,
  isLegalReversiMove,
  parseReversiMove,
  reversiEngine,
  validateReversi,
} from '../packages/games/reversi/rules.ts';
import {
  REVERSI_CELLS,
  REVERSI_SIZE,
  createReversi,
  reversiIndex,
  type ReversiCell,
  type ReversiState,
} from '../packages/games/reversi/state.ts';

function emptyReversi(): ReversiState {
  const state = createReversi();
  state.board.fill(null);
  state.scores = [0, 0];
  state.turn = 0;
  state.ply = 0;
  state.winner = null;
  state.drawReason = null;
  state.lastMove = null;
  state.lastFlipped = [];
  state.lastPass = null;
  state.passes = 0;
  return state;
}

test('Reversi standard opening is exact and Black starts', () => {
  const state = createReversi();
  assert.equal(state.board.length, 64);
  assert.equal(REVERSI_SIZE, 8);
  assert.equal(state.board.filter((cell) => cell !== null).length, 4);
  assert.equal(state.board[reversiIndex(3, 3)], 1);
  assert.equal(state.board[reversiIndex(4, 4)], 1);
  assert.equal(state.board[reversiIndex(3, 4)], 0);
  assert.equal(state.board[reversiIndex(4, 3)], 0);
  assert.deepEqual(calculateReversiScore(state.board), [2, 2]);
  assert.deepEqual(state.scores, [2, 2]);
  assert.equal(state.turn, 0);
});

test('Reversi opening exposes exactly the four standard Black moves', () => {
  const state = createReversi();
  assert.deepEqual(getReversiLegalMoves(state.board, 0), [
    { row: 2, col: 3 },
    { row: 3, col: 2 },
    { row: 4, col: 5 },
    { row: 5, col: 4 },
  ]);
  assert.deepEqual(reversiEngine.legalMoves(state), getReversiLegalMoves(state.board, 0));
});

for (const direction of REVERSI_DIRECTIONS) {
  test(`Reversi captures correctly in direction ${direction[0]},${direction[1]}`, () => {
    const state = emptyReversi();
    const move = { row: 3, col: 3 };
    const [dr, dc] = direction;
    const adjacent = reversiIndex(3 + dr, 3 + dc);
    const anchor = reversiIndex(3 + dr * 2, 3 + dc * 2);
    state.board[adjacent] = 1;
    state.board[anchor] = 0;
    state.scores = calculateReversiScore(state.board);

    assert.deepEqual(getCapturedDiscsInDirection(state.board, 0, move, direction), [adjacent]);
    assert.ok(isLegalReversiMove(state.board, 0, move));
    const next = applyReversi(state, move);
    assert.equal(next.board[adjacent], 0);
    assert.equal(next.board[reversiIndex(3, 3)], 0);
  });
}

test('Reversi captures every opponent disc in one continuous line', () => {
  const state = emptyReversi();
  for (const col of [2, 3, 4]) state.board[reversiIndex(3, col)] = 1;
  state.board[reversiIndex(3, 5)] = 0;
  state.scores = calculateReversiScore(state.board);
  const beforeOccupied = state.scores[0] + state.scores[1];
  const next = applyReversi(state, { row: 3, col: 1 });
  assert.deepEqual(next.lastFlipped, [
    reversiIndex(3, 2),
    reversiIndex(3, 3),
    reversiIndex(3, 4),
  ]);
  assert.equal(next.scores[0] + next.scores[1], beforeOccupied + 1);
  for (const col of [1, 2, 3, 4, 5]) assert.equal(next.board[reversiIndex(3, col)], 0);
});

test('one Reversi move flips every valid horizontal, vertical and diagonal line', () => {
  const state = emptyReversi();
  const move = { row: 3, col: 3 };
  for (const [dr, dc] of [
    [0, 1],
    [1, 0],
    [1, 1],
  ] as const) {
    state.board[reversiIndex(3 + dr, 3 + dc)] = 1;
    state.board[reversiIndex(3 + dr * 2, 3 + dc * 2)] = 0;
  }
  state.scores = calculateReversiScore(state.board);
  const captured = getCapturedDiscsForMove(state.board, 0, move);
  assert.equal(captured.length, 3);
  const next = applyReversi(state, move);
  assert.equal(next.lastFlipped.length, 3);
  for (const at of captured) assert.equal(next.board[at], 0);
});

test('Reversi rejects occupied, non-capturing and malformed coordinates without mutation', () => {
  const state = createReversi();
  const snapshot = structuredClone(state);
  assert.deepEqual(validateReversi(state, { row: 3, col: 3 }), { ok: false, code: 'cell-occupied' });
  assert.deepEqual(validateReversi(state, { row: 0, col: 0 }), {
    ok: false,
    code: 'illegal-reversi-move',
  });
  for (const move of [
    { row: -1, col: 0 },
    { row: 8, col: 0 },
    { row: 0, col: 8 },
    { row: 1.5, col: 2 },
    { row: Number.NaN, col: 2 },
    { row: 2, col: 3, extra: true },
  ])
    assert.throws(() => parseReversiMove(move), /invalid-move/);
  assert.throws(() => applyReversi(state, { row: 0, col: 0 }), /illegal-reversi-move/);
  assert.deepEqual(state, snapshot);
});

test('Reversi move application is immutable and adds exactly one occupied cell', () => {
  const state = createReversi();
  const boardBefore = [...state.board];
  const next = applyReversi(state, { row: 2, col: 3 });
  assert.notEqual(next.board, state.board);
  assert.deepEqual(state.board, boardBefore);
  assert.equal(state.board.filter((cell) => cell !== null).length, 4);
  assert.equal(next.board.filter((cell) => cell !== null).length, 5);
  assert.deepEqual(next.scores, calculateReversiScore(next.board));
});

test('Reversi automatically passes a player with no legal moves and grants a consecutive turn', () => {
  const state = emptyReversi();
  state.board.fill(0);
  state.board[reversiIndex(0, 1)] = 1;
  state.board[reversiIndex(1, 1)] = 1;
  state.board[reversiIndex(0, 2)] = null;
  state.board[reversiIndex(1, 2)] = null;
  state.scores = calculateReversiScore(state.board);

  const next = applyReversi(state, { row: 0, col: 2 });
  assert.equal(next.turn, 0);
  assert.equal(next.lastPass, 1);
  assert.equal(next.passes, 1);
  assert.equal(hasReversiLegalMove(next.board, 1), false);
  assert.equal(hasReversiLegalMove(next.board, 0), true);
  assert.equal(next.winner, null);
  assert.equal(next.drawReason, null);

  const final = applyReversi(next, { row: 1, col: 2 });
  assert.equal(final.scores[0] + final.scores[1], 64);
  assert.equal(final.winner, 0);
  assert.deepEqual(reversiEngine.legalMoves(final), []);
});

test('Reversi detects that neither player can move even when an empty square remains', () => {
  const board: ReversiCell[] = Array(REVERSI_CELLS).fill(0);
  board[63] = null;
  assert.equal(hasReversiLegalMove(board, 0), false);
  assert.equal(hasReversiLegalMove(board, 1), false);
});

test('Reversi winner resolution supports Black, White and 32-32 draws', () => {
  assert.equal(determineReversiWinner([...Array(40).fill(0), ...Array(24).fill(1)]), 0);
  assert.equal(determineReversiWinner([...Array(29).fill(0), ...Array(35).fill(1)]), 1);
  assert.equal(determineReversiWinner([...Array(32).fill(0), ...Array(32).fill(1)]), 'draw');
});

test('a full-board Reversi move can finish in an exact 32-32 draw', () => {
  const state = emptyReversi();
  state.board = [
    0, 1, 1, 1, 0, 1, 1, 1,
    1, 0, 0, 1, null, 0, 1, 0,
    0, 0, 1, 0, 0, 0, 1, 1,
    1, 1, 1, 0, 0, 1, 1, 0,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 1, 0,
    1, 0, 0, 1, 0, 1, 0, 0,
    0, 1, 0, 1, 1, 0, 1, 1,
  ];
  state.scores = calculateReversiScore(state.board);
  assert.deepEqual(state.scores, [30, 33]);
  assert.deepEqual(getCapturedDiscsForMove(state.board, 0, { row: 1, col: 4 }), [11]);
  const final = applyReversi(state, { row: 1, col: 4 });
  assert.deepEqual(final.scores, [32, 32]);
  assert.equal(final.winner, null);
  assert.equal(final.drawReason, 'reversi-draw');
  assert.equal(final.board.every((cell) => cell !== null), true);
});

test('Reversi legal-move generation and validation agree for all 64 cells', () => {
  const state = createReversi();
  const legal = new Set(getReversiLegalMoves(state.board, state.turn).map((m) => reversiIndex(m.row, m.col)));
  for (let at = 0; at < REVERSI_CELLS; at++) {
    const move = { row: Math.floor(at / 8), col: at % 8 };
    const validation = validateReversi(state, move);
    assert.equal(validation.ok, legal.has(at));
  }
});

test('Reversi is deterministic for identical board, player and move', () => {
  const state = createReversi();
  const move = { row: 2, col: 3 };
  assert.deepEqual(getCapturedDiscsForMove(state.board, state.turn, move), [reversiIndex(3, 3)]);
  assert.deepEqual(applyReversi(structuredClone(state), move), applyReversi(structuredClone(state), move));
});

test('Reversi is registered and every shared AI difficulty returns a legal move', () => {
  assert.equal(games.get('reversi').id, 'reversi');
  const state = createReversi();
  const plugin = asPlugin(reversiEngine);
  const legal = getReversiLegalMoves(state.board, state.turn);
  for (const difficulty of ['easy', 'medium', 'hard'] as Difficulty[]) {
    const move = chooseMove(plugin, state, difficulty, {
      random: () => 0.25,
      now: () => 0,
      budgetMs: 10000,
    }) as { row: number; col: number } | null;
    assert.ok(move);
    assert.ok(legal.some((candidate) => candidate.row === move!.row && candidate.col === move!.col));
  }
});
