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
import {
  chessMoveAccuracy,
  chessMoveGrade,
  chessMoveNotation,
  type ChessMoveReview,
} from './review.ts';

export interface ChessExpertOptions {
  /** Wall-clock budget for one move. Production defaults to 6.5 seconds. */
  budgetMs?: number;
  /** Maximum completed principal-search depth. */
  maxDepth?: number;
  /** Injectable monotonic-ish clock for tests. */
  now?: () => number;
  /** Disable the opening repertoire in tests/debugging. */
  useBook?: boolean;
  /** Injectable randomness for opening variation selection. Defaults to Math.random. */
  random?: () => number;
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


export interface BlackOpeningReply {
  move: ChessMove;
  name: string;
  idea: string;
}

export interface BlackOpeningRepertoireEntry {
  whiteFirstMove: string;
  key: string;
  replies: readonly BlackOpeningReply[];
}

export const BLACK_OPENING_REPERTOIRE: readonly BlackOpeningRepertoireEntry[] = [
  {
    whiteFirstMove: 'e4',
    key: '52-36-',
    replies: [
      { move: { from: 10, to: 26 }, name: 'Sicilian Defence', idea: 'asymmetrical central control and active counterplay' },
      { move: { from: 12, to: 28 }, name: 'Open Game', idea: 'classical direct control of the center' },
      { move: { from: 12, to: 20 }, name: 'French Defense', idea: 'solid pawn chain followed by ...d5' },
      { move: { from: 10, to: 18 }, name: 'Caro-Kann', idea: 'solid center while keeping the light bishop flexible' },
      { move: { from: 11, to: 27 }, name: 'Scandinavian Defense', idea: 'challenge e4 immediately and force early clarification' },
      { move: { from: 11, to: 19 }, name: 'Pirc Defense', idea: 'allow a broad center, then undermine it from the flanks' },
      { move: { from: 6, to: 21 }, name: "Alekhine's Defense", idea: 'provoke white pawns forward and attack the extended center' },
      { move: { from: 14, to: 22 }, name: 'Modern Defense', idea: 'fianchetto quickly and attack the white center without committing the king knight' },
      { move: { from: 1, to: 18 }, name: 'Nimzowitsch Defense', idea: 'challenge the center with a piece before committing central pawns' },
      { move: { from: 9, to: 17 }, name: "Owen's Defense", idea: 'prepare ...Bb7 to pressure e4 and the long diagonal' },
      { move: { from: 8, to: 16 }, name: 'St. George Defense', idea: 'prepare ...b5 and immediate queenside expansion' },
    ],
  },
  {
    whiteFirstMove: 'd4',
    key: '51-35-',
    replies: [
      { move: { from: 6, to: 21 }, name: 'Indian Defenses', idea: 'flexible piece development before fixing the pawn structure' },
      { move: { from: 11, to: 27 }, name: "Queen's Pawn Game", idea: 'classical central control and Queen’s Gambit structures' },
      { move: { from: 13, to: 29 }, name: 'Dutch Defense', idea: 'fight for e4 and create kingside imbalance' },
      { move: { from: 10, to: 26 }, name: 'Benoni Defense', idea: 'cede space for dynamic queenside and central counterplay' },
      { move: { from: 12, to: 28 }, name: 'Englund Gambit', idea: 'offer a risky central pawn for rapid development and tactical chances' },
    ],
  },
  {
    whiteFirstMove: 'c4',
    key: '50-34-',
    replies: [
      { move: { from: 12, to: 28 }, name: 'Reversed English', idea: 'occupy the center directly against the English Opening' },
      { move: { from: 10, to: 26 }, name: 'Symmetrical English', idea: 'mirror the queenside structure and contest d4' },
      { move: { from: 6, to: 21 }, name: 'Anglo-Indian Defense', idea: 'develop flexibly before committing central pawns' },
    ],
  },
  {
    whiteFirstMove: 'Nf3',
    key: '62-45-',
    replies: [
      { move: { from: 11, to: 27 }, name: 'Réti: ...d5', idea: 'take direct central space before white can dominate e4' },
      { move: { from: 6, to: 21 }, name: 'Symmetrical Réti', idea: 'match development and keep the pawn structure flexible' },
    ],
  },
  {
    whiteFirstMove: 'f4',
    key: '53-37-',
    replies: [
      { move: { from: 12, to: 28 }, name: "From's Gambit", idea: 'counter Bird’s Opening immediately with ...e5 and rapid kingside activity' },
    ],
  },
] as const;

export const BLACK_OPENING_FOLLOW_UPS = [
  { name: 'Latvian Gambit', trigger: '1.e4 e5 2.Nf3 f5', idea: 'sacrifice the f-pawn for immediate central and kingside counterplay' },
  { name: 'Elephant Gambit', trigger: '1.e4 e5 2.Nf3 d5', idea: 'ignore the attacked e5 pawn and strike back in the center with ...d5' },
  { name: 'Albin Countergambit', trigger: '1.d4 d5 2.c4 e5', idea: 'offer e5 to create a dangerous advanced d-pawn and rapid activity' },
  { name: 'Tarrasch Defense', trigger: '1.d4 d5 2.c4 e6 then ...c5', idea: 'accept an isolated queen pawn in exchange for active piece play and central freedom' },
  { name: 'Baltic Defense', trigger: '1.d4 d5 2.c4 Bf5', idea: 'develop the queen bishop before closing the center and surprise Queen’s Gambit setups' },
  { name: "From's Gambit", trigger: '1.f4 e5', idea: 'counter Bird’s Opening with a sharp pawn sacrifice aimed at the white king' },
  { name: 'Petroff Defense', trigger: '1.e4 e5 2.Nf3', idea: 'counterattack e4 with ...Nf6 instead of defending passively' },
  { name: 'Philidor Defense', trigger: '1.e4 e5 2.Nf3', idea: 'support the e5 center with ...d6 and keep a compact structure' },
  { name: 'Modern Defense fianchetto', trigger: '1.e4 g6', idea: 'play ...Bg7 and attack the center from the long diagonal' },
  { name: 'Nimzowitsch Defense center strike', trigger: '1.e4 Nc6', idea: 'follow with ...d5 or ...e5 according to White’s setup' },
  { name: "Owen's Defense fianchetto", trigger: '1.e4 b6', idea: 'develop ...Bb7 and pressure e4 immediately' },
  { name: 'St. George queenside expansion', trigger: '1.e4 a6', idea: 'follow with ...b5 and seize queenside space' },
  { name: 'Nimzo-Indian Defense', trigger: '1.d4 Nf6 2.c4 e6 3.Nc3', idea: 'play ...Bb4 to pin the c3 knight and control e4' },
  { name: "King's Indian Defense", trigger: '1.d4 Nf6 2.c4 g6', idea: 'fianchetto the king bishop, concede space, then attack the center and kingside' },
  { name: 'Grünfeld Defense', trigger: '1.d4 Nf6 2.c4 g6 3.Nc3', idea: 'strike with ...d5 and attack White’s center with pieces and pawns' },
  { name: "Queen's Indian Defense", trigger: '1.d4 Nf6 2.c4 e6 3.Nf3', idea: 'play ...b6 and ...Bb7 to control the light squares' },
  { name: 'Budapest Gambit', trigger: '1.d4 Nf6 2.c4', idea: 'play ...e5 as a temporary pawn offer to disrupt White’s development' },
  { name: 'Old Indian Defense', trigger: '1.d4 Nf6 2.c4 d6', idea: 'use ...Nbd7 and a compact center with the bishop usually developed to e7' },
  { name: 'Benko Gambit', trigger: 'Benoni structure with white pawn on d5', idea: 'offer ...b5 for long-term pressure on open queenside files' },
  { name: 'Blumenfeld Gambit', trigger: '...Nf6/...e6/...c5 versus c4+d5', idea: 'offer ...b5 to build a powerful central pawn mass and queenside activity' },
  { name: 'Slav Defense', trigger: '1.d4 d5 2.c4', idea: 'support d5 with ...c6 while keeping the c8 bishop free' },
  { name: 'Semi-Slav Defense', trigger: 'Slav structure after ...c6', idea: 'add ...e6 for a resilient but tactically rich center' },
  { name: 'Chigorin Defense', trigger: '1.d4 d5 2.c4', idea: 'develop ...Nc6 and use piece pressure against d4' },
  { name: 'French ...d5 break', trigger: '1.e4 e6', idea: 'strike the white center immediately with ...d5' },
  { name: 'Caro-Kann ...d5 break', trigger: '1.e4 c6', idea: 'build a solid central challenge while keeping the c8 bishop available' },
  { name: 'Pirc fianchetto setup', trigger: '1.e4 d6', idea: 'develop ...Nf6/...g6 and undermine the broad white center later' },
  { name: 'Alekhine retreat to d5', trigger: '1.e4 Nf6 2.e5', idea: 'keep provoking and attacking the advanced pawn center' },
  { name: 'Open Game development', trigger: '1.e4 e5', idea: 'develop ...Nc6 and contest the classical center' },
  { name: 'Scandinavian recapture', trigger: '1.e4 d5 2.exd5', idea: 'recapture on d5 when legal and force an early concrete position' },
] as const;

export const BLACK_STRATEGIC_IDEAS = [
  { name: 'Deflection', idea: 'force a defender away from a critical square, line, or piece' },
  { name: 'Decoy', idea: 'lure an enemy piece onto a square where a tactical sequence becomes possible' },
  { name: 'The Pin', idea: 'immobilize a piece because moving it exposes a more valuable target' },
  { name: 'The Skewer', idea: 'attack a valuable piece first and capture the exposed piece behind it after it moves' },
  { name: 'Discovered Attack', idea: 'move one piece to uncover an attack from a rook, bishop, or queen behind it' },
  { name: 'Fianchetto', idea: 'develop a bishop to b7/g7 and control a long diagonal from distance' },
  { name: 'Undermining the Center', idea: 'challenge an extended pawn center with timely ...c5 or ...f5 breaks' },
  { name: 'Pawn Chain Break', idea: 'attack the base of an enemy pawn chain instead of its protected head' },
  { name: 'Isolated Queen Pawn', idea: 'accept an isolated d-pawn only when piece activity and central squares compensate for the weakness' },
  { name: 'Prophylaxis', idea: 'use restrained moves such as ...a6 or ...h6 when they prevent an enemy plan' },
  { name: 'The Blockade', idea: 'place a stable piece in front of an enemy passed pawn to stop and target it' },
  { name: 'Minority Attack', idea: 'advance a smaller queenside pawn group to create a fixed weakness in a larger chain' },
  { name: 'Outpost Creation', idea: 'occupy a protected central square that enemy pawns cannot easily challenge' },
  { name: 'Good vs Bad Bishop', idea: 'prefer bishops whose pawn structure leaves useful diagonals open and improve restricted bishops' },
  { name: 'Pawn Storm', idea: 'push flank pawns toward the enemy king when the kings are castled on opposite wings' },
  { name: 'Zugzwang', idea: 'in simplified positions, search for moves that leave every enemy reply strategically harmful' },
  { name: 'Overloading', idea: 'increase pressure on a defender that must protect multiple important targets' },
  { name: 'The Exchange Sacrifice', idea: 'accept a rook-for-minor material deficit only when king attack or structure gives compensation' },
  { name: 'Interference', idea: 'insert a piece or tactic that cuts the support line between enemy defenders' },
  { name: 'X-Ray Attack', idea: 'exploit pressure through an intervening piece along a file, rank, or diagonal' },
  { name: 'Battery', idea: 'align queen/rook or queen/bishop so multiple pieces pressure the same line or target' },
  { name: 'Zwischenzug', idea: 'prefer a stronger forcing in-between move before an expected recapture when search proves it works' },
  { name: 'Smothered Mate', idea: 'recognize knight mating patterns around a boxed-in king through forcing search' },
  { name: 'The Windmill', idea: 'use repeated discovered checks and captures when the search finds a forcing cycle' },
  { name: 'Underpromotion', idea: 'allow promotion to knight, rook, or bishop when it is tactically superior to a queen' },
  { name: 'Clearance Sacrifice', idea: 'sacrifice or move a piece to vacate a critical square or line for a stronger attacking piece' },
  { name: 'The Desperado Piece', idea: 'extract maximum forcing value from a piece that is likely to be lost in the tactical sequence' },
  { name: 'Luft', idea: 'create a safe king escape square to reduce back-rank mating danger' },
  { name: 'Hanging Pawns', idea: 'use connected c/d pawns for space and activity while accounting for their long-term vulnerability' },
  { name: 'Backward Pawn', idea: 'identify a pawn that cannot advance safely and can become a durable target on an open or semi-open file' },
  { name: 'Overprotection', idea: 'assign extra defenders to a strong central point so surrounding pieces gain flexibility' },
  { name: 'Triangulation', idea: 'use endgame king move-order and tempo to return to the same position with the opponent to move' },
  { name: 'The Opposition', idea: 'in king endings, exploit direct king opposition to force the enemy king aside' },
] as const;

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

function fianchettoBonus(state: ChessState, player: Player): number {
  const targets = player === 0 ? [49, 54] : [9, 14]; // b2/g2 or b7/g7
  let score = 0;
  for (const index of targets) {
    const piece = state.board[index];
    if (piece?.owner === player && piece.type === 'bishop') score += 18;
  }
  return score;
}

function centerUnderminingBonus(state: ChessState, player: Player): number {
  const enemy = opponent(player);
  const enemyCenter = [27, 28, 35, 36].filter(
    (index) => state.board[index]?.owner === enemy && state.board[index]?.type === 'pawn',
  ).length;
  if (!enemyCenter) return 0;
  const breaks = player === 1
    ? [26, 29] // ...c5 / ...f5
    : [34, 37]; // c4 / f4
  return breaks.reduce(
    (score, index) =>
      score + (state.board[index]?.owner === player && state.board[index]?.type === 'pawn' ? 10 : 0),
    0,
  );
}

function pawnChainBreakBonus(state: ChessState, player: Player): number {
  const enemy = opponent(player);
  let score = 0;
  for (const target of [27, 28, 35, 36]) {
    const pawn = state.board[target];
    if (pawn?.owner !== enemy || pawn.type !== 'pawn') continue;
    const row = rowOf(target);
    const col = colOf(target);
    const sourceRow = row + (player === 0 ? 1 : -1);
    for (const dc of [-1, 1]) {
      const sourceCol = col + dc;
      if (sourceRow < 0 || sourceRow > 7 || sourceCol < 0 || sourceCol > 7) continue;
      const attacker = state.board[sourceRow * 8 + sourceCol];
      if (attacker?.owner === player && attacker.type === 'pawn') score += 8;
    }
  }
  return score;
}

function minorityAttackBonus(state: ChessState, player: Player): number {
  const enemy = opponent(player);
  const files = [0, 1, 2];
  const ownPawns: number[] = [];
  let enemyCount = 0;
  for (let index = 0; index < 64; index++) {
    const piece = state.board[index];
    if (piece?.type !== 'pawn' || !files.includes(colOf(index))) continue;
    if (piece.owner === player) ownPawns.push(index);
    else if (piece.owner === enemy) enemyCount++;
  }
  if (!ownPawns.length || ownPawns.length >= enemyCount) return 0;
  return ownPawns.reduce((score, index) => {
    const advance = player === 0 ? 6 - rowOf(index) : rowOf(index) - 1;
    return score + Math.max(0, advance) * 3;
  }, 0);
}

function outpostBonus(state: ChessState, player: Player): number {
  const enemy = opponent(player);
  const central = [26, 27, 28, 29, 34, 35, 36, 37];
  let score = 0;
  for (const index of central) {
    const piece = state.board[index];
    if (piece?.owner !== player || piece.type !== 'knight') continue;
    const row = rowOf(index);
    const col = colOf(index);
    const supportRow = row + (player === 0 ? 1 : -1);
    const supported = [-1, 1].some((dc) => {
      const c = col + dc;
      if (supportRow < 0 || supportRow > 7 || c < 0 || c > 7) return false;
      const p = state.board[supportRow * 8 + c];
      return p?.owner === player && p.type === 'pawn';
    });
    const enemyPawnRow = row + (enemy === 0 ? 1 : -1);
    const canBeChased = [-1, 1].some((dc) => {
      const c = col + dc;
      if (enemyPawnRow < 0 || enemyPawnRow > 7 || c < 0 || c > 7) return false;
      const p = state.board[enemyPawnRow * 8 + c];
      return p?.owner === enemy && p.type === 'pawn';
    });
    if (supported && !canBeChased) score += 24;
  }
  return score;
}

function blockadeBonus(state: ChessState, player: Player): number {
  const enemy = opponent(player);
  let score = 0;
  for (let index = 0; index < 64; index++) {
    const pawn = state.board[index];
    if (pawn?.owner !== enemy || pawn.type !== 'pawn') continue;
    const row = rowOf(index);
    const col = colOf(index);
    const ahead = index + (enemy === 0 ? -8 : 8);
    if (ahead < 0 || ahead >= 64) continue;
    const blocker = state.board[ahead];
    if (blocker?.owner !== player || !['knight', 'bishop', 'rook', 'king'].includes(blocker.type)) continue;

    const enemyPawns = state.board.some((piece, other) => {
      if (piece?.owner !== player || piece.type !== 'pawn') return false;
      const er = rowOf(other);
      const ec = colOf(other);
      if (Math.abs(ec - col) > 1) return false;
      return enemy === 0 ? er < row : er > row;
    });
    if (!enemyPawns) score += blocker.type === 'knight' ? 20 : 13;
  }
  return score;
}

function pawnStormBonus(state: ChessState, player: Player): number {
  const ownKing = state.board.findIndex((piece) => piece?.owner === player && piece.type === 'king');
  const enemyKing = state.board.findIndex((piece) => piece?.owner === opponent(player) && piece.type === 'king');
  if (ownKing < 0 || enemyKing < 0) return 0;
  const ownSide = colOf(ownKing) <= 3 ? 'queen' : 'king';
  const enemySide = colOf(enemyKing) <= 3 ? 'queen' : 'king';
  if (ownSide === enemySide) return 0;

  const targetFiles = enemySide === 'king' ? [5, 6, 7] : [0, 1, 2];
  let score = 0;
  for (let index = 0; index < 64; index++) {
    const pawn = state.board[index];
    if (pawn?.owner !== player || pawn.type !== 'pawn' || !targetFiles.includes(colOf(index))) continue;
    const advance = player === 0 ? 6 - rowOf(index) : rowOf(index) - 1;
    score += Math.max(0, advance) * 4;
  }
  return score;
}

function exchangeSacrificeCompensation(state: ChessState, player: Player): number {
  const enemy = opponent(player);
  let ownRooks = 0;
  let enemyRooks = 0;
  let ownMinors = 0;
  let enemyMinors = 0;
  for (const piece of state.board) {
    if (!piece) continue;
    if (piece.type === 'rook') {
      if (piece.owner === player) ownRooks++;
      else enemyRooks++;
    }
    if (piece.type === 'bishop' || piece.type === 'knight') {
      if (piece.owner === player) ownMinors++;
      else enemyMinors++;
    }
  }
  if (ownRooks >= enemyRooks || ownMinors <= enemyMinors) return 0;

  const king = state.board.findIndex((piece) => piece?.owner === enemy && piece.type === 'king');
  if (king < 0) return 0;
  const kr = rowOf(king);
  const kc = colOf(king);
  let attackers = 0;
  for (let index = 0; index < 64; index++) {
    const piece = state.board[index];
    if (piece?.owner !== player || !['queen', 'rook', 'bishop', 'knight'].includes(piece.type)) continue;
    const distance = Math.max(Math.abs(rowOf(index) - kr), Math.abs(colOf(index) - kc));
    if (distance <= 3) attackers++;
  }

  const shieldDirection = enemy === 0 ? -1 : 1;
  let shield = 0;
  for (const dc of [-1, 0, 1]) {
    const r = kr + shieldDirection;
    const col = kc + dc;
    if (r < 0 || r > 7 || col < 0 || col > 7) continue;
    const piece = state.board[r * 8 + col];
    if (piece?.owner === enemy && piece.type === 'pawn') shield++;
  }
  const damagedShield = 3 - shield;
  return Math.min(110, attackers * 9 + damagedShield * 14);
}

function prophylaxisBonus(state: ChessState, player: Player): number {
  const row = player === 0 ? 6 : 1;
  const advancedRow = player === 0 ? 5 : 2;
  let score = 0;
  for (const file of [0, 7]) {
    const home = state.board[row * 8 + file];
    const advanced = state.board[advancedRow * 8 + file];
    if (!home && advanced?.owner === player && advanced.type === 'pawn') score += 4;
  }
  return score;
}

function bishopQualityBonus(state: ChessState, player: Player): number {
  let score = 0;
  for (let index = 0; index < 64; index++) {
    const bishop = state.board[index];
    if (bishop?.owner !== player || bishop.type !== 'bishop') continue;
    const bishopColor = (rowOf(index) + colOf(index)) % 2;
    let ownPawnsOnColor = 0;
    for (let pawnIndex = 0; pawnIndex < 64; pawnIndex++) {
      const pawn = state.board[pawnIndex];
      if (pawn?.owner === player && pawn.type === 'pawn' &&
          (rowOf(pawnIndex) + colOf(pawnIndex)) % 2 === bishopColor) ownPawnsOnColor++;
    }
    score += Math.max(-18, 14 - ownPawnsOnColor * 5);
  }
  return score;
}

function isolatedQueenPawnActivity(state: ChessState, player: Player): number {
  const dFile = 3;
  const pawn = state.board.findIndex(
    (piece, index) => piece?.owner === player && piece.type === 'pawn' && colOf(index) === dFile,
  );
  if (pawn < 0) return 0;
  const hasAdjacentPawn = state.board.some(
    (piece, index) =>
      piece?.owner === player &&
      piece.type === 'pawn' &&
      Math.abs(colOf(index) - dFile) === 1,
  );
  if (hasAdjacentPawn) return 0;

  const row = rowOf(pawn);
  const advanced = player === 0 ? Math.max(0, 6 - row) : Math.max(0, row - 1);
  let activity = advanced * 4 - 10;
  for (let index = 0; index < 64; index++) {
    const piece = state.board[index];
    if (piece?.owner !== player || !['knight', 'bishop', 'rook', 'queen'].includes(piece.type)) continue;
    if (Math.abs(rowOf(index) - row) <= 2 && Math.abs(colOf(index) - dFile) <= 2) activity += 2;
  }
  return Math.min(18, activity);
}

function batteryBonus(state: ChessState, player: Player): number {
  const sliders: { index: number; type: ChessPieceType }[] = [];
  for (let index = 0; index < 64; index++) {
    const piece = state.board[index];
    if (piece?.owner === player && ['queen', 'rook', 'bishop'].includes(piece.type))
      sliders.push({ index, type: piece.type });
  }

  const clearLine = (a: number, b: number) => {
    const ar = rowOf(a), ac = colOf(a), br = rowOf(b), bc = colOf(b);
    const dr = Math.sign(br - ar), dc = Math.sign(bc - ac);
    if (!(ar === br || ac === bc || Math.abs(br - ar) === Math.abs(bc - ac))) return false;
    let r = ar + dr, col = ac + dc;
    while (r !== br || col !== bc) {
      if (state.board[r * 8 + col]) return false;
      r += dr;
      col += dc;
    }
    return true;
  };

  let score = 0;
  for (let i = 0; i < sliders.length; i++) {
    for (let j = i + 1; j < sliders.length; j++) {
      const a = sliders[i], b = sliders[j];
      if (!clearLine(a.index, b.index)) continue;
      const alignedStraight = rowOf(a.index) === rowOf(b.index) || colOf(a.index) === colOf(b.index);
      const alignedDiagonal =
        Math.abs(rowOf(a.index) - rowOf(b.index)) === Math.abs(colOf(a.index) - colOf(b.index));
      if (alignedStraight && (a.type === 'queen' || b.type === 'queen' || a.type === 'rook' || b.type === 'rook'))
        score += 8;
      if (alignedDiagonal && (a.type === 'queen' || b.type === 'queen') &&
          (a.type === 'bishop' || b.type === 'bishop')) score += 10;
    }
  }
  return Math.min(24, score);
}

function xRayPressureBonus(state: ChessState, player: Player): number {
  const directions = [
    [-1, -1], [-1, 0], [-1, 1], [0, -1],
    [0, 1], [1, -1], [1, 0], [1, 1],
  ] as const;
  let score = 0;

  for (let from = 0; from < 64; from++) {
    const piece = state.board[from];
    if (piece?.owner !== player || !['rook', 'bishop', 'queen'].includes(piece.type)) continue;
    for (const [dr, dc] of directions) {
      const diagonal = dr !== 0 && dc !== 0;
      if (piece.type === 'rook' && diagonal) continue;
      if (piece.type === 'bishop' && !diagonal) continue;
      let r = rowOf(from) + dr;
      let col = colOf(from) + dc;
      let blockerSeen = false;
      while (r >= 0 && r < 8 && col >= 0 && col < 8) {
        const target = state.board[r * 8 + col];
        if (target) {
          if (!blockerSeen) {
            if (target.owner === player) break;
            blockerSeen = true;
          } else {
            if (target.owner !== player && PIECE_VALUE[target.type] >= 500) score += 7;
            break;
          }
        }
        r += dr;
        col += dc;
      }
    }
  }
  return Math.min(28, score);
}

function luftBonus(state: ChessState, player: Player, endgame: boolean): number {
  if (endgame) return 0;
  const king = state.board.findIndex((piece) => piece?.owner === player && piece.type === 'king');
  if (king < 0 || rowOf(king) !== (player === 0 ? 7 : 0)) return 0;
  const homePawnRow = player === 0 ? 6 : 1;
  const luftRow = player === 0 ? 5 : 2;
  let score = 0;
  for (const file of [6, 7]) {
    const home = state.board[homePawnRow * 8 + file];
    const advanced = state.board[luftRow * 8 + file];
    if (!home && advanced?.owner === player && advanced.type === 'pawn') score += 6;
  }
  return Math.min(10, score);
}

function hangingPawnsBonus(state: ChessState, player: Player): number {
  const cPawn = state.board.findIndex(
    (piece, index) => piece?.owner === player && piece.type === 'pawn' && colOf(index) === 2,
  );
  const dPawn = state.board.findIndex(
    (piece, index) => piece?.owner === player && piece.type === 'pawn' && colOf(index) === 3,
  );
  if (cPawn < 0 || dPawn < 0) return 0;
  if (Math.abs(rowOf(cPawn) - rowOf(dPawn)) > 1) return 0;

  const hasWingSupport = state.board.some(
    (piece, index) =>
      piece?.owner === player &&
      piece.type === 'pawn' &&
      (colOf(index) === 1 || colOf(index) === 4),
  );
  if (hasWingSupport) return 0;

  const advanceC = player === 0 ? 6 - rowOf(cPawn) : rowOf(cPawn) - 1;
  const advanceD = player === 0 ? 6 - rowOf(dPawn) : rowOf(dPawn) - 1;
  const direction = player === 0 ? -8 : 8;
  const blocked =
    !!state.board[cPawn + direction] || !!state.board[dPawn + direction];
  return Math.max(-16, Math.min(16, (advanceC + advanceD) * 3 - (blocked ? 12 : 2)));
}

function backwardPawnPenalty(state: ChessState, player: Player): number {
  const enemy = opponent(player);
  let penalty = 0;
  for (let index = 0; index < 64; index++) {
    const pawn = state.board[index];
    if (pawn?.owner !== player || pawn.type !== 'pawn') continue;
    const row = rowOf(index);
    const col = colOf(index);
    const forward = index + (player === 0 ? -8 : 8);
    if (forward < 0 || forward >= 64) continue;

    const hasAdjacentSupport = state.board.some((piece, other) => {
      if (piece?.owner !== player || piece.type !== 'pawn') return false;
      if (Math.abs(colOf(other) - col) !== 1) return false;
      return player === 0 ? rowOf(other) <= row : rowOf(other) >= row;
    });
    if (hasAdjacentSupport) continue;

    const targetRow = rowOf(forward);
    const targetCol = colOf(forward);
    const enemySourceRow = targetRow + (enemy === 0 ? 1 : -1);
    const attackedByEnemyPawn = [-1, 1].some((dc) => {
      const sourceCol = targetCol + dc;
      if (enemySourceRow < 0 || enemySourceRow > 7 || sourceCol < 0 || sourceCol > 7) return false;
      const piece = state.board[enemySourceRow * 8 + sourceCol];
      return piece?.owner === enemy && piece.type === 'pawn';
    });
    if (attackedByEnemyPawn) penalty += 9;
  }
  return -Math.min(27, penalty);
}

function overprotectionBonus(state: ChessState, player: Player): number {
  const central = [27, 28, 35, 36];
  let score = 0;
  const knightSteps = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
  ] as const;

