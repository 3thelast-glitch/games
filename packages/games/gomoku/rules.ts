import {
  RuleError,
  isGameOver,
  opponent,
  type RulesEngine,
  type Validation,
} from '../../core/src/game.ts';
import { evaluateLines, lineThrough } from '../shared/lines.ts';
import { createGomoku, type GomokuState, type GomokuMove } from './state.ts';
export function parseGomokuMove(input: unknown): GomokuMove {
  if (!input || typeof input !== 'object') throw new RuleError('invalid-move');
  const m = input as GomokuMove;
  if (
    Object.keys(m).length !== 2 ||
    ![m.row, m.col].every((n) => Number.isInteger(n) && n >= 0 && n < 15)
  )
    throw new RuleError('invalid-move');
  return { row: m.row, col: m.col };
}
export function validateGomoku(s: GomokuState, m: GomokuMove): Validation {
  try {
    parseGomokuMove(m);
  } catch {
    return { ok: false, code: 'invalid-move' };
  }
  if (isGameOver(s)) return { ok: false, code: 'game-over' };
  return s.board[m.row * 15 + m.col] === null ? { ok: true } : { ok: false, code: 'cell-occupied' };
}
export function applyGomoku(s: GomokuState, m: GomokuMove): GomokuState {
  const v = validateGomoku(s, m);
  if (!v.ok) throw new RuleError(v.code);
  const at = m.row * 15 + m.col,
    board = [...s.board];
  board[at] = s.turn;
  const winningLine = lineThrough(board, 15, 15, at, 5);
  return {
    ...s,
    board,
    winningLine,
    lastMove: at,
    turn: opponent(s.turn),
    ply: s.ply + 1,
    winner: winningLine.length ? s.turn : null,
    drawReason: !winningLine.length && board.every((c) => c !== null) ? 'board-full' : null,
  };
}
export const gomokuEngine: RulesEngine<GomokuState, GomokuMove> = {
  id: 'gomoku',
  winReason: 'five-in-row',
  create: createGomoku,
  parseMove: parseGomokuMove,
  validate: validateGomoku,
  apply: applyGomoku,
  // All empty intersections remain legal, including distant opening placements.
  legalMoves: (s) =>
    isGameOver(s)
      ? []
      : s.board
          .flatMap((c, i) => (c === null ? [{ row: Math.floor(i / 15), col: i % 15 }] : []))
          .sort(
            (a, b) =>
              Math.abs(a.row - 7) + Math.abs(a.col - 7) - Math.abs(b.row - 7) - Math.abs(b.col - 7),
          ),
  evaluate: (s, p) => evaluateLines(s.board, 15, 15, 5, p, s.turn),
};
