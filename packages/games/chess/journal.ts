import { applyChess } from './rules.ts';
import { chessFromFen, chessMoveFromUci, chessMoveToSan, chessToFen } from './notation.ts';
import { chessPosition, type ChessMove, type ChessState } from './state.ts';

export interface ChessMoveJournalEntry {
  id: string;
  matchId: string;
  ply: number;
  player: 0 | 1;
  move: ChessMove;
  uci: string;
  san: string;
  beforeFen: string;
  afterFen: string;
  afterPositionId: string;
  acceptedAt: number;
  clockMs?: [number, number];
}

export interface ChessMoveJournal {
  version: 1;
  matchId: string;
  initialFen: string;
  entries: ChessMoveJournalEntry[];
  incomplete?: boolean;
}

const files = 'abcdefgh';
function square(index: number) {
  return `${files[index % 8]}${8 - Math.floor(index / 8)}`;
}
export function chessMoveToUci(move: ChessMove): string {
  const promotion =
    move.promotion === 'queen'
      ? 'q'
      : move.promotion === 'rook'
        ? 'r'
        : move.promotion === 'bishop'
          ? 'b'
          : move.promotion === 'knight'
            ? 'n'
            : '';
  return `${square(move.from)}${square(move.to)}${promotion}`;
}

export function createChessMoveJournal(matchId: string, initial: ChessState): ChessMoveJournal {
  return {
    version: 1,
    matchId,
    initialFen: chessToFen(initial),
    entries: [],
  };
}

export function appendAcceptedChessMove(
  journal: ChessMoveJournal,
  before: ChessState,
  move: ChessMove,
  after: ChessState,
  acceptedAt: number,
  clockMs?: number[],
): ChessMoveJournal {
  if (after.ply !== before.ply + 1) throw new Error('invalid-journal-ply');
  const existing = journal.entries.find((entry) => entry.ply === after.ply);
  if (existing) return journal;

  const legalAfter = applyChess(before, move);
  if (chessPosition(legalAfter) !== chessPosition(after)) throw new Error('journal-state-mismatch');
  const entry: ChessMoveJournalEntry = {
    id: `${journal.matchId}:${after.ply}`,
    matchId: journal.matchId,
    ply: after.ply,
    player: before.turn,
    move: { ...move },
    uci: chessMoveToUci(move),
    san: chessMoveToSan(before, move),
    beforeFen: chessToFen(before),
    afterFen: chessToFen(after),
    afterPositionId: chessPosition(after),
    acceptedAt,
    ...(clockMs?.length >= 2 ? { clockMs: [clockMs[0], clockMs[1]] } : {}),
  };
  return { ...journal, entries: [...journal.entries, entry] };
}

export function reconstructChessJournal(
  journal: ChessMoveJournal,
  ply = journal.entries.length,
): ChessState {
  let state = chessFromFen(journal.initialFen);
  for (const entry of journal.entries) {
    if (entry.ply > ply) break;
    const move = chessMoveFromUci(entry.uci);
    state = applyChess(state, move);
    if (chessPosition(state) !== entry.afterPositionId) throw new Error('journal-replay-mismatch');
  }
  return state;
}
