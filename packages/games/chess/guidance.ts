import { applyChess, chessLegalMoves } from './rules.ts';
import type { ChessMove, ChessPieceType, ChessState } from './state.ts';

export type ChessGuidanceLevel = 'full' | 'light' | 'test';
export type ChessGuidanceReason =
  | 'escapeCheck'
  | 'castle'
  | 'promotion'
  | 'capture'
  | 'check'
  | 'development'
  | 'center'
  | 'activity';

export interface ChessGuidanceSuggestion {
  positionPly: number;
  move: ChessMove;
  piece: ChessPieceType;
  legalDestinations: number[];
  captureDestinations: number[];
  reason: ChessGuidanceReason;
}

const center = new Set([27, 28, 35, 36]);
const developmentHomes = new Set([1, 2, 5, 6, 57, 58, 61, 62]);

function capturedAt(state: ChessState, move: ChessMove) {
  const moving = state.board[move.from];
  const direct = state.board[move.to];
  if (direct) return direct;
  if (
    moving?.type === 'pawn' &&
    state.enPassant === move.to &&
    move.from % 8 !== move.to % 8
  )
    return state.board[move.to + (moving.owner === 0 ? 8 : -8)];
  return null;
}

export function explainChessGuidance(
  state: ChessState,
  move: ChessMove,
): ChessGuidanceReason {
  const piece = state.board[move.from];
  if (!piece) return 'activity';
  if (state.inCheck) return 'escapeCheck';
  if (piece.type === 'king' && Math.abs(move.to - move.from) === 2) return 'castle';
  if (move.promotion) return 'promotion';
  if (capturedAt(state, move)) return 'capture';

  const next = applyChess(state, move);
  if (next.inCheck) return 'check';
  if (
    (piece.type === 'knight' || piece.type === 'bishop') &&
    developmentHomes.has(move.from)
  )
    return 'development';
  if (center.has(move.to)) return 'center';
  return 'activity';
}

export function buildChessGuidance(
  state: ChessState,
  move: ChessMove,
): ChessGuidanceSuggestion | null {
  const legal = chessLegalMoves(state);
  const valid = legal.find(
    (candidate) =>
      candidate.from === move.from &&
      candidate.to === move.to &&
      candidate.promotion === move.promotion,
  );
  const piece = state.board[move.from];
  if (!valid || !piece) return null;

  const fromMoves = legal.filter((candidate) => candidate.from === move.from);
  return {
    positionPly: state.ply,
    move: { ...valid },
    piece: piece.type,
    legalDestinations: [...new Set(fromMoves.map((candidate) => candidate.to))],
    captureDestinations: [
      ...new Set(
        fromMoves
          .filter((candidate) => !!capturedAt(state, candidate))
          .map((candidate) => candidate.to),
      ),
    ],
    reason: explainChessGuidance(state, valid),
  };
}
