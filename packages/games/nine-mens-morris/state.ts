import type { TwoPlayerState } from '../../core/src/game.ts';
import type { Cell } from '../shared/lines.ts';
// Three rings, each ordered clockwise from its top-left corner. Physical coordinates never mirror.
export const MORRIS_POINTS = [
  [0, 0],
  [3, 0],
  [6, 0],
  [6, 3],
  [6, 6],
  [3, 6],
  [0, 6],
  [0, 3],
  [1, 1],
  [3, 1],
  [5, 1],
  [5, 3],
  [5, 5],
  [3, 5],
  [1, 5],
  [1, 3],
  [2, 2],
  [3, 2],
  [4, 2],
  [4, 3],
  [4, 4],
  [3, 4],
  [2, 4],
  [2, 3],
] as const;
export const MORRIS_MILLS: number[][] = [
  ...[0, 8, 16].flatMap((start) =>
    [
      [0, 1, 2],
      [2, 3, 4],
      [4, 5, 6],
      [6, 7, 0],
    ].map((line) => line.map((i) => start + i)),
  ),
  [1, 9, 17],
  [3, 11, 19],
  [5, 13, 21],
  [7, 15, 23],
];
export const MORRIS_EDGES: number[][] = [
  ...[0, 8, 16].flatMap((start) =>
    Array.from({ length: 8 }, (_, i) => [start + i, start + ((i + 1) % 8)]),
  ),
  ...[1, 3, 5, 7].flatMap((i) => [
    [i, i + 8],
    [i + 8, i + 16],
  ]),
];
export interface MorrisState extends TwoPlayerState {
  gameId: 'nineMensMorris';
  board: Cell[];
  remaining: [number, number];
  capturing: boolean;
  positions: string[];
  lastMove: number | null;
}
export type MorrisMove =
  | { kind: 'place'; to: number }
  | { kind: 'move'; from: number; to: number }
  | { kind: 'capture'; at: number };
export const morrisPosition = (s: MorrisState) =>
  `${s.turn}:${s.remaining.join(',')}:${s.board.map((p) => (p === null ? '.' : p)).join('')}`;
export function createMorris(): MorrisState {
  const s: MorrisState = {
    gameId: 'nineMensMorris',
    board: Array(24).fill(null),
    remaining: [9, 9],
    turn: 0,
    ply: 0,
    winner: null,
    drawReason: null,
    capturing: false,
    positions: [],
    lastMove: null,
  };
  s.positions = [morrisPosition(s)];
  return s;
}
