import {
  RuleError,
  isGameOver,
  opponent,
  type Player,
  type RulesEngine,
  type Validation,
} from '../../core/src/game.ts';
import {
  REVERSI_CELLS,
  REVERSI_SIZE,
  createReversi,
  reversiIndex,
  type ReversiCell,
  type ReversiMove,
  type ReversiState,
} from './state.ts';

export type ReversiDirection = readonly [number, number];

export const REVERSI_DIRECTIONS: readonly ReversiDirection[] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const;

export function isInsideReversi(row: number, col: number): boolean {
  return row >= 0 && row < REVERSI_SIZE && col >= 0 && col < REVERSI_SIZE;
}

export function parseReversiMove(input: unknown): ReversiMove {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RuleError('invalid-move');
  const move = input as ReversiMove;
  if (
    Object.keys(move).length !== 2 ||
    !Number.isInteger(move.row) ||
    !Number.isInteger(move.col) ||
    !isInsideReversi(move.row, move.col)
  )
    throw new RuleError('invalid-move');
  return { row: move.row, col: move.col };
}

export function getCapturedDiscsInDirection(
  board: readonly ReversiCell[],
  player: Player,
  position: ReversiMove,
  [dr, dc]: ReversiDirection,
): number[] {
  if (!isInsideReversi(position.row, position.col)) return [];
  if (board[reversiIndex(position.row, position.col)] !== null) return [];

  const enemy = opponent(player);
  const captured: number[] = [];
  let row = position.row + dr;
  let col = position.col + dc;

  while (isInsideReversi(row, col)) {
    const at = reversiIndex(row, col);
    const cell = board[at];
    if (cell === enemy) {
      captured.push(at);
      row += dr;
      col += dc;
      continue;
    }
    return cell === player && captured.length > 0 ? captured : [];
  }
  return [];
}

export function getCapturedDiscsForMove(
  board: readonly ReversiCell[],
  player: Player,
  position: ReversiMove,
): number[] {
  if (!isInsideReversi(position.row, position.col)) return [];
  if (board[reversiIndex(position.row, position.col)] !== null) return [];
  return REVERSI_DIRECTIONS.flatMap((direction) =>
    getCapturedDiscsInDirection(board, player, position, direction),
  );
}

export function isLegalReversiMove(
  board: readonly ReversiCell[],
  player: Player,
  position: ReversiMove,
): boolean {
  return getCapturedDiscsForMove(board, player, position).length > 0;
}

export function getReversiLegalMoves(
  board: readonly ReversiCell[],
  player: Player,
): ReversiMove[] {
  const moves: ReversiMove[] = [];
  for (let at = 0; at < REVERSI_CELLS; at++) {
    if (board[at] !== null) continue;
    const move = { row: Math.floor(at / REVERSI_SIZE), col: at % REVERSI_SIZE };
    if (isLegalReversiMove(board, player, move)) moves.push(move);
  }
  return moves;
}

export function calculateReversiScore(board: readonly ReversiCell[]): [number, number] {
  let black = 0;
  let white = 0;
  for (const cell of board) {
    if (cell === 0) black++;
    else if (cell === 1) white++;
  }
  return [black, white];
}

export function hasReversiLegalMove(board: readonly ReversiCell[], player: Player): boolean {
  for (let at = 0; at < REVERSI_CELLS; at++) {
    if (board[at] !== null) continue;
    if (
      isLegalReversiMove(board, player, {
        row: Math.floor(at / REVERSI_SIZE),
        col: at % REVERSI_SIZE,
      })
    )
      return true;
  }
  return false;
}

export function determineReversiWinner(board: readonly ReversiCell[]): Player | 'draw' {
  const [black, white] = calculateReversiScore(board);
  return black === white ? 'draw' : black > white ? 0 : 1;
}

export function validateReversi(state: ReversiState, move: ReversiMove): Validation {
  try {
    parseReversiMove(move);
  } catch {
    return { ok: false, code: 'invalid-move' };
  }
  if (isGameOver(state)) return { ok: false, code: 'game-over' };
  const at = reversiIndex(move.row, move.col);
  if (state.board[at] !== null) return { ok: false, code: 'cell-occupied' };
  return isLegalReversiMove(state.board, state.turn, move)
    ? { ok: true }
    : { ok: false, code: 'illegal-reversi-move' };
}

