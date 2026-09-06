import type { Store } from './store.ts';
import type { StoredMatch } from './matches.ts';

/**
 * Atomically persists a match transition only when both the stored gameplay
 * revision and the internal write-version still match the snapshot observed by
 * this server instance. This prevents revision-changing timeout transitions
 * from overwriting same-revision metadata written by another server.
 */
export function compareAndSwapMatch(
  store: Store,
  match: StoredMatch,
  expectedRevision: number,
): boolean {
  return store.compareAndSwapMatch(match, expectedRevision);
}
