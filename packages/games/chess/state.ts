import type { Player, TwoPlayerState } from '../../core/src/game.ts';

export type ChessPieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
export type ChessPromotion = Exclude<ChessPieceType, 'king' | 'pawn'>;
export interface ChessPiece {
  owner: Player;
  type: ChessPieceType;
}
export interface ChessMove {
  from: number;
  to: number;
  promotion?: ChessPromotion;
}
export interface ChessCastlingRights {
  kingSide: boolean;
  queenSide: boolean;
}
export interface ChessState extends TwoPlayerState {
  gameId: 'chess';
  board: (ChessPiece | null)[];
  castling: [ChessCastlingRights, ChessCastlingRights];
  enPassant: number | null;
  halfmoveClock: number;
  positions: string[];
  lastMove: ChessMove | null;
  inCheck: boolean;
}

const backRank: ChessPieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

export function chessPosition(state: Pick<ChessState, 'board' | 'turn' | 'castling' | 'enPassant'>): string {
  const board = state.board
    .map((piece) => {
      if (!piece) return '.';
      const code: Record<ChessPieceType, string> = {
        king: 'k',
        queen: 'q',
        rook: 'r',
        bishop: 'b',
        knight: 'n',
        pawn: 'p',
      };
      const value = code[piece.type];
      return piece.owner === 0 ? value.toUpperCase() : value;
    })
    .join('');
  const rights = state.castling
    .map((right, player) => `${player}:${right.kingSide ? 'k' : '-'}${right.queenSide ? 'q' : '-'}`)
    .join('|');
  return `${state.turn}:${board}:${rights}:${state.enPassant ?? '-'}`;
}

export function createChess(): ChessState {
  const board: (ChessPiece | null)[] = Array(64).fill(null);
  for (let col = 0; col < 8; col++) {
    board[col] = { owner: 1, type: backRank[col] };
    board[8 + col] = { owner: 1, type: 'pawn' };
    board[48 + col] = { owner: 0, type: 'pawn' };
    board[56 + col] = { owner: 0, type: backRank[col] };
  }
  const state: ChessState = {
    gameId: 'chess',
    board,
    turn: 0,
    ply: 0,
    winner: null,
    drawReason: null,
    castling: [
      { kingSide: true, queenSide: true },
      { kingSide: true, queenSide: true },
    ],
    enPassant: null,
    halfmoveClock: 0,
    positions: [],
    lastMove: null,
    inCheck: false,
  };
  state.positions = [chessPosition(state)];
  return state;
}
