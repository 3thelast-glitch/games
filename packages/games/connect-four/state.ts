import type { TwoPlayerState } from '../../core/src/game.ts';
import type { Cell } from '../shared/lines.ts';
export interface ConnectFourState extends TwoPlayerState {
  gameId: 'connectFour';
  board: Cell[];
  lastMove: number | null;
  winningLine: number[];
}
export interface ConnectFourMove {
  column: number;
}
export const createConnectFour = (): ConnectFourState => ({
  gameId: 'connectFour',
  board: Array(42).fill(null),
  turn: 0,
  ply: 0,
  winner: null,
  drawReason: null,
  lastMove: null,
  winningLine: [],
});
