import { opponent, type Player } from '../../core/src/game.ts';
import {
  chessLegalMoves,
  isChessInCheck,
  isInsufficientChessMaterial,
} from './rules.ts';
import {
  chessPosition,
  type ChessMove,
  type ChessPiece,
  type ChessPieceType,
  type ChessState,
} from './state.ts';

export interface ChessExpertOptions {
  /** Wall-clock budget for one move. Production defaults to 6.5 seconds. */
  budgetMs?: number;
  /** Maximum completed principal-search depth. */
  maxDepth?: number;
  /** Injectable monotonic-ish clock for tests. */
  now?: () => number;
  /** Disable the tiny deterministic opening book in tests/debugging. */
  useBook?: boolean;
}

const MATE = 10_000_000;
const INF = 20_000_000;
const PIECE_VALUE: Record<ChessPieceType, number> = {
  king: 20_000,
  queen: 900,
  rook: 500,
  bishop: 330,
  knight: 320,
  pawn: 100,
};

type Bound = 'exact' | 'lower' | 'upper';
interface TTEntry {
  depth: number;
  score: number;
  bound: Bound;
  best?: string;
}

const rowOf = (index: number) => Math.floor(index / 8);
const colOf = (index: number) => index % 8;
const moveKey = (move: ChessMove) => `${move.from}-${move.to}-${move.promotion ?? ''}`;
const currentSignature = (state: ChessState) => chessPosition(state);

function cloneBoard(board: (ChessPiece | null)[]) {
  return board.map((piece) => (piece ? { ...piece } : null));
}

function revokeRookRight(castling: ChessState['castling'], square: number) {
  if (square === 63) castling[0].kingSide = false;
  if (square === 56) castling[0].queenSide = false;
  if (square === 7) castling[1].kingSide = false;
  if (square === 0) castling[1].queenSide = false;
}

/**
 * Fast transition used only by the search after `chessLegalMoves` generated the move.
 * The public rules engine remains the authority and re-validates the final selected move.
 */
function advanceSearchState(state: ChessState, move: ChessMove): ChessState {
  const board = cloneBoard(state.board);
  const moving = board[move.from]!;
  let captured = board[move.to];
  board[move.from] = null;

  if (
    moving.type === 'pawn' &&
    state.enPassant === move.to &&
    !captured &&
    colOf(move.from) !== colOf(move.to)
  ) {
    const capturedAt = move.to + (moving.owner === 0 ? 8 : -8);
    captured = board[capturedAt];
    board[capturedAt] = null;
  }

  board[move.to] = move.promotion
    ? { owner: moving.owner, type: move.promotion }
    : moving;

  if (moving.type === 'king' && Math.abs(move.to - move.from) === 2) {
    const kingSide = move.to > move.from;
    const rookFrom = moving.owner === 0 ? (kingSide ? 63 : 56) : kingSide ? 7 : 0;
    const rookTo = kingSide ? move.to - 1 : move.to + 1;
    board[rookTo] = board[rookFrom];
    board[rookFrom] = null;
  }

  const castling = state.castling.map((right) => ({ ...right })) as ChessState['castling'];
  if (moving.type === 'king') {
    castling[moving.owner].kingSide = false;
    castling[moving.owner].queenSide = false;
  }
  if (moving.type === 'rook') revokeRookRight(castling, move.from);
  if (captured?.type === 'rook') revokeRookRight(castling, move.to);

  const enPassant =
    moving.type === 'pawn' && Math.abs(move.to - move.from) === 16
      ? (move.to + move.from) / 2
      : null;
  const nextTurn = opponent(state.turn);
  const next: ChessState = {
    ...state,
    board,
    castling,
    enPassant,
    halfmoveClock:
      moving.type === 'pawn' || captured ? 0 : state.halfmoveClock + 1,
    turn: nextTurn,
    ply: state.ply + 1,
    lastMove: { ...move },
    winner: null,
    drawReason: null,
    inCheck: false,
    positions: [...state.positions],
  };
  next.inCheck = isChessInCheck(next, nextTurn);
  next.positions.push(chessPosition(next));
  return next;
}

function repetitionCount(state: ChessState): number {
  const signature = currentSignature(state);
  let count = 0;
  for (const position of state.positions) if (position === signature) count++;
  return count;
}

function automaticDraw(state: ChessState): boolean {
  return (
    !!state.drawReason ||
    state.halfmoveClock >= 100 ||
    repetitionCount(state) >= 3 ||
    isInsufficientChessMaterial(state.board)
  );
}

function centerScore(row: number, col: number): number {
  return Math.max(0, 7 - (Math.abs(3.5 - row) + Math.abs(3.5 - col)) * 2);
}

