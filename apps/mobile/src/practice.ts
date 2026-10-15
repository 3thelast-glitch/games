import type { Seat } from '../../../packages/core/src/game.ts';

export interface PracticeRecord {
  id: string;
  gameId: string;
  mode: 'local' | 'ai';
  winner: Seat | null;
  durationMs: number;
}
export interface PracticeGameStats {
  gameId: string;
  aiMatches: number;
  aiWins: number;
  aiLosses: number;
  aiDraws: number;
}
export interface PracticeSummary {
  aiMatches: number;
  aiWins: number;
  aiLosses: number;
  aiDraws: number;
  localMatches: number;
  totalDurationMs: number;
  byGame: PracticeGameStats[];
}

/** Snapshot stats: localHistory retains at most 100 finished sessions, not lifetime data. */
export function practiceSummary(history: readonly PracticeRecord[]): PracticeSummary {
  const byGame = new Map<string, PracticeGameStats>();
  const seen = new Set<string>();
  const totals: PracticeSummary = {
    aiMatches: 0,
    aiWins: 0,
    aiLosses: 0,
    aiDraws: 0,
    localMatches: 0,
    totalDurationMs: 0,
    byGame: [],
  };
  for (const record of history.slice(0, 100)) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    totals.totalDurationMs += Number.isFinite(record.durationMs)
      ? Math.max(0, record.durationMs) : 0;
    if (record.mode === 'local') {
      totals.localMatches++;
      continue;
    }
    totals.aiMatches++;
    let entry = byGame.get(record.gameId);
    if (!entry) {
      entry = { gameId: record.gameId, aiMatches: 0, aiWins: 0, aiLosses: 0, aiDraws: 0 };
      byGame.set(record.gameId, entry);
    }
    entry.aiMatches++;
    if (record.winner === null) {
      totals.aiDraws++;
      entry.aiDraws++;
    } else if (record.winner === 0) {
      totals.aiWins++;
      entry.aiWins++;
    } else {
      totals.aiLosses++;
      entry.aiLosses++;
    }
  }
  totals.byGame = [...byGame.values()].sort((a, b) =>
    b.aiMatches - a.aiMatches || a.gameId.localeCompare(b.gameId));
  return totals;
}
