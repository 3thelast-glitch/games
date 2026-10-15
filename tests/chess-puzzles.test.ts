import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHESS_PUZZLES,
  validateChessPuzzle,
  validateChessPuzzleSet,
  type ChessPuzzleTheme,
} from '../packages/games/chess/puzzles.ts';
import { chessFromFen, chessMoveFromUci } from '../packages/games/chess/notation.ts';
import { applyChess, chessLegalMoves } from '../packages/games/chess/rules.ts';

test('tactical trainer ships at least 50 validated puzzles with five per category', () => {
  assert.ok(CHESS_PUZZLES.length >= 50);
  const all = validateChessPuzzleSet();
  assert.deepEqual(all.errors, []);
  assert.equal(all.ok, true);

  const themes: ChessPuzzleTheme[] = [
    'fork',
    'pin',
    'skewer',
    'discoveredAttack',
    'deflection',
    'mate1',
    'mate2',
    'mate3',
    'promotion',
    'endgame',
  ];
  for (const theme of themes)
    assert.ok(
      CHESS_PUZZLES.filter((puzzle) => puzzle.themes.includes(theme)).length >= 5,
      theme,
    );
});

test('every stored main line is legal from its FEN', () => {
  for (const puzzle of CHESS_PUZZLES) {
    assert.equal(validateChessPuzzle(puzzle).ok, true, puzzle.id);
    let state = chessFromFen(puzzle.fen);
    for (const encoded of puzzle.solutionLines[0]) {
      const move = chessMoveFromUci(encoded);
      assert.ok(
        chessLegalMoves(state).some(
          (candidate) =>
            candidate.from === move.from &&
            candidate.to === move.to &&
            candidate.promotion === move.promotion,
        ),
        puzzle.id + ':' + encoded,
      );
      state = applyChess(state, move);
    }
  }
});

test('promotion collection includes a real underpromotion move', () => {
  const promotionMoves = CHESS_PUZZLES
    .filter((puzzle) => puzzle.themes.includes('promotion'))
    .map((puzzle) => chessMoveFromUci(puzzle.solutionLines[0][0]));
  assert.ok(promotionMoves.some((move) => move.promotion === 'knight'));
});