function finishReversi(state: ReversiState, board: ReversiCell[], scores: [number, number]): ReversiState {
  const result = determineReversiWinner(board);
  return {
    ...state,
    board,
    scores,
    winner: result === 'draw' ? null : result,
    drawReason: result === 'draw' ? 'reversi-draw' : null,
  };
}

export function applyReversi(state: ReversiState, move: ReversiMove): ReversiState {
  const validation = validateReversi(state, move);
  if (!validation.ok) throw new RuleError(validation.code);

  const player = state.turn;
  const captured = getCapturedDiscsForMove(state.board, player, move);
  const at = reversiIndex(move.row, move.col);
  const board = [...state.board];
  board[at] = player;
  for (const capturedAt of captured) board[capturedAt] = player;

  const scores = calculateReversiScore(board);
  const nextBase: ReversiState = {
    ...state,
    board,
    scores,
    ply: state.ply + 1,
    lastMove: at,
    lastFlipped: captured,
    lastPass: null,
  };

  const boardFull = scores[0] + scores[1] === REVERSI_CELLS;
  const nextPlayer = opponent(player);
  const opponentCanMove = !boardFull && hasReversiLegalMove(board, nextPlayer);
  const currentCanMove = !boardFull && hasReversiLegalMove(board, player);

  if (boardFull || (!opponentCanMove && !currentCanMove)) return finishReversi(nextBase, board, scores);

  if (!opponentCanMove) {
    return {
      ...nextBase,
      turn: player,
      lastPass: nextPlayer,
      passes: state.passes + 1,
    };
  }

  return { ...nextBase, turn: nextPlayer };
}

// Classic positional values: corners are stable, corner-adjacent squares are risky
// while empty, and edges/mobility matter more than raw early-game disc count.
const POSITION_WEIGHTS = [
  120, -25, 20, 5, 5, 20, -25, 120,
  -25, -45, -5, -5, -5, -5, -45, -25,
  20, -5, 15, 3, 3, 15, -5, 20,
  5, -5, 3, 3, 3, 3, -5, 5,
  5, -5, 3, 3, 3, 3, -5, 5,
  20, -5, 15, 3, 3, 15, -5, 20,
  -25, -45, -5, -5, -5, -5, -45, -25,
  120, -25, 20, 5, 5, 20, -25, 120,
] as const;

function frontierCount(board: readonly ReversiCell[], player: Player): number {
  let frontier = 0;
  for (let at = 0; at < REVERSI_CELLS; at++) {
    if (board[at] !== player) continue;
    const row = Math.floor(at / REVERSI_SIZE);
    const col = at % REVERSI_SIZE;
    if (
      REVERSI_DIRECTIONS.some(([dr, dc]) => {
        const r = row + dr;
        const c = col + dc;
        return isInsideReversi(r, c) && board[reversiIndex(r, c)] === null;
      })
    )
      frontier++;
  }
  return frontier;
}

export function evaluateReversi(state: ReversiState, player: Player): number {
  const enemy = opponent(player);
  const occupied = state.scores[0] + state.scores[1];
  let positional = 0;
  for (let at = 0; at < REVERSI_CELLS; at++) {
    if (state.board[at] === player) positional += POSITION_WEIGHTS[at];
    else if (state.board[at] === enemy) positional -= POSITION_WEIGHTS[at];
  }

  const mobility =
    getReversiLegalMoves(state.board, player).length - getReversiLegalMoves(state.board, enemy).length;
  const frontier = frontierCount(state.board, enemy) - frontierCount(state.board, player);
  const discDifference = state.scores[player] - state.scores[enemy];
  const discWeight = occupied >= 52 ? 8 : occupied >= 40 ? 3 : 1;

  return positional + mobility * 10 + frontier * 3 + discDifference * discWeight;
}

export const reversiEngine: RulesEngine<ReversiState, ReversiMove> = {
  id: 'reversi',
  winReason: 'reversi-win',
  create: createReversi,
  parseMove: parseReversiMove,
  validate: validateReversi,
  apply: applyReversi,
  legalMoves: (state) => (isGameOver(state) ? [] : getReversiLegalMoves(state.board, state.turn)),
  evaluate: evaluateReversi,
};
