import type { Store } from './store.ts';
import type { StoredMatch } from './matches.ts';

/**
 * Atomically persists a match transition only when the stored match still has
 * the expected revision. Store also advances the in-memory persisted revision
 * marker so later writes on the same object remain compare-and-swap safe.
 */
export function compareAndSwapMatch(
  store: Store,
  match: StoredMatch,
  expectedRevision: number,
): boolean {
  return store.compareAndSwapMatch(match, expectedRevision);
}
