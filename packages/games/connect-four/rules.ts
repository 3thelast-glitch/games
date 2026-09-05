import {
  RuleError,
  isGameOver,
  opponent,
  type RulesEngine,
  type Validation,
} from '../../core/src/game.ts';
import { evaluateLines, lineThrough } from '../shared/lines.ts';
import { createConnectFour, type ConnectFourState, type ConnectFourMove } from './state.ts';
export function parseConnectFourMove(input: unknown): ConnectFourMove {
  if (!input || typeof input !== 'object') throw new RuleError('invalid-move');
  const m = input as ConnectFourMove;
  if (Object.keys(m).length !== 1 || !Number.isInteger(m.column) || m.column < 0 || m.column > 6)
    throw new RuleError('invalid-move');
  return { column: m.column };
}
export function validateConnectFour(s: ConnectFourState, m: ConnectFourMove): Validation {
  try {
    parseConnectFourMove(m);
  } catch {
    return { ok: false, code: 'invalid-move' };
  }
  if (isGameOver(s)) return { ok: false, code: 'game-over' };
  return s.board[m.column] === null ? { ok: true } : { ok: false, code: 'column-full' };
}
export function applyConnectFour(s: ConnectFourState, m: ConnectFourMove): ConnectFourState {
  const v = validateConnectFour(s, m);
  if (!v.ok) throw new RuleError(v.code);
  let at = 35 + m.column;
  while (s.board[at] !== null) at -= 7;
  const board = [...s.board];
  board[at] = s.turn;
  const winningLine = lineThrough(board, 6, 7, at, 4);
  return {
    ...s,
    board,
    winningLine,
    lastMove: at,
    ply: s.ply + 1,
    turn: opponent(s.turn),
    winner: winningLine.length ? s.turn : null,
    drawReason: !winningLine.length && board.every((c) => c !== null) ? 'board-full' : null,
  };
}
export const connectFourEngine: RulesEngine<ConnectFourState, ConnectFourMove> = {
  id: 'connectFour',
  winReason: 'four-in-row',
  create: createConnectFour,
  parseMove: parseConnectFourMove,
  validate: validateConnectFour,
  apply: applyConnectFour,
  legalMoves: (s) =>
    isGameOver(s)
      ? []
      : [3, 2, 4, 1, 5, 0, 6]
          .filter((column) => s.board[column] === null)
          .map((column) => ({ column })),
  evaluate: (s, p) => evaluateLines(s.board, 6, 7, 4, p, s.turn, true),
};