function pieceSquareValue(piece: ChessPiece, index: number, ply: number, endgame: boolean): number {
  const row = rowOf(index);
  const col = colOf(index);
  const center = centerScore(row, col);
  const advance = piece.owner === 0 ? 7 - row : row;
  switch (piece.type) {
    case 'pawn':
      return advance * 8 + center * 2 - (col === 0 || col === 7 ? 4 : 0);
    case 'knight':
      return center * 9 - (row === 0 || row === 7 || col === 0 || col === 7 ? 12 : 0);
    case 'bishop':
      return center * 5 + (advance > 0 ? 6 : 0);
    case 'rook':
      return advance * 2 + center;
    case 'queen': {
      const home = piece.owner === 0 ? 59 : 3;
      const earlyPenalty = ply < 16 && index !== home ? 18 : 0;
      return center * 2 - earlyPenalty;
    }
    case 'king': {
      if (endgame) return center * 10;
      const homeRow = piece.owner === 0 ? 7 : 0;
      const castled = row === homeRow && (col === 6 || col === 2);
      const exposedCenter = center * 7;
      return (castled ? 45 : 0) - exposedCenter;
    }
  }
}

function pawnStructure(state: ChessState, player: Player): number {
  const ownFiles = Array(8).fill(0) as number[];
  const enemyPawns: number[] = [];
  const ownPawns: number[] = [];
  for (let index = 0; index < 64; index++) {
    const piece = state.board[index];
    if (piece?.type !== 'pawn') continue;
    if (piece.owner === player) {
      ownFiles[colOf(index)]++;
      ownPawns.push(index);
    } else enemyPawns.push(index);
  }

  let score = 0;
  for (let file = 0; file < 8; file++) {
    if (ownFiles[file] > 1) score -= (ownFiles[file] - 1) * 16;
  }
  for (const index of ownPawns) {
    const row = rowOf(index);
    const col = colOf(index);
    const isolated =
      (col === 0 || ownFiles[col - 1] === 0) &&
      (col === 7 || ownFiles[col + 1] === 0);
    if (isolated) score -= 11;

    const passed = !enemyPawns.some((enemy) => {
      const er = rowOf(enemy);
      const ec = colOf(enemy);
      if (Math.abs(ec - col) > 1) return false;
      return player === 0 ? er < row : er > row;
    });
    if (passed) {
      const advance = player === 0 ? 6 - row : row - 1;
      score += 18 + Math.max(0, advance) * 14;
    }
  }
  return score;
}

function rookFileBonus(state: ChessState, player: Player): number {
  let score = 0;
  for (let index = 0; index < 64; index++) {
    const rook = state.board[index];
    if (rook?.owner !== player || rook.type !== 'rook') continue;
    const file = colOf(index);
    let ownPawn = false;
    let anyPawn = false;
    for (let row = 0; row < 8; row++) {
      const piece = state.board[row * 8 + file];
      if (piece?.type !== 'pawn') continue;
      anyPawn = true;
      if (piece.owner === player) ownPawn = true;
    }
    if (!ownPawn) score += anyPawn ? 12 : 24;
  }
  return score;
}

function kingShield(state: ChessState, player: Player, endgame: boolean): number {
  if (endgame) return 0;
  const king = state.board.findIndex((piece) => piece?.owner === player && piece.type === 'king');
  if (king < 0) return -500;
  const row = rowOf(king);
  const col = colOf(king);
  const dir = player === 0 ? -1 : 1;
  let shield = 0;
  for (const dc of [-1, 0, 1]) {
    const r = row + dir;
    const c = col + dc;
    if (r < 0 || r > 7 || c < 0 || c > 7) continue;
    const piece = state.board[r * 8 + c];
    if (piece?.owner === player && piece.type === 'pawn') shield += 12;
  }
  return shield;
}

function evaluate(state: ChessState, root: Player): number {
  let nonPawnMaterial = 0;
  for (const piece of state.board) {
    if (piece && piece.type !== 'pawn' && piece.type !== 'king') nonPawnMaterial += PIECE_VALUE[piece.type];
  }
  const endgame = nonPawnMaterial <= 2600;
  const bishops = [0, 0];
  let score = 0;

  for (let index = 0; index < 64; index++) {
    const piece = state.board[index];
    if (!piece) continue;
    if (piece.type === 'bishop') bishops[piece.owner]++;
    const value =
      (piece.type === 'king' ? 0 : PIECE_VALUE[piece.type]) +
      pieceSquareValue(piece, index, state.ply, endgame);
    score += piece.owner === root ? value : -value;
  }

  for (const player of [0, 1] as const) {
    let positional = pawnStructure(state, player) + rookFileBonus(state, player) + kingShield(state, player, endgame);
    if (bishops[player] >= 2) positional += 28;
    if (state.castling[player].kingSide || state.castling[player].queenSide) positional += 8;
    score += player === root ? positional : -positional;
  }

  if (state.inCheck) score += state.turn === root ? -42 : 42;
  score += state.turn === root ? 7 : -7;
  return score;
}

