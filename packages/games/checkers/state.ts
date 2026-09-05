import type { BaseState, Player } from '../../core/src/game.ts';
export interface Checker {
  owner: Player;
  king: boolean;
}
export interface CheckersState extends BaseState {
  gameId: 'checkers';
  board: (Checker | null)[];
  forcedFrom: number | null;
  quietTurns: number;
  positions: string[];
  lastMove: CheckersMove | null;
}
export interface CheckersMove {
  from: number;
  to: number;
}
export const checkersPosition = (s: CheckersState) =>
  `${s.turn}:${s.board.map((p) => (p === null ? '.' : String(p.owner + (p.king ? 2 : 0)))).join('')}`;
export function createCheckers(): CheckersState {
  const s: CheckersState = {
    gameId: 'checkers',
    board: Array.from({ length: 64 }, (_, i) => {
      const row = Math.floor(i / 8),
        col = i % 8;
      return (row + col) % 2 === 1 && (row < 3 || row > 4)
        ? { owner: row < 3 ? 1 : 0, king: false }
        : null;
    }),
    turn: 0,
    ply: 0,
    winner: null,
    drawReason: null,
    forcedFrom: null,
    quietTurns: 0,
    positions: [],
    lastMove: null,
  };
  s.positions = [checkersPosition(s)];
  return s;
}
