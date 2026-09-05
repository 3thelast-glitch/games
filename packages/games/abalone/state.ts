import type { BaseState, Player } from '../../core/src/game.ts';
export type Hex = readonly [number, number];
export interface Marble {
  id: string;
  owner: Player;
}
export interface Motion {
  marble: Marble;
  from: Hex;
  to: Hex;
  ejected: boolean;
}
export interface AbaloneState extends BaseState {
  gameId: 'abalone';
  board: Record<string, Marble>;
  captured: [number, number];
  lastMove: Motion[];
}
export interface AbaloneMove {
  marbles: Hex[];
  direction: number;
}
export const DIRECTIONS: readonly Hex[] = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
];
export const hexKey = (hex: Hex) => `${hex[0]},${hex[1]}`;
export const fromKey = (key: string): Hex => key.split(',').map(Number) as [number, number];
export const addHex = (a: Hex, b: Hex): Hex => [a[0] + b[0], a[1] + b[1]];
export const onBoard = ([q, r]: Hex) =>
  Number.isInteger(q) &&
  Number.isInteger(r) &&
  Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 4;
export const HEXES: Hex[] = [];
for (let r = -4; r <= 4; r++) for (let q = -4; q <= 4; q++) if (onBoard([q, r])) HEXES.push([q, r]);
export function createAbalone(): AbaloneState {
  const board: Record<string, Marble> = {};
  let id = 0;
  for (const [q, r] of HEXES) {
    if (r >= 3 || (r === 2 && q >= -2 && q <= 0))
      board[hexKey([q, r])] = { owner: 0, id: `m${id++}` };
    if (r <= -3 || (r === -2 && q >= 0 && q <= 2))
      board[hexKey([q, r])] = { owner: 1, id: `m${id++}` };
  }
  return {
    gameId: 'abalone',
    board,
    turn: 0,
    ply: 0,
    winner: null,
    captured: [0, 0],
    lastMove: [],
  };
}