function capturedPiece(state: ChessState, move: ChessMove): ChessPiece | null {
  const direct = state.board[move.to];
  if (direct) return direct;
  const moving = state.board[move.from];
  if (
    moving?.type === 'pawn' &&
    state.enPassant === move.to &&
    colOf(move.from) !== colOf(move.to)
  ) {
    return state.board[move.to + (moving.owner === 0 ? 8 : -8)];
  }
  return null;
}

function isQuiet(state: ChessState, move: ChessMove): boolean {
  return !capturedPiece(state, move) && !move.promotion;
}

function openingBook(state: ChessState): ChessMove | null {
  if (state.turn !== 1 || state.ply !== 1 || !state.lastMove) return null;
  const first = moveKey(state.lastMove);
  const reply: Record<string, ChessMove> = {
    '52-36-': { from: 10, to: 26 }, // 1.e4 c5 — Sicilian Defence
    '51-35-': { from: 6, to: 21 }, // 1.d4 Nf6 — Indian setups
    '50-34-': { from: 12, to: 28 }, // 1.c4 e5 — English
    '62-45-': { from: 11, to: 27 }, // 1.Nf3 d5
  };
  return reply[first] ?? { from: 12, to: 28 }; // sound central reply to uncommon first moves
}

export function chooseChessExpertMove(
  state: ChessState,
  options: ChessExpertOptions = {},
): ChessMove | null {
  if (state.winner !== null || state.drawReason) return null;
  const legalRoot = chessLegalMoves(state);
  if (!legalRoot.length) return null;

  if (options.useBook !== false) {
    const book = openingBook(state);
    if (book && legalRoot.some((move) => moveKey(move) === moveKey(book))) return book;
  }

  const now = options.now ?? Date.now;
  const deadline = now() + (options.budgetMs ?? 6500);
  const maxDepth = Math.max(2, Math.min(8, options.maxDepth ?? 7));
  const root = state.turn;
  const transposition = new Map<string, TTEntry>();
  const history = new Map<string, number>();
  const killers = new Map<number, string[]>();
  const TIMEOUT = Symbol('chess-expert-timeout');
  let nodes = 0;

  const checkTime = () => {
    nodes++;
    if ((nodes & 127) === 0 && now() >= deadline) throw TIMEOUT;
  };

  const ttKey = (position: ChessState) => {
    const signature = currentSignature(position);
    let repetitions = 0;
    for (const previous of position.positions) if (previous === signature) repetitions++;
    return `${signature}|h${position.halfmoveClock}|r${Math.min(3, repetitions)}`;
  };

  const orderMoves = (
    position: ChessState,
    moves: ChessMove[],
    ply: number,
    ttBest?: string,
  ) => {
    const killer = killers.get(ply) ?? [];
    return [...moves].sort((a, b) => scoreMove(b) - scoreMove(a));

    function scoreMove(move: ChessMove) {
      const key = moveKey(move);
      let score = 0;
      if (key === ttBest) score += 2_000_000;
      const captured = capturedPiece(position, move);
      const attacker = position.board[move.from];
      if (captured && attacker)
        score += 500_000 + PIECE_VALUE[captured.type] * 16 - PIECE_VALUE[attacker.type];
      if (move.promotion) score += 420_000 + PIECE_VALUE[move.promotion] * 8;
      if (attacker?.type === 'king' && Math.abs(move.to - move.from) === 2) score += 28_000;
      if (killer[0] === key) score += 22_000;
      else if (killer[1] === key) score += 14_000;
      score += history.get(key) ?? 0;
      score += Math.round(centerScore(rowOf(move.to), colOf(move.to)) * 8);
      return score;
    }
  };

  const mateScore = (position: ChessState, ply: number) =>
    position.turn === root ? -MATE + ply : MATE - ply;

  const quiescence = (
    position: ChessState,
    alphaInput: number,
    betaInput: number,
    ply: number,
    depth: number,
  ): number => {
    checkTime();
    if (automaticDraw(position)) return 0;
    const moves = chessLegalMoves(position);
    if (!moves.length) return position.inCheck ? mateScore(position, ply) : 0;

    const maximize = position.turn === root;
    let alpha = alphaInput;
    let beta = betaInput;
    let stand = evaluate(position, root);
    if (!position.inCheck) {
      if (maximize) {
        if (stand >= beta) return stand;
        alpha = Math.max(alpha, stand);
      } else {
        if (stand <= alpha) return stand;
        beta = Math.min(beta, stand);
      }
    }
    if (depth <= 0) return stand;

    const tactical = position.inCheck
      ? moves
      : moves.filter((move) => !!capturedPiece(position, move) || !!move.promotion);
    if (!tactical.length) return stand;
    const ordered = orderMoves(position, tactical, ply);

    let best = maximize ? -INF : INF;
    for (const move of ordered) {
      const child = advanceSearchState(position, move);
      const score = quiescence(child, alpha, beta, ply + 1, depth - 1);
      if (maximize) {
        best = Math.max(best, score);
        alpha = Math.max(alpha, best);
      } else {
        best = Math.min(best, score);
        beta = Math.min(beta, best);
      }
      if (alpha >= beta) break;
    }
    return best === -INF || best === INF ? stand : best;
  };

  const search = (
    position: ChessState,
    depth: number,
    alphaInput: number,
    betaInput: number,
    ply: number,
  ): number => {
    checkTime();
    if (automaticDraw(position)) return 0;

    const key = ttKey(position);
    const cached = transposition.get(key);
    let alpha = alphaInput;
    let beta = betaInput;
    if (cached && cached.depth >= depth) {
      if (cached.bound === 'exact') return cached.score;
      if (cached.bound === 'lower') alpha = Math.max(alpha, cached.score);
      else beta = Math.min(beta, cached.score);
      if (alpha >= beta) return cached.score;
    }

    const moves = chessLegalMoves(position);
    if (!moves.length) return position.inCheck ? mateScore(position, ply) : 0;
    if (depth <= 0) return quiescence(position, alpha, beta, ply, 3);

    const originalAlpha = alpha;
    const originalBeta = beta;
    const maximize = position.turn === root;
    const ordered = orderMoves(position, moves, ply, cached?.best);
    let bestScore = maximize ? -INF : INF;
    let bestMove: ChessMove | undefined;

    for (let index = 0; index < ordered.length; index++) {
      const move = ordered[index];
      const child = advanceSearchState(position, move);
      const quiet = isQuiet(position, move);
      const canReduce =
        depth >= 3 &&
        index >= 4 &&
        quiet &&
        !position.inCheck &&
        !child.inCheck;
      const reducedDepth = canReduce ? Math.max(0, depth - 2) : depth - 1;
      let score = search(child, reducedDepth, alpha, beta, ply + 1);

      // Late-move reduction is only a probe. Re-search at full depth if it can
      // change the principal variation or alpha/beta window.
      if (canReduce && (maximize ? score > alpha : score < beta))
        score = search(child, depth - 1, alpha, beta, ply + 1);

      if (maximize) {
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
        alpha = Math.max(alpha, bestScore);
      } else {
        if (score < bestScore) {
          bestScore = score;
          bestMove = move;
        }
        beta = Math.min(beta, bestScore);
      }

      if (alpha >= beta) {
        if (quiet) {
          const keyMove = moveKey(move);
          const previous = killers.get(ply) ?? [];
          if (previous[0] !== keyMove) killers.set(ply, [keyMove, previous[0]].filter(Boolean));
          history.set(keyMove, Math.min(200_000, (history.get(keyMove) ?? 0) + depth * depth * 32));
        }
        break;
      }
    }

    const bound: Bound =
      bestScore <= originalAlpha ? 'upper' : bestScore >= originalBeta ? 'lower' : 'exact';
    transposition.set(key, {
      depth,
      score: bestScore,
      bound,
      ...(bestMove ? { best: moveKey(bestMove) } : {}),
    });
    if (transposition.size > 80_000) transposition.clear();
    return bestScore;
  };

  let bestMove = legalRoot[0];
  let previousBest = moveKey(bestMove);
  let completedDepth = 0;

  for (let depth = 1; depth <= maxDepth; depth++) {
    if (now() >= deadline) break;
    const ordered = orderMoves(state, legalRoot, 0, previousBest);
    let iterationBest = bestMove;
    let iterationScore = -INF;
    let complete = true;

    try {
      for (const move of ordered) {
        const child = advanceSearchState(state, move);
        const score = search(child, depth - 1, -INF, INF, 1);
        if (score > iterationScore) {
          iterationScore = score;
          iterationBest = move;
        }
      }
    } catch (error) {
      if (error !== TIMEOUT) throw error;
      complete = false;
    }

    if (!complete) break;
    bestMove = iterationBest;
    previousBest = moveKey(bestMove);
    completedDepth = depth;

    // A forced mate found inside the completed horizon does not need more time.
    if (Math.abs(iterationScore) >= MATE - 1000) break;
  }

  // `completedDepth` intentionally exists as a local invariant: we only publish
  // a move from a fully completed iteration. Depth zero falls back to a legal move.
  void completedDepth;
  return bestMove;
}
