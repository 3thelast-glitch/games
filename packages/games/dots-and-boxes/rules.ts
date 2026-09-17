import {
  RuleError,
  isGameOver,
  opponent,
  type Player,
  type RulesEngine,
  type Validation,
} from '../../core/src/game.ts';
import {
  boxIndex,
  createDotsAndBoxes,
  horizontalEdgeIndex,
  verticalEdgeIndex,
  type DotsAndBoxesMove,
  type DotsAndBoxesState,
} from './state.ts';

export function parseDotsAndBoxesMove(input: unknown): DotsAndBoxesMove {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RuleError('invalid-move');
  const move = input as Partial<DotsAndBoxesMove>;
  if (
    Object.keys(move).length !== 3 ||
    (move.orientation !== 'h' && move.orientation !== 'v') ||
    !Number.isInteger(move.row) ||
    !Number.isInteger(move.col) ||
    (move.row as number) < 0 ||
    (move.col as number) < 0
  )
    throw new RuleError('invalid-move');
  return { orientation: move.orientation, row: move.row as number, col: move.col as number };
}

function isInside(state: DotsAndBoxesState, move: DotsAndBoxesMove) {
  return move.orientation === 'h'
    ? move.row <= state.boxRows && move.col < state.boxCols
    : move.row < state.boxRows && move.col <= state.boxCols;
}

function edgeOwner(state: DotsAndBoxesState, move: DotsAndBoxesMove) {
  return move.orientation === 'h'
    ? state.horizontalEdges[horizontalEdgeIndex(state, move.row, move.col)]
    : state.verticalEdges[verticalEdgeIndex(state, move.row, move.col)];
}

export function validateDotsAndBoxes(
  state: DotsAndBoxesState,
  move: DotsAndBoxesMove,
): Validation {
  try {
    parseDotsAndBoxesMove(move);
  } catch {
    return { ok: false, code: 'invalid-move' };
  }
  if (isGameOver(state)) return { ok: false, code: 'game-over' };
  if (!isInside(state, move)) return { ok: false, code: 'invalid-edge' };
  return edgeOwner(state, move) === null ? { ok: true } : { ok: false, code: 'edge-drawn' };
}

function boxIsComplete(state: DotsAndBoxesState, row: number, col: number) {
  return (
    state.horizontalEdges[horizontalEdgeIndex(state, row, col)] !== null &&
    state.horizontalEdges[horizontalEdgeIndex(state, row + 1, col)] !== null &&
    state.verticalEdges[verticalEdgeIndex(state, row, col)] !== null &&
    state.verticalEdges[verticalEdgeIndex(state, row, col + 1)] !== null
  );
}

function adjacentBoxes(state: DotsAndBoxesState, move: DotsAndBoxesMove) {
  const result: Array<[number, number]> = [];
  if (move.orientation === 'h') {
    if (move.row > 0) result.push([move.row - 1, move.col]);
    if (move.row < state.boxRows) result.push([move.row, move.col]);
  } else {
    if (move.col > 0) result.push([move.row, move.col - 1]);
    if (move.col < state.boxCols) result.push([move.row, move.col]);
  }
  return result;
}

function sideCount(state: DotsAndBoxesState, row: number, col: number) {
  return Number(state.horizontalEdges[horizontalEdgeIndex(state, row, col)] !== null) +
    Number(state.horizontalEdges[horizontalEdgeIndex(state, row + 1, col)] !== null) +
    Number(state.verticalEdges[verticalEdgeIndex(state, row, col)] !== null) +
    Number(state.verticalEdges[verticalEdgeIndex(state, row, col + 1)] !== null);
}

export function applyDotsAndBoxes(
  state: DotsAndBoxesState,
  move: DotsAndBoxesMove,
): DotsAndBoxesState {
  const validation = validateDotsAndBoxes(state, move);
  if (!validation.ok) throw new RuleError(validation.code);

  const next: DotsAndBoxesState = {
    ...state,
    horizontalEdges: [...state.horizontalEdges],
    verticalEdges: [...state.verticalEdges],
    boxes: [...state.boxes],
    scores: [...state.scores] as [number, number],
    lastMove: { ...move },
    ply: state.ply + 1,
  };

  if (move.orientation === 'h') {
    next.horizontalEdges[horizontalEdgeIndex(next, move.row, move.col)] = state.turn;
  } else {
    next.verticalEdges[verticalEdgeIndex(next, move.row, move.col)] = state.turn;
  }

  let claimed = 0;
  for (const [row, col] of adjacentBoxes(next, move)) {
    const at = boxIndex(next, row, col);
    if (next.boxes[at] === null && boxIsComplete(next, row, col)) {
      next.boxes[at] = state.turn;
      claimed++;
    }
  }
  next.scores[state.turn] += claimed;

  const finished =
    next.horizontalEdges.every((edge) => edge !== null) &&
    next.verticalEdges.every((edge) => edge !== null);
  if (finished) {
    if (next.scores[0] === next.scores[1]) next.drawReason = 'score-tie';
    else next.winner = next.scores[0] > next.scores[1] ? 0 : 1;
  }
  next.turn = claimed > 0 ? state.turn : opponent(state.turn);
  return next;
}

export function legalDotsAndBoxesMoves(state: DotsAndBoxesState): DotsAndBoxesMove[] {
  if (isGameOver(state)) return [];
  const moves: DotsAndBoxesMove[] = [];
  for (let row = 0; row <= state.boxRows; row++)
    for (let col = 0; col < state.boxCols; col++)
      if (state.horizontalEdges[horizontalEdgeIndex(state, row, col)] === null)
        moves.push({ orientation: 'h', row, col });
  for (let row = 0; row < state.boxRows; row++)
    for (let col = 0; col <= state.boxCols; col++)
      if (state.verticalEdges[verticalEdgeIndex(state, row, col)] === null)
        moves.push({ orientation: 'v', row, col });
  return moves;
}

export function evaluateDotsAndBoxes(state: DotsAndBoxesState, player: Player) {
  const rival = opponent(player);
  let value = (state.scores[player] - state.scores[rival]) * 500;
  let threeSided = 0;
  for (let row = 0; row < state.boxRows; row++)
    for (let col = 0; col < state.boxCols; col++)
      if (state.boxes[boxIndex(state, row, col)] === null && sideCount(state, row, col) === 3)
        threeSided++;
  value += threeSided * (state.turn === player ? 45 : -45);
  return value;
}

export const dotsAndBoxesEngine: RulesEngine<DotsAndBoxesState, DotsAndBoxesMove> = {
  id: 'dotsAndBoxes',
  winReason: 'most-boxes',
  create: () => createDotsAndBoxes(),
  parseMove: parseDotsAndBoxesMove,
  validate: validateDotsAndBoxes,
  apply: applyDotsAndBoxes,
  legalMoves: legalDotsAndBoxesMoves,
  evaluate: evaluateDotsAndBoxes,
};
