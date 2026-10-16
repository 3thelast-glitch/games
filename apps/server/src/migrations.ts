import type { DatabaseSync } from 'node:sqlite';

export const SCHEMA_VERSION = 2;

/**
 * Explicit, monotonic SQLite schema changes. Legacy databases created before
 * the migration journal have user_version=0; IF NOT EXISTS and column checks
 * make the first upgrade safe for those databases.
 */
const migrations: ReadonlyArray<{ version: number; up: (db: DatabaseSync) => void }> = [
  {
    version: 1,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,avatar TEXT NOT NULL,guest INTEGER NOT NULL,provider TEXT NOT NULL,subject TEXT NOT NULL,email TEXT,password TEXT,favorites TEXT NOT NULL DEFAULT '[]',friend_code TEXT NOT NULL UNIQUE,created_at INTEGER NOT NULL, UNIQUE(provider,subject));
        CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS ratings(user_id TEXT NOT NULL REFERENCES users(id),game_id TEXT NOT NULL,rating INTEGER NOT NULL DEFAULT 1000,played INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,game_id));
        CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY,body TEXT NOT NULL,finished INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS results(match_id TEXT NOT NULL REFERENCES matches(id),user_id TEXT NOT NULL REFERENCES users(id),game_id TEXT NOT NULL,opponent TEXT NOT NULL,result TEXT NOT NULL,reason TEXT NOT NULL,duration_ms INTEGER NOT NULL,delta INTEGER NOT NULL,ranked INTEGER NOT NULL,ended_at INTEGER NOT NULL,PRIMARY KEY(match_id,user_id));
        CREATE INDEX IF NOT EXISTS results_period ON results(game_id,ended_at);
        CREATE TABLE IF NOT EXISTS friends(user_id TEXT NOT NULL REFERENCES users(id),friend_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(user_id,friend_id));
        CREATE TABLE IF NOT EXISTS oauth_flows(state TEXT PRIMARY KEY,body TEXT NOT NULL,expires_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS auth_codes(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),challenge TEXT NOT NULL,expires_at INTEGER NOT NULL);
      `);
    },
  },
  {
    version: 2,
    up(db) {
      const columns = new Set(
        (db.prepare('PRAGMA table_info(results)').all() as { name: string }[]).map((column) => column.name),
      );
      if (!columns.has('opponents_json'))
        db.exec("ALTER TABLE results ADD COLUMN opponents_json TEXT NOT NULL DEFAULT '[]'");
      if (!columns.has('player_count'))
        db.exec('ALTER TABLE results ADD COLUMN player_count INTEGER NOT NULL DEFAULT 2');
    },
  },
];

function schemaVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  if (!Number.isInteger(row.user_version) || row.user_version < 0)
    throw new Error('Invalid SQLite schema version');
  return row.user_version;
}

function assertSchema(db: DatabaseSync) {
  const tables = new Set(
    (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[])
      .map((row) => row.name),
  );
  for (const table of ['users','sessions','ratings','matches','results','friends','oauth_flows','auth_codes'])
    if (!tables.has(table)) throw new Error(`SQLite schema missing table: ${table}`);
  const columns = new Set(
    (db.prepare('PRAGMA table_info(results)').all() as { name: string }[]).map((row) => row.name),
  );
  for (const column of ['opponents_json', 'player_count'])
    if (!columns.has(column)) throw new Error(`SQLite results table missing column: ${column}`);
}

export function migrateDatabase(db: DatabaseSync): void {
  // busy_timeout is necessary when two application instances start simultaneously.
  db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
  const initial = schemaVersion(db);
  if (initial > SCHEMA_VERSION)
    throw new Error(`Database schema v${initial} is newer than supported v${SCHEMA_VERSION}; refusing downgrade`);
  if (initial === SCHEMA_VERSION) {
    assertSchema(db);
    return;
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    // Re-read under the write lock so a second process cannot race a migration.
    let current = schemaVersion(db);
    if (current > SCHEMA_VERSION)
      throw new Error('Database upgraded by a newer process; refusing downgrade');
    for (const migration of migrations) {
      if (migration.version <= current) continue;
      if (migration.version !== current + 1) throw new Error('Non-contiguous SQLite migration');
      migration.up(db);
      db.exec(`PRAGMA user_version=${migration.version}`);
      current = migration.version;
    }
    assertSchema(db);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
