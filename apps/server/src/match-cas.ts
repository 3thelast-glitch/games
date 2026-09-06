import type { Store } from './store.ts';
import type { StoredMatch } from './matches.ts';

/**
 * Atomically persists a match transition only when the stored match still has
 * the expected revision. The revision lives inside the persisted JSON body, so
 * this works without a schema migration and is shared by every SQLite
 * connection/process using the same database file.
 */
export function compareAndSwapMatch(
  store: Store,
  match: StoredMatch,
  expectedRevision: number,
): boolean {
  const result = store.db
    .prepare(
      `UPDATE matches
       SET body=?, finished=?
       WHERE id=?
         AND CAST(json_extract(body, '$.revision') AS INTEGER)=?`,
    )
    .run(match.id ? JSON.stringify(match) : '', match.result ? 1 : 0, match.id, expectedRevision);

  return Number(result.changes) === 1;
}