  for (const target of central) {
    const occupant = state.board[target];
    if (!occupant || occupant.owner !== player) continue;
    const tr = rowOf(target), tc = colOf(target);
    let defenders = 0;

    const pawnSourceRow = tr + (player === 0 ? 1 : -1);
    for (const dc of [-1, 1]) {
      const col = tc + dc;
      if (pawnSourceRow < 0 || pawnSourceRow > 7 || col < 0 || col > 7) continue;
      const pawn = state.board[pawnSourceRow * 8 + col];
      if (pawn?.owner === player && pawn.type === 'pawn') defenders++;
    }

    for (const [dr, dc] of knightSteps) {
      const r = tr + dr, col = tc + dc;
      if (r < 0 || r > 7 || col < 0 || col > 7) continue;
      const knight = state.board[r * 8 + col];
      if (knight?.owner === player && knight.type === 'knight') defenders++;
    }

    if (defenders >= 2) score += Math.min(12, (defenders - 1) * 4);
  }
  return score;
}

function oppositionBonus(state: ChessState, player: Player, endgame: boolean): number {
  if (!endgame) return 0;
  const ownKing = state.board.findIndex((piece) => piece?.owner === player && piece.type === 'king');
  const enemyKing = state.board.findIndex((piece) => piece?.owner === opponent(player) && piece.type === 'king');
  if (ownKing < 0 || enemyKing < 0) return 0;
  const sameFile = colOf(ownKing) === colOf(enemyKing) && Math.abs(rowOf(ownKing) - rowOf(enemyKing)) === 2;
  const sameRank = rowOf(ownKing) === rowOf(enemyKing) && Math.abs(colOf(ownKing) - colOf(enemyKing)) === 2;
  if (!sameFile && !sameRank) return 0;
  return state.turn === player ? -14 : 18;
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
    let positional =
      pawnStructure(state, player) +
      rookFileBonus(state, player) +
      kingShield(state, player, endgame) +
      fianchettoBonus(state, player) +
      centerUnderminingBonus(state, player) +
      pawnChainBreakBonus(state, player) +
      minorityAttackBonus(state, player) +
      outpostBonus(state, player) +
      blockadeBonus(state, player) +
      pawnStormBonus(state, player) +
      exchangeSacrificeCompensation(state, player) +
      prophylaxisBonus(state, player) +
      bishopQualityBonus(state, player) +
      isolatedQueenPawnActivity(state, player) +
      batteryBonus(state, player) +
      xRayPressureBonus(state, player) +
      luftBonus(state, player, endgame) +
      hangingPawnsBonus(state, player) +
      backwardPawnPenalty(state, player) +
      overprotectionBonus(state, player) +
      oppositionBonus(state, player, endgame);
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

function pickBookMove(
  legal: ChessMove[],
  choices: readonly ChessMove[],
  random: () => number,
): ChessMove | null {
  const available = choices.filter((choice) =>
    legal.some((move) => moveKey(move) === moveKey(choice)),
  );
  if (!available.length) return null;
  const roll = Math.min(0.999999, Math.max(0, random()));
  return available[Math.floor(roll * available.length)] ?? available[0];
}

function openingFollowUp(
  state: ChessState,
  legal: ChessMove[],
  random: () => number,
): ChessMove | null {
  if (state.turn !== 1) return null;

  // 1.e4 e5 2.Nf3: vary between Petroff, Philidor, and classical ...Nc6.
  if (state.ply === 3 &&
      state.board[36]?.owner === 0 && state.board[36]?.type === 'pawn' &&
      state.board[28]?.owner === 1 && state.board[28]?.type === 'pawn' &&
      state.board[45]?.owner === 0 && state.board[45]?.type === 'knight') {
    return pickBookMove(
      legal,
      [
        { from: 6, to: 21 },  // ...Nf6 Petroff
        { from: 11, to: 19 }, // ...d6 Philidor
        { from: 1, to: 18 },  // ...Nc6 classical Open Game
        { from: 13, to: 29 }, // ...f5 Latvian Gambit
        { from: 11, to: 27 }, // ...d5 Elephant Gambit
      ],
      random,
    );
  }

  // Modern Defense: after ...g6, complete the fianchetto with ...Bg7 when possible.
  if (state.ply === 3 &&
      state.board[36]?.owner === 0 && state.board[36]?.type === 'pawn' &&
      state.board[22]?.owner === 1 && state.board[22]?.type === 'pawn') {
    return pickBookMove(legal, [{ from: 5, to: 14 }, { from: 6, to: 21 }], random);
  }

  // Nimzowitsch Defense: hit the center with ...d5 or ...e5.
  if (state.ply === 3 &&
      state.board[36]?.owner === 0 && state.board[36]?.type === 'pawn' &&
      state.board[18]?.owner === 1 && state.board[18]?.type === 'knight') {
    return pickBookMove(legal, [{ from: 11, to: 27 }, { from: 12, to: 28 }], random);
  }

  // Owen's Defense: put the c8 bishop on b7.
  if (state.ply === 3 &&
      state.board[36]?.owner === 0 && state.board[36]?.type === 'pawn' &&
      state.board[17]?.owner === 1 && state.board[17]?.type === 'pawn') {
    return pickBookMove(legal, [{ from: 2, to: 9 }], random);
  }

  // St. George: follow ...a6 with ...b5.
  if (state.ply === 3 &&
      state.board[36]?.owner === 0 && state.board[36]?.type === 'pawn' &&
      state.board[16]?.owner === 1 && state.board[16]?.type === 'pawn') {
    return pickBookMove(legal, [{ from: 9, to: 25 }], random);
  }

  // Indian family after 1.d4 Nf6 2.c4: choose e6/g6/c5/d6/e5,
  // covering Nimzo/Queen's Indian, King's Indian/Grünfeld, Benoni,
  // Old Indian, and Budapest structures.
  if (state.ply === 3 &&
      state.board[35]?.owner === 0 && state.board[35]?.type === 'pawn' &&
      state.board[34]?.owner === 0 && state.board[34]?.type === 'pawn' &&
      state.board[21]?.owner === 1 && state.board[21]?.type === 'knight') {
    return pickBookMove(
      legal,
      [
        { from: 12, to: 20 }, // ...e6 — Nimzo/Queen's Indian
        { from: 14, to: 22 }, // ...g6 — King's Indian / Grünfeld
        { from: 10, to: 26 }, // ...c5 — Benoni
        { from: 11, to: 19 }, // ...d6 — Old Indian
        { from: 12, to: 28 }, // ...e5 — Budapest Gambit
      ],
      random,
    );
  }

  // Nimzo-Indian: ...e6 plus Nc3 invites ...Bb4.
  if (state.ply <= 7 &&
      state.board[21]?.owner === 1 && state.board[21]?.type === 'knight' &&
      state.board[20]?.owner === 1 && state.board[20]?.type === 'pawn' &&
      state.board[34]?.owner === 0 && state.board[34]?.type === 'pawn' &&
      state.board[42]?.owner === 0 && state.board[42]?.type === 'knight') {
    return pickBookMove(legal, [{ from: 5, to: 33 }], random);
  }

  // Queen's Indian: ...e6 plus Nf3 invites ...b6 and ...Bb7.
  if (state.ply <= 7 &&
      state.board[21]?.owner === 1 && state.board[21]?.type === 'knight' &&
      state.board[20]?.owner === 1 && state.board[20]?.type === 'pawn' &&
      state.board[10]?.owner === 1 && state.board[10]?.type === 'pawn' &&
      state.board[34]?.owner === 0 && state.board[34]?.type === 'pawn' &&
      state.board[45]?.owner === 0 && state.board[45]?.type === 'knight') {
    return pickBookMove(legal, [{ from: 9, to: 17 }, { from: 10, to: 26 }], random);
  }

  // Grünfeld: after ...Nf6/...g6 and Nc3, strike with ...d5.
  if (state.ply <= 7 &&
      state.board[21]?.owner === 1 && state.board[21]?.type === 'knight' &&
      state.board[22]?.owner === 1 && state.board[22]?.type === 'pawn' &&
      state.board[34]?.owner === 0 && state.board[34]?.type === 'pawn' &&
      state.board[42]?.owner === 0 && state.board[42]?.type === 'knight') {
    return pickBookMove(legal, [{ from: 11, to: 27 }], random);
  }

  // Old Indian: after ...Nf6/...d6, develop b8-knight to d7.
  if (state.ply <= 7 &&
      state.board[21]?.owner === 1 && state.board[21]?.type === 'knight' &&
      state.board[19]?.owner === 1 && state.board[19]?.type === 'pawn' &&
      state.board[1]?.owner === 1 && state.board[1]?.type === 'knight') {
    return pickBookMove(legal, [{ from: 1, to: 11 }, { from: 12, to: 28 }], random);
  }

  // Slav / Chigorin after 1.d4 d5 2.c4.
  if (state.ply === 3 &&
      state.board[35]?.owner === 0 && state.board[35]?.type === 'pawn' &&
      state.board[34]?.owner === 0 && state.board[34]?.type === 'pawn' &&
      state.board[27]?.owner === 1 && state.board[27]?.type === 'pawn') {
    return pickBookMove(
      legal,
      [
        { from: 10, to: 18 }, // ...c6 Slav
        { from: 1, to: 18 },  // ...Nc6 Chigorin
        { from: 12, to: 28 }, // ...e5 Albin Countergambit
        { from: 2, to: 29 },  // ...Bf5 Baltic Defense
        { from: 12, to: 20 }, // ...e6 Tarrasch setup
      ],
      random,
    );
  }

  // Tarrasch: after ...d5/...e6 against c4, challenge immediately with ...c5.
  if (state.ply <= 7 &&
      state.board[27]?.owner === 1 && state.board[27]?.type === 'pawn' &&
      state.board[20]?.owner === 1 && state.board[20]?.type === 'pawn' &&
      state.board[10]?.owner === 1 && state.board[10]?.type === 'pawn' &&
      state.board[34]?.owner === 0 && state.board[34]?.type === 'pawn' &&
      state.board[35]?.owner === 0 && state.board[35]?.type === 'pawn') {
    return pickBookMove(legal, [{ from: 10, to: 26 }], random);
  }

  // Semi-Slav: add ...e6 after the Slav structure is established.
  if (state.ply <= 7 &&
      state.board[27]?.owner === 1 && state.board[27]?.type === 'pawn' &&
      state.board[18]?.owner === 1 && state.board[18]?.type === 'pawn' &&
      state.board[34]?.owner === 0 && state.board[34]?.type === 'pawn') {
    return pickBookMove(legal, [{ from: 12, to: 20 }], random);
  }

  // Blumenfeld motif: ...Nf6/...e6/...c5 versus c4+d5, then ...b5.
  if (state.ply <= 9 &&
      state.board[21]?.owner === 1 && state.board[21]?.type === 'knight' &&
      state.board[20]?.owner === 1 && state.board[20]?.type === 'pawn' &&
      state.board[26]?.owner === 1 && state.board[26]?.type === 'pawn' &&
      state.board[34]?.owner === 0 && state.board[34]?.type === 'pawn' &&
      state.board[27]?.owner === 0 && state.board[27]?.type === 'pawn') {
    return pickBookMove(legal, [{ from: 9, to: 25 }], random);
  }

  // French: after 1.e4 e6, strike the center immediately with ...d5.
  if (state.ply === 3 && state.board[36]?.owner === 0 && state.board[36]?.type === 'pawn' &&
      state.board[20]?.owner === 1 && state.board[20]?.type === 'pawn') {
    return pickBookMove(legal, [{ from: 11, to: 27 }], random);
  }

  // Caro-Kann: after 1.e4 c6, establish ...d5 while preserving the c8 bishop.
  if (state.ply === 3 && state.board[36]?.owner === 0 && state.board[36]?.type === 'pawn' &&
      state.board[18]?.owner === 1 && state.board[18]?.type === 'pawn') {
    return pickBookMove(legal, [{ from: 11, to: 27 }], random);
  }

  // Pirc: prepare a kingside fianchetto and flexible pressure on the center.
  if (state.ply === 3 && state.board[36]?.owner === 0 && state.board[36]?.type === 'pawn' &&
      state.board[19]?.owner === 1 && state.board[19]?.type === 'pawn') {
    return pickBookMove(legal, [{ from: 6, to: 21 }, { from: 14, to: 22 }], random);
  }

  // Alekhine: if white advances e5, retreat to d5 and keep attacking the pawn center.
  if (state.ply === 3 && state.board[28]?.owner === 0 && state.board[28]?.type === 'pawn' &&
      state.board[21]?.owner === 1 && state.board[21]?.type === 'knight') {
    return pickBookMove(legal, [{ from: 21, to: 27 }], random);
  }

  // Generic Open Game development when White does not enter Petroff/Philidor patterns.
  if (state.ply === 3 && state.board[36]?.owner === 0 && state.board[36]?.type === 'pawn' &&
      state.board[28]?.owner === 1 && state.board[28]?.type === 'pawn') {
    return pickBookMove(legal, [{ from: 1, to: 18 }, { from: 6, to: 21 }, { from: 11, to: 19 }], random);
  }

  // Scandinavian: after exd5, recapture with the queen when legal.
  if (state.ply === 3 && state.board[27]?.owner === 0 && state.board[27]?.type === 'pawn' &&
      !state.board[11]) {
    return pickBookMove(legal, [{ from: 3, to: 27 }], random);
  }

  // English setups: flexible development.
  if (state.ply === 3 && state.board[34]?.owner === 0 && state.board[34]?.type === 'pawn') {
    return pickBookMove(legal, [{ from: 6, to: 21 }, { from: 1, to: 18 }, { from: 14, to: 22 }], random);
  }

  // Réti setups: develop and keep pressure on the center.
  if (state.ply === 3 && state.board[45]?.owner === 0 && state.board[45]?.type === 'knight') {
    return pickBookMove(legal, [{ from: 6, to: 21 }, { from: 10, to: 26 }, { from: 14, to: 22 }], random);
  }

  // Benko Gambit motif: with ...c5 and a white pawn on d5, offer ...b5 for open files.
  if (state.ply <= 7 && state.board[27]?.owner === 0 && state.board[27]?.type === 'pawn' &&
      state.board[26]?.owner === 1 && state.board[26]?.type === 'pawn' &&
      state.board[9]?.owner === 1 && state.board[9]?.type === 'pawn') {
    return pickBookMove(legal, [{ from: 9, to: 25 }], random);
  }

  return null;
}
function openingBook(state: ChessState, random: () => number): ChessMove | null {
  if (state.turn !== 1) return null;
  const legal = chessLegalMoves(state);
  const followUp = openingFollowUp(state, legal, random);
  if (followUp) return followUp;

  if (state.ply !== 1 || !state.lastMove) return null;
  const first = moveKey(state.lastMove);
  const repertoire = BLACK_OPENING_REPERTOIRE.find((entry) => entry.key === first);
  if (repertoire) return pickBookMove(legal, repertoire.replies.map((reply) => reply.move), random);

  // Sound generic central response for uncommon first moves.
  return pickBookMove(legal, [{ from: 12, to: 28 }], random);
}
export function chooseChessExpertMove(
  state: ChessState,
  options: ChessExpertOptions = {},
): ChessMove | null {
  if (state.winner !== null || state.drawReason) return null;
  const legalRoot = chessLegalMoves(state);
  if (!legalRoot.length) return null;

  if (options.useBook !== false) {
    const book = openingBook(state, options.random ?? Math.random);
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
    return moves
      .map((move) => ({ move, score: scoreMove(move) }))
      .sort((a, b) => b.score - a.score)
      .map(({ move }) => move);

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
      const child = advanceSearchState(position, move);
      if (child.inCheck) score += 180_000;
      if (move.promotion && move.promotion !== 'queen' && child.inCheck) score += 35_000;
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
      : moves.filter(
          (move) =>
            !!capturedPiece(position, move) ||
            !!move.promotion ||
            advanceSearchState(position, move).inCheck,
        );
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

export interface ChessMoveReviewOptions {
  budgetMs?: number;
  maxDepth?: number;
  now?: () => number;
}

function reviewPositionScore(state: ChessState, root: Player): number {
  const legal = chessLegalMoves(state);
  if (!legal.length) {
    if (state.inCheck) return state.turn === root ? -MATE : MATE;
    return 0;
  }
  if (automaticDraw(state)) return 0;
  return evaluate(state, root);
}

export function reviewChessMove(
  state: ChessState,
  move: ChessMove,
  options: ChessMoveReviewOptions = {},
): ChessMoveReview | null {
  if (state.winner !== null || state.drawReason) return null;

  const legal = chessLegalMoves(state);
  const played = legal.find((candidate) => moveKey(candidate) === moveKey(move));
  if (!played) return null;

  const root = state.turn;
  const bestMove = chooseChessExpertMove(state, {
    useBook: false,
    budgetMs: options.budgetMs ?? 450,
    maxDepth: options.maxDepth ?? 4,
    ...(options.now ? { now: options.now } : {}),
  });

  const playedState = advanceSearchState(state, played);
  const playedScore = reviewPositionScore(playedState, root);

  const best = bestMove && legal.some((candidate) => moveKey(candidate) === moveKey(bestMove))
    ? bestMove
    : played;
  const bestState = moveKey(best) === moveKey(played)
    ? playedState
    : advanceSearchState(state, best);
  const bestScore = reviewPositionScore(bestState, root);

  const isBestMove = moveKey(best) === moveKey(played);
  const centipawnLoss = isBestMove
    ? 0
    : Math.max(0, Math.min(5000, Math.round(bestScore - playedScore)));

  return {
    player: root,
    ply: state.ply + 1,
    move: { ...played },
    notation: chessMoveNotation(played),
    grade: chessMoveGrade(centipawnLoss, isBestMove),
    accuracy: chessMoveAccuracy(centipawnLoss, isBestMove),
    centipawnLoss,
    bestMove: best ? { ...best } : null,
    bestNotation: best ? chessMoveNotation(best) : null,
  };
}
