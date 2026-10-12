import { applyChess, chessLegalMoves, isChessSquareAttacked } from './rules.ts';
import { chessFromFen, chessMoveFromUci } from './notation.ts';
import type { ChessMove, ChessPieceType, ChessState } from './state.ts';

export type ChessPuzzleTheme =
  | 'fork'
  | 'pin'
  | 'skewer'
  | 'discoveredAttack'
  | 'deflection'
  | 'mate1'
  | 'mate2'
  | 'mate3'
  | 'promotion'
  | 'endgame';

export type ChessPuzzleDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface ChessPuzzle {
  id: string;
  version: 1;
  fen: string;
  sideToMove: 0 | 1;
  orientation: 0 | 1;
  themes: ChessPuzzleTheme[];
  difficulty: ChessPuzzleDifficulty;
  objectiveEn: string;
  objectiveAr: string;
  titleEn: string;
  titleAr: string;
  explanationEn: string;
  explanationAr: string;
  hintsEn: [string, string, string];
  hintsAr: [string, string, string];
  solutionLines: string[][];
  source: 'NAQLA original';
  license: 'Project original content';
}

type Color = 'w' | 'b';
type PieceCode = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
interface SeedPiece {
  color: Color;
  piece: PieceCode;
  square: string;
}
interface PuzzleSeed {
  pieces: SeedPiece[];
  turn: Color;
  line: string[];
}

const files = 'abcdefgh';

const themeText: Record<
  ChessPuzzleTheme,
  {
    titleEn: string;
    titleAr: string;
    objectiveEn: string;
    objectiveAr: string;
    explanationEn: string;
    explanationAr: string;
    hintsEn: [string, string, string];
    hintsAr: [string, string, string];
    difficulty: ChessPuzzleDifficulty;
  }
