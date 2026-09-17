import type { Player, TwoPlayerState } from '../../core/src/game.ts';

export type EdgeOrientation = 'h' | 'v';

export interface DotsAndBoxesMove {
  orientation: EdgeOrientation;
  row: number;
  col: number;
}

export interface DotsAndBoxesState extends TwoPlayerState {
  gameId: 'dotsAndBoxes';
  boxRows: number;
  boxCols: number;
  horizontalEdges: Array<Player | null>;
  verticalEdges: Array<Player | null>;
  boxes: Array<Player | null>;
  scores: [number, number];
  lastMove: DotsAndBoxesMove | null;
}

export function createDotsAndBoxes(boxRows = 5, boxCols = 5): DotsAndBoxesState {
  if (!Number.isInteger(boxRows) || !Number.isInteger(boxCols) || boxRows < 1 || boxCols < 1) {
    throw new RangeError('invalid-board-size');
  }
  return {
    gameId: 'dotsAndBoxes',
    boxRows,
    boxCols,
    horizontalEdges: Array((boxRows + 1) * boxCols).fill(null),
    verticalEdges: Array(boxRows * (boxCols + 1)).fill(null),
    boxes: Array(boxRows * boxCols).fill(null),
    scores: [0, 0],
    turn: 0,
    ply: 0,
    winner: null,
    drawReason: null,
    lastMove: null,
  };
}

export const horizontalEdgeIndex = (state: DotsAndBoxesState, row: number, col: number) =>
  row * state.boxCols + col;

export const verticalEdgeIndex = (state: DotsAndBoxesState, row: number, col: number) =>
  row * (state.boxCols + 1) + col;

export const boxIndex = (state: DotsAndBoxesState, row: number, col: number) =>
  row * state.boxCols + col;
