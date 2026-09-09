import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyChess,
  chessLegalMoves,
  isChessInCheck,
  isInsufficientChessMaterial,
  parseChessMove,
  validateChess,
} from '../packages/games/chess/rules.ts';
import { chessPosition, createChess, type ChessPiece, type ChessState } from '../packages/games/chess/state.ts';

function emptyChess(turn: 0 | 1 = 0): ChessState {
  const state = createChess();
  state.board = Array(64).fill(null);
  state.turn = turn;
  state.winner = null;
  state.drawReason = null;
  state.castling = [
    { kingSide: false, queenSide: false },
    { kingSide: false, queenSide: false },
  ];
  state.enPassant = null;
  state.halfmoveClock = 0;
  state.positions = [];
  state.lastMove = null;
  state.inCheck = false;
  return state;
}
const piece = (owner: 0 | 1, type: ChessPiece['type']): ChessPiece => ({ owner, type });
const play = (state: ChessState, from: number, to: number, promotion?: 'queen' | 'rook' | 'bishop' | 'knight') =>
  applyChess(state, { from, to, ...(promotion ? { promotion } : {}) });

function seedPositions(state: ChessState) {
  state.positions = [chessPosition(state)];
  state.inCheck = isChessInCheck(state, state.turn);
  return state;
}

test('Chess starts in the standard position with White and 20 legal moves', () => {
  const state = createChess();
  assert.equal(state.turn, 0);
  assert.equal(state.board.filter(Boolean).length, 32);
  assert.equal(state.board[60]?.type, 'king');
  assert.equal(state.board[4]?.type, 'king');
  assert.equal(chessLegalMoves(state).length, 20);
  assert.ok(chessLegalMoves(state).some((move) => move.from === 52 && move.to === 36));
  assert.ok(chessLegalMoves(state).some((move) => move.from === 62 && move.to === 45));
});

test('Chess rejects malformed moves and cannot expose its own king', () => {
  assert.throws(() => parseChessMove({ from: -1, to: 2 }), /invalid-move/);
  assert.throws(() => parseChessMove({ from: 1, to: 2, promotion: 'king' }), /invalid-move/);
  const state = emptyChess();
  state.board[60] = piece(0, 'king');
  state.board[52] = piece(0, 'rook');
  state.board[4] = piece(1, 'rook');
  state.board[0] = piece(1, 'king');
  seedPositions(state);
  assert.deepEqual(validateChess(state, { from: 52, to: 51 }), { ok: false, code: 'illegal-chess-move' });
  assert.ok(chessLegalMoves(state).some((move) => move.from === 52 && move.to === 44));
});

test('Chess supports legal kingside castling and moves the rook atomically', () => {
  const state = emptyChess();
  state.board[60] = piece(0, 'king');
  state.board[63] = piece(0, 'rook');
  state.board[4] = piece(1, 'king');
  state.castling[0].kingSide = true;
  seedPositions(state);
  assert.ok(chessLegalMoves(state).some((move) => move.from === 60 && move.to === 62));
  const next = play(state, 60, 62);
  assert.equal(next.board[62]?.type, 'king');
  assert.equal(next.board[61]?.type, 'rook');
  assert.equal(next.board[63], null);
  assert.equal(next.castling[0].kingSide, false);
  assert.equal(next.castling[0].queenSide, false);
});

test('Chess forbids castling through an attacked square', () => {
  const state = emptyChess();
  state.board[60] = piece(0, 'king');
  state.board[63] = piece(0, 'rook');
  state.board[0] = piece(1, 'king');
  state.board[5] = piece(1, 'rook');
  state.castling[0].kingSide = true;
  seedPositions(state);
  assert.equal(chessLegalMoves(state).some((move) => move.from === 60 && move.to === 62), false);
});

test('Chess supports en passant only on the immediate reply', () => {
  let state = createChess();
  state = play(state, 52, 36); // e2-e4
  state = play(state, 8, 16); // a7-a6
  state = play(state, 36, 28); // e4-e5
  state = play(state, 11, 27); // d7-d5
  assert.equal(state.enPassant, 19);
  assert.ok(chessLegalMoves(state).some((move) => move.from === 28 && move.to === 19));
  state = play(state, 28, 19);
  assert.equal(state.board[19]?.owner, 0);
  assert.equal(state.board[27], null);
});

test('Chess promotion requires and applies one of four legal promotion pieces', () => {
  const state = emptyChess();
  state.board[60] = piece(0, 'king');
  state.board[4] = piece(1, 'king');
  state.board[8] = piece(0, 'pawn');
  seedPositions(state);
  const promotions = chessLegalMoves(state).filter((move) => move.from === 8 && move.to === 0);
  assert.deepEqual(new Set(promotions.map((move) => move.promotion)), new Set(['queen', 'rook', 'bishop', 'knight']));
  assert.equal(validateChess(state, { from: 8, to: 0 }).ok, false);
  const next = play(state, 8, 0, 'knight');
  assert.equal(next.board[0]?.type, 'knight');
});

test('Fools mate is detected as checkmate with Black winning', () => {
  let state = createChess();
  state = play(state, 53, 45); // f2-f3
  state = play(state, 12, 28); // e7-e5
  state = play(state, 54, 38); // g2-g4
  state = play(state, 3, 39); // Qd8-h4#
  assert.equal(state.inCheck, true);
  assert.equal(state.winner, 1);
  assert.equal(state.drawReason, null);
  assert.equal(chessLegalMoves(state).length, 0);
});

test('Chess recognizes stalemate', () => {
  const state = emptyChess();
  state.board[0] = piece(1, 'king'); // a8
  state.board[18] = piece(0, 'king'); // c6
  state.board[17] = piece(0, 'queen'); // b6
  seedPositions(state);
  const next = play(state, 17, 10); // Qc7 stalemate
  assert.equal(next.winner, null);
  assert.equal(next.drawReason, 'stalemate');
  assert.equal(next.inCheck, false);
});

test('Chess recognizes common insufficient-material positions', () => {
  const state = emptyChess();
  state.board[60] = piece(0, 'king');
  state.board[4] = piece(1, 'king');
  assert.equal(isInsufficientChessMaterial(state.board), true);
  state.board[58] = piece(0, 'bishop');
  assert.equal(isInsufficientChessMaterial(state.board), true);
  state.board[56] = piece(0, 'rook');
  assert.equal(isInsufficientChessMaterial(state.board), false);
});

test('Chess enforces the fifty-move automatic draw', () => {
  const state = emptyChess();
  state.board[60] = piece(0, 'king');
  state.board[56] = piece(0, 'rook');
  state.board[4] = piece(1, 'king');
  state.board[0] = piece(1, 'rook');
  state.halfmoveClock = 99;
  seedPositions(state);
  const next = play(state, 56, 48);
  assert.equal(next.halfmoveClock, 100);
  assert.equal(next.drawReason, 'fifty-move-rule');
});

test('Chess enforces automatic threefold repetition', () => {
  let state = createChess();
  for (let cycle = 0; cycle < 2; cycle++) {
    state = play(state, 62, 45); // Ng1-f3
    state = play(state, 6, 21); // Ng8-f6
    state = play(state, 45, 62); // Nf3-g1
    state = play(state, 21, 6); // Nf6-g8
  }
  assert.equal(state.drawReason, 'threefold-repetition');
  assert.equal(state.winner, null);
});