> = {
  fork: {
    titleEn: 'Knight fork',
    titleAr: 'شوكة الحصان',
    objectiveEn: 'Find the move that attacks two important targets at once.',
    objectiveAr: 'اعثر على النقلة التي تهاجم هدفين مهمين في الوقت نفسه.',
    explanationEn: 'A fork uses one piece to create two simultaneous threats.',
    explanationAr: 'الشوكة تستخدم قطعة واحدة لصنع تهديدين في الوقت نفسه.',
    hintsEn: ['Look for a knight jump with tempo.', 'Check squares attacked by the knight after it moves.', 'Find the jump that checks the king and also attacks the queen.'],
    hintsAr: ['ابحث عن قفزة حصان مع تهديد مباشر.', 'افحص المربعات التي سيهاجمها الحصان بعد النقلة.', 'ابحث عن قفزة تعطي كش وتهاجم الوزير أيضًا.'],
    difficulty: 'beginner',
  },
  pin: {
    titleEn: 'Pin',
    titleAr: 'تثبيت',
    objectiveEn: 'Create a pin that makes the defender unable to move freely.',
    objectiveAr: 'أنشئ تثبيتًا يمنع القطعة المدافعة من الحركة بحرية.',
    explanationEn: 'A pinned piece cannot move without exposing a more important piece behind it.',
    explanationAr: 'القطعة المثبتة لا تستطيع الحركة دون كشف قطعة أهم خلفها.',
    hintsEn: ['Look for a king and a piece on the same diagonal.', 'Your bishop can enter that diagonal.', 'Move the bishop so the knight sits between it and the king.'],
    hintsAr: ['ابحث عن ملك وقطعة على القطر نفسه.', 'يمكن لفيلك الدخول إلى ذلك القطر.', 'حرّك الفيل بحيث يصبح الحصان بينه وبين الملك.'],
    difficulty: 'beginner',
  },
  skewer: {
    titleEn: 'Skewer',
    titleAr: 'سيخ',
    objectiveEn: 'Check the king and win the valuable piece behind it.',
    objectiveAr: 'أعطِ كش للملك ثم اربح القطعة القيّمة خلفه.',
    explanationEn: 'A skewer attacks the more valuable front piece first, then captures what was behind it.',
    explanationAr: 'السيخ يهاجم القطعة الأهم في الأمام أولًا ثم يأخذ القطعة الموجودة خلفها.',
    hintsEn: ['Find a forcing rook check.', 'Line the rook up with the king and queen.', 'After the king moves, take the queen.'],
    hintsAr: ['ابحث عن كش إجباري بالرخ.', 'ضع الرخ على خط الملك والوزير.', 'بعد ابتعاد الملك خذ الوزير.'],
    difficulty: 'intermediate',
  },
  discoveredAttack: {
    titleEn: 'Discovered attack',
    titleAr: 'هجوم مكتشف',
    objectiveEn: 'Move the blocker and reveal an attack from the piece behind it.',
    objectiveAr: 'حرّك القطعة الحاجبة واكشف هجوم القطعة الموجودة خلفها.',
    explanationEn: 'The moved piece clears a line so another piece suddenly attacks a target.',
    explanationAr: 'تتحرك قطعة من الخط فتفتح المجال لقطعة أخرى كي تهاجم هدفًا فجأة.',
    hintsEn: ['One of your pieces is blocking a rook.', 'Move the bishop away with purpose.', 'Clear the file so the rook attacks the queen.'],
    hintsAr: ['إحدى قطعك تحجب الرخ.', 'حرّك الفيل إلى مربع مفيد.', 'افتح العمود حتى يهاجم الرخ الوزير.'],
    difficulty: 'intermediate',
  },
  deflection: {
    titleEn: 'Deflection',
    titleAr: 'إبعاد المدافع',
    objectiveEn: 'Force a defender away from the square or line it protects.',
    objectiveAr: 'أجبر القطعة المدافعة على الابتعاد عن المربع أو الخط الذي تحميه.',
    explanationEn: 'Deflection removes an important defender by forcing it to answer a more urgent threat.',
    explanationAr: 'إبعاد المدافع يزيل قطعة دفاعية مهمة عبر إجبارها على الرد على تهديد أكثر إلحاحًا.',
    hintsEn: ['Look for a forcing bishop capture with check.', 'The rook on f8 is tied to the king.', 'Force that rook away, then use the open back-rank line.'],
    hintsAr: ['ابحث عن أخذ إجباري بالفيل مع كش.', 'الرخ في f8 مرتبط بحماية الملك.', 'أبعد الرخ ثم استغل الخط المفتوح في الصف الخلفي.'],
    difficulty: 'advanced',
  },
  mate1: {
    titleEn: 'Mate in 1',
    titleAr: 'مات في نقلة',
    objectiveEn: 'Deliver checkmate in one move.',
    objectiveAr: 'نفّذ كش مات في نقلة واحدة.',
    explanationEn: 'The mating move checks the king and leaves no legal escape, block, or capture.',
    explanationAr: 'نقلة المات تعطي كش ولا تترك أي هروب أو صد أو أخذ قانوني.',
    hintsEn: ['Look at every check.', 'Restrict all king escapes first.', 'Choose the check that leaves zero legal replies.'],
    hintsAr: ['افحص كل نقلات الكش.', 'تأكد من منع كل مربعات هروب الملك.', 'اختر الكش الذي لا يترك أي رد قانوني.'],
    difficulty: 'beginner',
  },
  mate2: {
    titleEn: 'Mate in 2',
    titleAr: 'مات في نقلتين',
    objectiveEn: 'Force checkmate in two moves against every legal defense.',
    objectiveAr: 'افرِض كش مات في نقلتين مهما كان الدفاع القانوني.',
    explanationEn: 'A forced mate works against all legal replies, not only the stored demonstration line.',
    explanationAr: 'المات الإجباري ينجح أمام كل الردود القانونية وليس فقط أمام خط العرض المخزن.',
    hintsEn: ['Find a forcing first move.', 'Keep the king boxed after its reply.', 'Your second move must mate.'],
    hintsAr: ['ابحث عن نقلة أولى إجبارية.', 'أبقِ الملك محاصرًا بعد رده.', 'يجب أن تكون نقلتك الثانية مات.'],
    difficulty: 'intermediate',
  },
  mate3: {
    titleEn: 'Mate in 3',
    titleAr: 'مات في ثلاث نقلات',
    objectiveEn: 'Force checkmate in three moves against every legal defense.',
    objectiveAr: 'افرِض كش مات في ثلاث نقلات مهما كان الدفاع القانوني.',
    explanationEn: 'Coordinate king and queen so each move reduces the defender’s safe squares.',
    explanationAr: 'نسّق بين الملك والوزير بحيث تقلل كل نقلة مربعات الأمان المتاحة للخصم.',
    hintsEn: ['Improve the net before rushing the final check.', 'Use your king to take away escape squares.', 'Drive the king to the edge, then finish with the queen.'],
    hintsAr: ['حسّن شبكة المات قبل استعجال الكش الأخير.', 'استخدم ملكك لمنع مربعات الهروب.', 'ادفع الملك إلى الحافة ثم أنهِ المات بالوزير.'],
    difficulty: 'advanced',
  },
  promotion: {
    titleEn: 'Promotion',
    titleAr: 'ترقية',
    objectiveEn: 'Promote the pawn with the move that best serves the immediate position.',
    objectiveAr: 'رقِّ البيدق بالقطعة التي تخدم الوضعية الحالية مباشرة.',
    explanationEn: 'Promotion is a tactical choice: queen is common, but an underpromotion can create a special check or avoid a tactical problem.',
    explanationAr: 'الترقية قرار تكتيكي: الوزير هو الأشهر، لكن الترقية لقطعة أخرى قد تصنع كشًا خاصًا أو تتجنب مشكلة تكتيكية.',
    hintsEn: ['The pawn is one step from promotion.', 'Check which promoted piece creates the clearest threat.', 'Use the promotion encoded by the solution move.'],
    hintsAr: ['البيدق على بعد خطوة من الترقية.', 'افحص أي قطعة بعد الترقية تصنع أوضح تهديد.', 'استخدم نوع الترقية المحدد في نقلة الحل.'],
    difficulty: 'beginner',
  },
  endgame: {
    titleEn: 'Endgame tactic',
    titleAr: 'تكتيك نهاية اللعب',
    objectiveEn: 'Use king and pawn activity to create a forcing endgame threat.',
    objectiveAr: 'استخدم نشاط الملك والبيدق لصنع تهديد إجباري في نهاية اللعب.',
    explanationEn: 'In simplified positions, a checking pawn push or active king move can decide the race.',
    explanationAr: 'في الوضعيات المبسطة قد تحسم دفعة بيدق مع كش أو حركة ملك نشطة سباق البيادق.',
    hintsEn: ['Look for a forcing pawn push.', 'A pawn can give check diagonally after advancing.', 'Advance with tempo so the enemy king must react.'],
    hintsAr: ['ابحث عن دفعة بيدق إجبارية.', 'يمكن للبيدق إعطاء كش قطريًا بعد التقدم.', 'تقدم مع كسب تمبو حتى يضطر ملك الخصم للرد.'],
    difficulty: 'intermediate',
  },
};

