import type { TwoPlayerState } from '../../core/src/game.ts';
import type { Cell } from '../shared/lines.ts';
export const GOMOKU_SIZE = 15;
export interface GomokuState extends TwoPlayerState {
  gameId: 'gomoku';
  board: Cell[];
  lastMove: number | null;
  winningLine: number[];
}
export interface GomokuMove {
  row: number;
  col: number;
}
export const createGomoku = (): GomokuState => ({
  gameId: 'gomoku',
  board: Array(225).fill(null),
  turn: 0,
  ply: 0,
  winner: null,
  drawReason: null,
  lastMove: null,
  winningLine: [],
});
