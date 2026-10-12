import { applyChess, chessLegalMoves, isChessInCheck } from './rules.ts';
import { chessPosition, type ChessMove, type ChessPiece, type ChessPieceType, type ChessState } from './state.ts';

const files = 'abcdefgh';
const pieceLetter: Record<Exclude<ChessPieceType, 'pawn'>, string> = {
  king: 'K',
  queen: 'Q',
  rook: 'R',
  bishop: 'B',
  knight: 'N',
};

export function chessSquare(index: number): string {
  return `${files[index % 8]}${8 - Math.floor(index / 8)}`;
}

export function chessSquareIndex(square: string): number {
  if (!/^[a-h][1-8]$/.test(square)) throw new Error('invalid-square');
  const file = files.indexOf(square[0]);
  const rank = Number(square[1]);
  return (8 - rank) * 8 + file;
}

export function chessToFen(state: ChessState): string {
  const rows: string[] = [];
  for (let row = 0; row < 8; row++) {
    let empty = 0;
    let out = '';
    for (let col = 0; col < 8; col++) {
      const piece = state.board[row * 8 + col];
      if (!piece) {
        empty++;
        continue;
      }
      if (empty) {
        out += empty;
        empty = 0;
      }
      const code: Record<ChessPieceType, string> = {
        king: 'k',
        queen: 'q',
        rook: 'r',
        bishop: 'b',
        knight: 'n',
        pawn: 'p',
      };
      const base = code[piece.type];
      out += piece.owner === 0 ? base.toUpperCase() : base;
    }
    if (empty) out += empty;
    rows.push(out);
  }
  const rights = [
    state.castling[0].kingSide ? 'K' : '',
    state.castling[0].queenSide ? 'Q' : '',
    state.castling[1].kingSide ? 'k' : '',
    state.castling[1].queenSide ? 'q' : '',
  ].join('') || '-';
  const enPassant = state.enPassant === null ? '-' : chessSquare(state.enPassant);
  const fullmove = Math.floor(state.ply / 2) + 1;
  return `${rows.join('/')} ${state.turn === 0 ? 'w' : 'b'} ${rights} ${enPassant} ${state.halfmoveClock} ${fullmove}`;
}

export function chessFromFen(fen: string): ChessState {
  const parts = fen.trim().split(/\s+/);
  if (parts.length !== 6) throw new Error('invalid-fen');
  const [placement, active, rights, enPassantText, halfmoveText, fullmoveText] = parts;
  const ranks = placement.split('/');
  if (ranks.length !== 8) throw new Error('invalid-fen');
  const board: (ChessPiece | null)[] = Array(64).fill(null);
  const decode: Record<string, ChessPieceType> = {
    k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn',
  };
  for (let row = 0; row < 8; row++) {
    let col = 0;
    for (const token of ranks[row]) {
      if (/^[1-8]$/.test(token)) {
        col += Number(token);
        continue;
      }
      const type = decode[token.toLowerCase()];
      if (!type || col >= 8) throw new Error('invalid-fen');
      board[row * 8 + col] = { owner: token === token.toUpperCase() ? 0 : 1, type };
      col++;
    }
    if (col !== 8) throw new Error('invalid-fen');
  }
  if (active !== 'w' && active !== 'b') throw new Error('invalid-fen');
  const turn = active === 'w' ? 0 : 1;
  const halfmoveClock = Number(halfmoveText);
  const fullmove = Number(fullmoveText);
  if (!Number.isInteger(halfmoveClock) || halfmoveClock < 0 || !Number.isInteger(fullmove) || fullmove < 1)
    throw new Error('invalid-fen');
  const state: ChessState = {
    gameId: 'chess',
    board,
    turn,
    ply: (fullmove - 1) * 2 + (turn === 1 ? 1 : 0),
    winner: null,
    drawReason: null,
    castling: [
      { kingSide: rights.includes('K'), queenSide: rights.includes('Q') },
      { kingSide: rights.includes('k'), queenSide: rights.includes('q') },
    ],
    enPassant: enPassantText === '-' ? null : chessSquareIndex(enPassantText),
    halfmoveClock,
    positions: [],
    lastMove: null,
    inCheck: false,
  };
  const whiteKings = board.filter((piece) => piece?.owner === 0 && piece.type === 'king').length;
  const blackKings = board.filter((piece) => piece?.owner === 1 && piece.type === 'king').length;
  if (whiteKings !== 1 || blackKings !== 1) throw new Error('invalid-fen-kings');
  state.inCheck = isChessInCheck(state, state.turn);
  state.positions = [chessPosition(state)];
  return state;
}

function isCapture(state: ChessState, move: ChessMove): boolean {
  const piece = state.board[move.from];
  if (state.board[move.to]) return true;
  return !!(
    piece?.type === 'pawn' &&
    state.enPassant === move.to &&
    move.from % 8 !== move.to % 8
  );
}

export function chessMoveToSan(state: ChessState, move: ChessMove): string {
  const legal = chessLegalMoves(state);
  const exact = legal.find(
    (candidate) =>
      candidate.from === move.from &&
      candidate.to === move.to &&
      candidate.promotion === move.promotion,
  );
  if (!exact) throw new Error('illegal-san-move');
  const piece = state.board[move.from]!;
  if (piece.type === 'king' && Math.abs(move.to - move.from) === 2) {
    const next = applyChess(state, move);
    const suffix = next.winner !== null ? '#' : next.inCheck ? '+' : '';
    return (move.to > move.from ? 'O-O' : 'O-O-O') + suffix;
  }

  const capture = isCapture(state, move);
  let san = piece.type === 'pawn' ? '' : pieceLetter[piece.type];
  if (piece.type === 'pawn' && capture) san += files[move.from % 8];
  if (piece.type !== 'pawn') {
    const conflicts = legal.filter(
      (candidate) =>
        candidate.to === move.to &&
        candidate.from !== move.from &&
        state.board[candidate.from]?.type === piece.type,
    );
    if (conflicts.length) {
      const sameFile = conflicts.some((candidate) => candidate.from % 8 === move.from % 8);
      const sameRank = conflicts.some(
        (candidate) => Math.floor(candidate.from / 8) === Math.floor(move.from / 8),
      );
      if (!sameFile) san += files[move.from % 8];
      else if (!sameRank) san += String(8 - Math.floor(move.from / 8));
      else san += chessSquare(move.from);
    }
  }
  if (capture) san += 'x';
  san += chessSquare(move.to);
  if (move.promotion) san += `=${pieceLetter[move.promotion]}`;

  const next = applyChess(state, move);
  if (next.winner !== null) san += '#';
  else if (next.inCheck) san += '+';
  return san;
}

export function chessMoveFromUci(uci: string): ChessMove {
  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci.trim().toLowerCase());
  if (!match) throw new Error('invalid-uci');
  const promotionMap = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' } as const;
  return {
    from: chessSquareIndex(match[1]),
    to: chessSquareIndex(match[2]),
    ...(match[3] ? { promotion: promotionMap[match[3] as keyof typeof promotionMap] } : {}),
  };
}
