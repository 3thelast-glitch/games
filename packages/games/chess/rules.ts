import {
  RuleError,
  isGameOver,
  opponent,
  type Player,
  type RulesEngine,
  type Validation,
} from '../../core/src/game.ts';
import {
  chessPosition,
  createChess,
  type ChessMove,
  type ChessPiece,
  type ChessPieceType,
  type ChessPromotion,
  type ChessState,
} from './state.ts';

const PROMOTIONS: ChessPromotion[] = ['queen', 'rook', 'bishop', 'knight'];
const MATERIAL: Record<ChessPieceType, number> = {
  king: 0,
  queen: 900,
  rook: 500,
  bishop: 330,
  knight: 320,
  pawn: 100,
};
const KNIGHT_STEPS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
] as const;
const KING_STEPS = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1],
  [0, 1], [1, -1], [1, 0], [1, 1],
] as const;
const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const;
const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;

const inside = (row: number, col: number) => row >= 0 && row < 8 && col >= 0 && col < 8;
const indexOf = (row: number, col: number) => row * 8 + col;
const rowOf = (index: number) => Math.floor(index / 8);
const colOf = (index: number) => index % 8;
const square = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) < 64;

export function parseChessMove(input: unknown): ChessMove {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RuleError('invalid-move');
  const move = input as Record<string, unknown>;
  if (Object.keys(move).some((key) => !['from', 'to', 'promotion'].includes(key))) throw new RuleError('invalid-move');
  if (!square(move.from) || !square(move.to) || move.from === move.to) throw new RuleError('invalid-move');
  if (move.promotion !== undefined && !PROMOTIONS.includes(move.promotion as ChessPromotion))
    throw new RuleError('invalid-move');
  return {
    from: move.from,
    to: move.to,
    ...(move.promotion ? { promotion: move.promotion as ChessPromotion } : {}),
  };
}

function kingSquare(board: (ChessPiece | null)[], player: Player): number {
  return board.findIndex((piece) => piece?.owner === player && piece.type === 'king');
}

export function isChessSquareAttacked(
  board: (ChessPiece | null)[],
  target: number,
  by: Player,
): boolean {
  const tr = rowOf(target), tc = colOf(target);
  const pawnRow = tr + (by === 0 ? 1 : -1);
  for (const dc of [-1, 1]) {
    const c = tc + dc;
    if (!inside(pawnRow, c)) continue;
    const piece = board[indexOf(pawnRow, c)];
    if (piece?.owner === by && piece.type === 'pawn') return true;
  }
  for (const [dr, dc] of KNIGHT_STEPS) {
    const r = tr + dr, c = tc + dc;
    if (!inside(r, c)) continue;
    const piece = board[indexOf(r, c)];
    if (piece?.owner === by && piece.type === 'knight') return true;
  }
  for (const [dr, dc] of KING_STEPS) {
    const r = tr + dr, c = tc + dc;
    if (!inside(r, c)) continue;
    const piece = board[indexOf(r, c)];
    if (piece?.owner === by && piece.type === 'king') return true;
  }
  const scan = (dirs: readonly (readonly [number, number])[], types: ChessPieceType[]) => {
    for (const [dr, dc] of dirs) {
      let r = tr + dr, c = tc + dc;
      while (inside(r, c)) {
        const piece = board[indexOf(r, c)];
        if (piece) {
          if (piece.owner === by && types.includes(piece.type)) return true;
          break;
        }
        r += dr;
        c += dc;
      }
    }
    return false;
  };
  return scan(BISHOP_DIRS, ['bishop', 'queen']) || scan(ROOK_DIRS, ['rook', 'queen']);
}

export function isChessInCheck(state: Pick<ChessState, 'board'>, player: Player): boolean {
  const king = kingSquare(state.board, player);
  return king < 0 || isChessSquareAttacked(state.board, king, opponent(player));
}

function addSlidingMoves(state: ChessState, from: number, dirs: readonly (readonly [number, number])[]): ChessMove[] {
  const piece = state.board[from]!;
  const result: ChessMove[] = [];
  for (const [dr, dc] of dirs) {
    let row = rowOf(from) + dr, col = colOf(from) + dc;
    while (inside(row, col)) {
      const to = indexOf(row, col), target = state.board[to];
      if (!target) result.push({ from, to });
      else {
        if (target.owner !== piece.owner && target.type !== 'king') result.push({ from, to });
        break;
      }
      row += dr;
      col += dc;
    }
  }
  return result;
}

