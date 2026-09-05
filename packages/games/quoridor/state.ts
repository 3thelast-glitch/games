import type { TwoPlayerState, Player } from '../../core/src/game.ts';
export type Square = readonly [number, number]; // [row, column], fixed physical coordinates in RTL and LTR.
export interface Wall {
  row: number;
  col: number;
  orientation: 'h' | 'v';
}
export interface PlacedWall extends Wall {
  owner: Player;
}
export interface QuoridorState extends TwoPlayerState {
  gameId: 'quoridor';
  pawns: [Square, Square];
  walls: PlacedWall[];
  remaining: [number, number];
}
export type QuoridorMove = { kind: 'pawn'; to: Square } | { kind: 'wall'; wall: Wall };
export const squareEqual = (a: Square, b: Square) => a[0] === b[0] && a[1] === b[1];
export const inGrid = (p: Square) =>
  p.length === 2 && p.every((n) => Number.isInteger(n) && n >= 0 && n <= 8);
export const goalRow = (player: Player) => (player === 0 ? 0 : 8);
export function createQuoridor(): QuoridorState {
  return {
    gameId: 'quoridor',
    pawns: [
      [8, 4],
      [0, 4],
    ],
    walls: [],
    remaining: [10, 10],
    turn: 0,
    ply: 0,
    winner: null,
  };
}
