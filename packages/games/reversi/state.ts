import type { Player, TwoPlayerState } from '../../core/src/game.ts';

export const REVERSI_SIZE = 8;
export const REVERSI_CELLS = REVERSI_SIZE * REVERSI_SIZE;

export type ReversiCell = Player | null;

export interface ReversiMove {
  row: number;
  col: number;
}

export interface ReversiState extends TwoPlayerState {
  gameId: 'reversi';
  board: ReversiCell[];
  lastMove: number | null;
  lastFlipped: number[];
  lastPass: Player | null;
  passes: number;
  scores: [number, number];
}

export const reversiIndex = (row: number, col: number) => row * REVERSI_SIZE + col;

export function createReversi(): ReversiState {
  const board: ReversiCell[] = Array(REVERSI_CELLS).fill(null);

  // Standard Reversi opening. Player 0 is Black, player 1 is White.
  board[reversiIndex(3, 3)] = 1; // D4 White
  board[reversiIndex(4, 4)] = 1; // E5 White
  board[reversiIndex(3, 4)] = 0; // E4 Black
  board[reversiIndex(4, 3)] = 0; // D5 Black

  return {
    gameId: 'reversi',
    board,
    turn: 0,
    ply: 0,
    winner: null,
    drawReason: null,
    lastMove: null,
    lastFlipped: [],
    lastPass: null,
    passes: 0,
    scores: [2, 2],
  };
}