function pseudoMoves(state: ChessState, from: number): ChessMove[] {
  const piece = state.board[from];
  if (!piece || piece.owner !== state.turn) return [];
  const row = rowOf(from), col = colOf(from), result: ChessMove[] = [];
  const addStep = (r: number, c: number) => {
    if (!inside(r, c)) return;
    const to = indexOf(r, c), target = state.board[to];
    if (!target || (target.owner !== piece.owner && target.type !== 'king')) result.push({ from, to });
  };

  if (piece.type === 'pawn') {
    const dir = piece.owner === 0 ? -1 : 1;
    const start = piece.owner === 0 ? 6 : 1;
    const promotionRow = piece.owner === 0 ? 0 : 7;
    const oneRow = row + dir;
    if (inside(oneRow, col) && !state.board[indexOf(oneRow, col)]) {
      const to = indexOf(oneRow, col);
      if (oneRow === promotionRow) for (const promotion of PROMOTIONS) result.push({ from, to, promotion });
      else result.push({ from, to });
      const twoRow = row + dir * 2;
      if (row === start && !state.board[indexOf(twoRow, col)]) result.push({ from, to: indexOf(twoRow, col) });
    }
    for (const dc of [-1, 1]) {
      const r = row + dir, c = col + dc;
      if (!inside(r, c)) continue;
      const to = indexOf(r, c), target = state.board[to];
      const capture = target && target.owner !== piece.owner && target.type !== 'king';
      const enPassant = state.enPassant === to && !target;
      if (!capture && !enPassant) continue;
      if (r === promotionRow) for (const promotion of PROMOTIONS) result.push({ from, to, promotion });
      else result.push({ from, to });
    }
    return result;
  }
  if (piece.type === 'knight') {
    for (const [dr, dc] of KNIGHT_STEPS) addStep(row + dr, col + dc);
    return result;
  }
  if (piece.type === 'bishop') return addSlidingMoves(state, from, BISHOP_DIRS);
  if (piece.type === 'rook') return addSlidingMoves(state, from, ROOK_DIRS);
  if (piece.type === 'queen') return addSlidingMoves(state, from, [...BISHOP_DIRS, ...ROOK_DIRS]);

  for (const [dr, dc] of KING_STEPS) addStep(row + dr, col + dc);
  const home = piece.owner === 0 ? 60 : 4;
  const rookKing = piece.owner === 0 ? 63 : 7;
  const rookQueen = piece.owner === 0 ? 56 : 0;
  const enemy = opponent(piece.owner);
  if (from === home && !isChessSquareAttacked(state.board, home, enemy)) {
    if (
      state.castling[piece.owner].kingSide &&
      state.board[rookKing]?.owner === piece.owner &&
      state.board[rookKing]?.type === 'rook' &&
      !state.board[home + 1] &&
      !state.board[home + 2] &&
      !isChessSquareAttacked(state.board, home + 1, enemy) &&
      !isChessSquareAttacked(state.board, home + 2, enemy)
    ) result.push({ from, to: home + 2 });
    if (
      state.castling[piece.owner].queenSide &&
      state.board[rookQueen]?.owner === piece.owner &&
      state.board[rookQueen]?.type === 'rook' &&
      !state.board[home - 1] &&
      !state.board[home - 2] &&
      !state.board[home - 3] &&
      !isChessSquareAttacked(state.board, home - 1, enemy) &&
      !isChessSquareAttacked(state.board, home - 2, enemy)
    ) result.push({ from, to: home - 2 });
  }
  return result;
}

function moveBoard(state: ChessState, move: ChessMove): { board: (ChessPiece | null)[]; captured: ChessPiece | null } {
  const board = state.board.map((piece) => (piece ? { ...piece } : null));
  const piece = board[move.from]!;
  let captured = board[move.to];
  board[move.from] = null;
  if (piece.type === 'pawn' && state.enPassant === move.to && !captured && colOf(move.from) !== colOf(move.to)) {
    const capturedAt = move.to + (piece.owner === 0 ? 8 : -8);
    captured = board[capturedAt];
    board[capturedAt] = null;
  }
  board[move.to] = move.promotion ? { owner: piece.owner, type: move.promotion } : piece;
  if (piece.type === 'king' && Math.abs(move.to - move.from) === 2) {
    const kingSide = move.to > move.from;
    const rookFrom = piece.owner === 0 ? (kingSide ? 63 : 56) : (kingSide ? 7 : 0);
    const rookTo = kingSide ? move.to - 1 : move.to + 1;
    board[rookTo] = board[rookFrom];
    board[rookFrom] = null;
  }
  return { board, captured };
}

export function chessLegalMoves(state: ChessState): ChessMove[] {
  if (isGameOver(state)) return [];
  const player = state.turn;
  const result: ChessMove[] = [];
  for (let from = 0; from < 64; from++) {
    if (state.board[from]?.owner !== player) continue;
    for (const move of pseudoMoves(state, from)) {
      const { board } = moveBoard(state, move);
      const king = kingSquare(board, player);
      if (king >= 0 && !isChessSquareAttacked(board, king, opponent(player))) result.push(move);
    }
  }
  return result;
}

