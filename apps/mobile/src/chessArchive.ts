import type { Difficulty } from '../../../packages/core/src/game.ts';
import type { MatchResult } from '../../../packages/core/src/protocol.ts';
import type { TimeControl } from '../../../packages/core/src/timing.ts';
import type { ChessMoveReview } from '../../../packages/games/chess/review.ts';
import type { ChessMoveJournal } from '../../../packages/games/chess/journal.ts';
import type { ChessAiSessionConfig } from '../../../packages/games/chess/training.ts';

export type ChessArchiveAnalysisStatus =
  | 'not-analyzed'
  | 'in-progress'
  | 'partial'
  | 'complete'
  | 'failed';

export interface ChessArchiveRecord {
  schemaVersion: 1;
  id: string;
  createdAt: number;
  updatedAt: number;
  finishedAt: number | null;
  result: MatchResult | null;
  whiteName: string;
  blackName: string;
  mode: 'local' | 'ai';
  difficulty?: Difficulty;
  bot?: ChessAiSessionConfig;
  timeControl: TimeControl;
  journal: ChessMoveJournal;
  opening?: { id: string; eco: string; nameEn: string; nameAr: string };
  assistanceUsed: boolean;
  analysisStatus: ChessArchiveAnalysisStatus;
  analysisVersion?: 1;
  reviews?: ChessMoveReview[];
}

export interface ChessArchiveRepository {
  list(): Promise<ChessArchiveRecord[]>;
  get(id: string): Promise<ChessArchiveRecord | null>;
  put(record: ChessArchiveRecord): Promise<void>;
  delete(id: string): Promise<void>;
}

const DB_NAME = 'naqla-chess';
const STORE = 'games';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('indexeddb-unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('archive-open-failed'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('archive-request-failed'));
      transaction.onerror = () => reject(transaction.error ?? new Error('archive-transaction-failed'));
    });
  } finally {
    db.close();
  }
}

export const chessArchive: ChessArchiveRepository = {
  async list() {
    const records = await withStore<ChessArchiveRecord[]>('readonly', (store) => store.getAll());
    return records.sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async get(id) {
    return (await withStore<ChessArchiveRecord | undefined>('readonly', (store) => store.get(id))) ?? null;
  },
  async put(record) {
    await withStore<IDBValidKey>('readwrite', (store) => store.put(record));
  },
  async delete(id) {
    await withStore<undefined>('readwrite', (store) => store.delete(id));
  },
};

export function archiveAnalysisStatus(
  journal: ChessMoveJournal,
  reviews: readonly ChessMoveReview[],
): ChessArchiveAnalysisStatus {
  if (!journal.entries.length) return 'not-analyzed';
  if (!reviews.length) return 'not-analyzed';
  const covered = new Set(reviews.map((review) => review.ply));
  return journal.entries.every((entry) => covered.has(entry.ply)) ? 'complete' : 'partial';
}