function squareToRC(square: string): [number, number] {
  return [8 - Number(square[1]), files.indexOf(square[0])];
}
function rcToSquare(row: number, col: number): string {
  return `${files[col]}${8 - row}`;
}

type Transform = 'id' | 'file' | 'rotateSwap' | 'rankSwap' | 'transpose';

function transformSquare(square: string, transform: Transform): string {
  const [r, c] = squareToRC(square);
  if (transform === 'file') return rcToSquare(r, 7 - c);
  if (transform === 'rotateSwap') return rcToSquare(7 - r, 7 - c);
  if (transform === 'rankSwap') return rcToSquare(7 - r, c);
  if (transform === 'transpose') return rcToSquare(c, r);
  return square;
}

function transformColor(color: Color, transform: Transform): Color {
  return transform === 'rotateSwap' || transform === 'rankSwap'
    ? color === 'w' ? 'b' : 'w'
    : color;
}

function transformUci(uci: string, transform: Transform): string {
  const promotion = uci.length > 4 ? uci.slice(4) : '';
  return (
    transformSquare(uci.slice(0, 2), transform) +
    transformSquare(uci.slice(2, 4), transform) +
    promotion
  );
}

function seedFen(seed: PuzzleSeed): string {
  const board = new Map<string, string>();
  for (const piece of seed.pieces) {
    const code = piece.color === 'w' ? piece.piece : piece.piece.toLowerCase();
    board.set(piece.square, code);
  }
  const rows: string[] = [];
  for (let rank = 8; rank >= 1; rank--) {
    let empty = 0;
    let row = '';
    for (const file of files) {
      const piece = board.get(`${file}${rank}`);
      if (!piece) empty++;
      else {
        if (empty) row += empty;
        empty = 0;
        row += piece;
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return `${rows.join('/')} ${seed.turn} - - 0 1`;
}

function transformSeed(seed: PuzzleSeed, transform: Transform): PuzzleSeed {
  return {
    pieces: seed.pieces.map((piece) => ({
      ...piece,
      color: transformColor(piece.color, transform),
      square: transformSquare(piece.square, transform),
    })),
    turn: transformColor(seed.turn, transform),
    line: seed.line.map((move) => transformUci(move, transform)),
  };
}

function puzzle(
  id: string,
  theme: ChessPuzzleTheme,
  seed: PuzzleSeed,
): ChessPuzzle {
  const copy = themeText[theme];
  return {
    id,
    version: 1,
    fen: seedFen(seed),
    sideToMove: seed.turn === 'w' ? 0 : 1,
    orientation: seed.turn === 'w' ? 0 : 1,
    themes: [theme],
    difficulty: copy.difficulty,
    objectiveEn: copy.objectiveEn,
    objectiveAr: copy.objectiveAr,
    titleEn: copy.titleEn,
    titleAr: copy.titleAr,
    explanationEn: copy.explanationEn,
    explanationAr: copy.explanationAr,
    hintsEn: copy.hintsEn,
    hintsAr: copy.hintsAr,
    solutionLines: [seed.line],
    source: 'NAQLA original',
    license: 'Project original content',
  };
}

const transforms: Transform[] = ['id', 'file', 'rotateSwap', 'rankSwap', 'transpose'];

const nonPawnSeeds: Record<
  'fork' | 'pin' | 'skewer' | 'discoveredAttack' | 'deflection',
  PuzzleSeed
> = {
  fork: {
    turn: 'w',
    pieces: [
      { color: 'w', piece: 'K', square: 'a1' },
      { color: 'w', piece: 'N', square: 'e5' },
      { color: 'b', piece: 'K', square: 'h8' },
      { color: 'b', piece: 'Q', square: 'd8' },
    ],
    line: ['e5f7'],
  },
  pin: {
    turn: 'w',
    pieces: [
      { color: 'w', piece: 'K', square: 'a1' },
      { color: 'w', piece: 'B', square: 'c4' },
      { color: 'b', piece: 'K', square: 'e8' },
      { color: 'b', piece: 'N', square: 'c6' },
    ],
    line: ['c4b5'],
  },
  skewer: {
    turn: 'w',
    pieces: [
      { color: 'w', piece: 'K', square: 'g1' },
      { color: 'w', piece: 'R', square: 'a1' },
      { color: 'b', piece: 'K', square: 'e7' },
      { color: 'b', piece: 'Q', square: 'e8' },
    ],
    line: ['a1e1', 'e7d6', 'e1e8'],
  },
  discoveredAttack: {
    turn: 'w',
    pieces: [
      { color: 'w', piece: 'K', square: 'g1' },
      { color: 'w', piece: 'R', square: 'e1' },
      { color: 'w', piece: 'B', square: 'e2' },
      { color: 'b', piece: 'K', square: 'h8' },
      { color: 'b', piece: 'Q', square: 'e8' },
    ],
    line: ['e2b5'],
  },
  deflection: {
    turn: 'w',
    pieces: [
      { color: 'w', piece: 'K', square: 'g1' },
      { color: 'w', piece: 'Q', square: 'h5' },
      { color: 'w', piece: 'B', square: 'c4' },
      { color: 'w', piece: 'R', square: 'e1' },
      { color: 'b', piece: 'K', square: 'g8' },
      { color: 'b', piece: 'R', square: 'f8' },
      { color: 'b', piece: 'N', square: 'f7' },
      { color: 'b', piece: 'Q', square: 'd8' },
    ],
    line: ['c4f7', 'f8f7', 'e1e8'],
  },
};

const mateSeeds: Record<'mate1' | 'mate2' | 'mate3', PuzzleSeed[]> = {
  mate1: [
    ['c8', 'd8', 'a8', ['d8a5']],
    ['c8', 'e8', 'a8', ['e8a4']],
    ['c8', 'f8', 'a8', ['f8a3']],
    ['c8', 'g8', 'a8', ['g8a2']],
    ['c8', 'h8', 'a8', ['h8a1']],
  ].map(([wk, wq, bk, line]) => ({
    turn: 'w' as const,
    pieces: [
      { color: 'w' as const, piece: 'K' as const, square: wk as string },
      { color: 'w' as const, piece: 'Q' as const, square: wq as string },
      { color: 'b' as const, piece: 'K' as const, square: bk as string },
    ],
    line: line as string[],
  })),
  mate2: [
    ['d8', 'e8', 'a8', ['e8d7', 'a8b8', 'd7b7']],
    ['d8', 'f8', 'a8', ['f8e7', 'a8b8', 'e7b7']],
    ['d8', 'g8', 'a8', ['g8f7', 'a8b8', 'f7b7']],
    ['d8', 'h8', 'a8', ['h8g7', 'a8b8', 'g7b7']],
    ['d8', 'e6', 'a8', ['e6d7', 'a8b8', 'd7b7']],
  ].map(([wk, wq, bk, line]) => ({
    turn: 'w' as const,
    pieces: [
      { color: 'w' as const, piece: 'K' as const, square: wk as string },
      { color: 'w' as const, piece: 'Q' as const, square: wq as string },
      { color: 'b' as const, piece: 'K' as const, square: bk as string },
    ],
    line: line as string[],
  })),
  mate3: [
    ['f7', 'h5', 'b8', ['f7e7', 'b8a8', 'h5d5', 'a8b8', 'd5b7']],
    ['f7', 'f1', 'b8', ['f7e7', 'b8a8', 'f1b5', 'a8a7', 'b5b7']],
    ['d6', 'd2', 'b8', ['d6d7', 'b8a8', 'd2b4', 'a8a7', 'b4b7']],
    ['d6', 'd1', 'b8', ['d6d7', 'b8a8', 'd1b3', 'a8a7', 'b3b7']],
    ['e6', 'e2', 'b8', ['e6d7', 'b8a8', 'e2b5', 'a8a7', 'b5b7']],
  ].map(([wk, wq, bk, line]) => ({
    turn: 'w' as const,
    pieces: [
      { color: 'w' as const, piece: 'K' as const, square: wk as string },
      { color: 'w' as const, piece: 'Q' as const, square: wq as string },
      { color: 'b' as const, piece: 'K' as const, square: bk as string },
    ],
    line: line as string[],
  })),
};

const promotionSeeds: PuzzleSeed[] = [
  {
    turn: 'w',
    pieces: [
      { color: 'w', piece: 'K', square: 'h1' },
      { color: 'w', piece: 'P', square: 'a7' },
      { color: 'b', piece: 'K', square: 'h8' },
    ],
    line: ['a7a8q'],
  },
  {
    turn: 'w',
    pieces: [
      { color: 'w', piece: 'K', square: 'a1' },
      { color: 'w', piece: 'P', square: 'h7' },
      { color: 'b', piece: 'K', square: 'a8' },
    ],
    line: ['h7h8q'],
  },
  {
    turn: 'w',
    pieces: [
      { color: 'w', piece: 'K', square: 'a1' },
      { color: 'w', piece: 'P', square: 'f7' },
      { color: 'b', piece: 'K', square: 'h7' },
    ],
    line: ['f7f8n'],
  },
  {
    turn: 'w',
    pieces: [
      { color: 'w', piece: 'K', square: 'h1' },
      { color: 'w', piece: 'P', square: 'c7' },
      { color: 'b', piece: 'K', square: 'a8' },
    ],
    line: ['c7c8q'],
  },
  {
    turn: 'w',
    pieces: [
      { color: 'w', piece: 'K', square: 'a1' },
      { color: 'w', piece: 'P', square: 'e7' },
      { color: 'b', piece: 'K', square: 'h8' },
    ],
    line: ['e7e8r'],
  },
];

const endgameSeeds: PuzzleSeed[] = [
  {
    turn: 'w',
    pieces: [
      { color: 'w', piece: 'K', square: 'e5' },
      { color: 'w', piece: 'P', square: 'd5' },
      { color: 'b', piece: 'K', square: 'e7' },
    ],
    line: ['d5d6'],
  },
  {
    turn: 'w',
    pieces: [
      { color: 'w', piece: 'K', square: 'd5' },
      { color: 'w', piece: 'P', square: 'e5' },
      { color: 'b', piece: 'K', square: 'd7' },
    ],
    line: ['e5e6'],
  },
  {
    turn: 'b',
    pieces: [
      { color: 'b', piece: 'K', square: 'e4' },
      { color: 'b', piece: 'P', square: 'd4' },
      { color: 'w', piece: 'K', square: 'e2' },
    ],
    line: ['d4d3'],
  },
  {
    turn: 'w',
    pieces: [
      { color: 'w', piece: 'K', square: 'c5' },
      { color: 'w', piece: 'P', square: 'b5' },
      { color: 'b', piece: 'K', square: 'c7' },
    ],
    line: ['b5b6'],
  },
  {
    turn: 'w',
    pieces: [
      { color: 'w', piece: 'K', square: 'f5' },
      { color: 'w', piece: 'P', square: 'g5' },
      { color: 'b', piece: 'K', square: 'f7' },
    ],
    line: ['g5g6'],
  },
];

const generated: ChessPuzzle[] = [];
for (const [theme, seed] of Object.entries(nonPawnSeeds) as [
  keyof typeof nonPawnSeeds,
  PuzzleSeed,
][])
  transforms.forEach((transform, index) =>
    generated.push(puzzle(`${theme}-${index + 1}`, theme, transformSeed(seed, transform))),
  );
for (const theme of ['mate1', 'mate2', 'mate3'] as const)
  mateSeeds[theme].forEach((seed, index) =>
    generated.push(puzzle(`${theme}-${index + 1}`, theme, seed)),
  );
promotionSeeds.forEach((seed, index) =>
  generated.push(puzzle(`promotion-${index + 1}`, 'promotion', seed)),
);
endgameSeeds.forEach((seed, index) =>
  generated.push(puzzle(`endgame-${index + 1}`, 'endgame', seed)),
);

export const CHESS_PUZZLES: readonly ChessPuzzle[] = generated;

export interface PuzzleValidation {
  ok: boolean;
  errors: string[];
}

function sameMove(a: ChessMove, b: ChessMove) {
  return (
    a.from === b.from &&
    a.to === b.to &&
    (a.promotion ?? null) === (b.promotion ?? null)
  );
}

function isForcedMate(state: ChessState, solver: 0 | 1, plies: number): boolean {
  if (state.winner !== null) return state.winner === solver;
  if (state.drawReason || plies <= 0) return false;
  const legal = chessLegalMoves(state);
  if (!legal.length) return state.winner === solver;
  if (state.turn === solver)
    return legal.some((move) => isForcedMate(applyChess(state, move), solver, plies - 1));
  return legal.every((move) => isForcedMate(applyChess(state, move), solver, plies - 1));
}

function attacksImportantTargets(state: ChessState, move: ChessMove): boolean {
  const next = applyChess(state, move);
  const moved = next.board[move.to];
  if (!moved) return false;
  const enemy = moved.owner === 0 ? 1 : 0;
  const targets = next.board
    .map((piece, index) => ({ piece, index }))
    .filter(
      ({ piece, index }) =>
        piece?.owner === enemy &&
        (piece.type === 'king' || piece.type === 'queen' || piece.type === 'rook') &&
        isChessSquareAttacked(next.board, index, moved.owner),
    );
  return targets.length >= 2;
}

export function validateChessPuzzle(puzzle: ChessPuzzle): PuzzleValidation {
  const errors: string[] = [];
  let initial: ChessState;
  try {
    initial = chessFromFen(puzzle.fen);
  } catch {
    return { ok: false, errors: ['invalid-fen'] };
  }
  if (initial.turn !== puzzle.sideToMove) errors.push('side-to-move');

  for (const line of puzzle.solutionLines) {
    let state = chessFromFen(puzzle.fen);
    for (const encoded of line) {
      let move: ChessMove;
      try {
        move = chessMoveFromUci(encoded);
      } catch {
        errors.push(`invalid-move:${encoded}`);
        break;
      }
      const legal = chessLegalMoves(state).some((candidate) => sameMove(candidate, move));
      if (!legal) {
        errors.push(`illegal-move:${encoded}`);
        break;
      }
      state = applyChess(state, move);
    }
  }

  const first = puzzle.solutionLines[0]?.[0];
  if (!first) errors.push('missing-solution');
  else {
    const firstMove = chessMoveFromUci(first);
    if (puzzle.themes.includes('fork') && !attacksImportantTargets(initial, firstMove))
      errors.push('fork-not-verified');
    if (puzzle.themes.includes('promotion') && !firstMove.promotion)
      errors.push('promotion-not-verified');
  }

  const mate = puzzle.themes.find((theme) => /^mate[123]$/.test(theme));
  if (mate) {
    const n = Number(mate.slice(-1));
    const maxPlies = n * 2 - 1;
    if (!isForcedMate(initial, puzzle.sideToMove, maxPlies))
      errors.push('forced-mate-not-verified');
    if (n > 1 && isForcedMate(initial, puzzle.sideToMove, maxPlies - 2))
      errors.push('mate-horizon-too-short');
  }

  return { ok: errors.length === 0, errors };
}

export function validateChessPuzzleSet(
  puzzles: readonly ChessPuzzle[] = CHESS_PUZZLES,
): PuzzleValidation {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const current of puzzles) {
    if (ids.has(current.id)) errors.push(`duplicate-id:${current.id}`);
    ids.add(current.id);
    const validation = validateChessPuzzle(current);
    errors.push(...validation.errors.map((error) => `${current.id}:${error}`));
  }
  for (const theme of Object.keys(themeText) as ChessPuzzleTheme[]) {
    const count = puzzles.filter((item) => item.themes.includes(theme)).length;
    if (count < 5) errors.push(`theme-count:${theme}:${count}`);
  }
  if (puzzles.length < 50) errors.push(`puzzle-count:${puzzles.length}`);
  return { ok: errors.length === 0, errors };
}