export function validateChess(state: ChessState, move: ChessMove): Validation {
  try {
    const parsed = parseChessMove(move);
    if (isGameOver(state)) return { ok: false, code: 'game-over' };
    const piece = state.board[parsed.from];
    if (!piece || piece.owner !== state.turn) return { ok: false, code: 'illegal-chess-move' };
    const legal = chessLegalMoves(state).some(
      (candidate) =>
        candidate.from === parsed.from &&
        candidate.to === parsed.to &&
        candidate.promotion === parsed.promotion,
    );
    return legal ? { ok: true } : { ok: false, code: 'illegal-chess-move' };
  } catch {
    return { ok: false, code: 'invalid-move' };
  }
}

function revokeRookRight(state: ChessState, castling: ChessState['castling'], squareIndex: number) {
  if (squareIndex === 63) castling[0].kingSide = false;
  if (squareIndex === 56) castling[0].queenSide = false;
  if (squareIndex === 7) castling[1].kingSide = false;
  if (squareIndex === 0) castling[1].queenSide = false;
}

export function isInsufficientChessMaterial(board: (ChessPiece | null)[]): boolean {
  if (board.some((piece) => piece && ['pawn', 'rook', 'queen'].includes(piece.type))) return false;
  const minors = board.flatMap((piece, index) =>
    piece && (piece.type === 'bishop' || piece.type === 'knight') ? [{ piece, index }] : [],
  );
  if (minors.length <= 1) return true;
  if (minors.every(({ piece }) => piece.type === 'bishop')) {
    const colors = new Set(minors.map(({ index }) => (rowOf(index) + colOf(index)) % 2));
    return colors.size === 1;
  }
  return false;
}

export function applyChess(state: ChessState, input: ChessMove): ChessState {
  const move = parseChessMove(input);
  const validation = validateChess(state, move);
  if (!validation.ok) throw new RuleError(validation.code);
  const moving = state.board[move.from]!;
  const { board, captured } = moveBoard(state, move);
  const castling: ChessState['castling'] = state.castling.map((right) => ({ ...right })) as ChessState['castling'];
  if (moving.type === 'king') {
    castling[moving.owner].kingSide = false;
    castling[moving.owner].queenSide = false;
  }
  if (moving.type === 'rook') revokeRookRight(state, castling, move.from);
  if (captured?.type === 'rook') revokeRookRight(state, castling, move.to);
  const enPassant = moving.type === 'pawn' && Math.abs(move.to - move.from) === 16 ? (move.to + move.from) / 2 : null;
  const nextTurn = opponent(state.turn);
  const next: ChessState = {
    ...state,
    board,
    castling,
    enPassant,
    halfmoveClock: moving.type === 'pawn' || captured ? 0 : state.halfmoveClock + 1,
    turn: nextTurn,
    ply: state.ply + 1,
    lastMove: { ...move },
    winner: null,
    drawReason: null,
    inCheck: false,
    positions: [...state.positions],
  };
  next.inCheck = isChessInCheck(next, nextTurn);
  const signature = chessPosition(next);
  next.positions.push(signature);
  const replies = chessLegalMoves(next);
  if (!replies.length) {
    if (next.inCheck) next.winner = state.turn;
    else next.drawReason = 'stalemate';
    return next;
  }
  if (next.halfmoveClock >= 100) next.drawReason = 'fifty-move-rule';
  else if (next.positions.filter((position) => position === signature).length >= 3)
    next.drawReason = 'threefold-repetition';
  else if (isInsufficientChessMaterial(next.board)) next.drawReason = 'insufficient-material';
  return next;
}

export const chessEngine: RulesEngine<ChessState, ChessMove> = {
  id: 'chess',
  winReason: 'checkmate',
  create: createChess,
  parseMove: parseChessMove,
  validate: validateChess,
  apply: applyChess,
  legalMoves: chessLegalMoves,
  evaluate: (state, player) => {
    if (state.winner !== null) return state.winner === player ? 1_000_000 : -1_000_000;
    if (state.drawReason) return 0;
    let score = 0;
    for (let index = 0; index < 64; index++) {
      const piece = state.board[index];
      if (!piece) continue;
      const row = rowOf(index), col = colOf(index);
      const center = Math.max(0, 6 - (Math.abs(3.5 - row) + Math.abs(3.5 - col)) * 2);
      const pawnAdvance = piece.type === 'pawn' ? (piece.owner === 0 ? 6 - row : row - 1) * 5 : 0;
      const value = MATERIAL[piece.type] + center + pawnAdvance;
      score += piece.owner === player ? value : -value;
    }
    if (state.inCheck) score += state.turn === player ? -35 : 35;
    return score;
  },
};
