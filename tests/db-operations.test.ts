import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { Store } from '../apps/server/src/store.ts';
import { SCHEMA_VERSION } from '../apps/server/src/migrations.ts';

function workspace() {
  const dir = mkdtempSync(join(tmpdir(), 'naqla-db-ops-'));
  return { dir, db: join(dir, 'source.db'), clean: () => rmSync(dir, { recursive: true, force: true }) };
}
function cli(operation: string, source: string, destination: string, key: string) {
  return spawnSync(process.execPath, ['scripts/db-backup.mjs', operation, source, destination], {
    cwd: resolve('.'),
    encoding: 'utf8',
    env: { ...process.env, NAQLA_BACKUP_KEY_HEX: key },
    timeout: 15000,
  });
}

test('fresh SQLite and legacy unversioned results migrate transactionally without losing data', () => {
  const w = workspace();
  try {
    const legacy = new DatabaseSync(w.db);
    legacy.exec(`
      CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT NOT NULL,avatar TEXT NOT NULL,guest INTEGER NOT NULL,provider TEXT NOT NULL,subject TEXT NOT NULL,email TEXT,password TEXT,favorites TEXT NOT NULL DEFAULT '[]',friend_code TEXT NOT NULL UNIQUE,created_at INTEGER NOT NULL,UNIQUE(provider,subject));
      INSERT INTO users(id,name,avatar,guest,provider,subject,email,password,friend_code,created_at) VALUES('old-player','Original','orbit',1,'guest','old-subject',NULL,NULL,'OLDPLAYER',1234567);
      CREATE TABLE results(match_id TEXT NOT NULL,user_id TEXT NOT NULL,game_id TEXT NOT NULL,opponent TEXT NOT NULL,result TEXT NOT NULL,reason TEXT NOT NULL,duration_ms INTEGER NOT NULL,delta INTEGER NOT NULL,ranked INTEGER NOT NULL,ended_at INTEGER NOT NULL,PRIMARY KEY(match_id,user_id));
    `);
    legacy.close();
    const store = new Store(w.db);
    assert.equal((store.db.prepare('PRAGMA user_version').get() as {user_version:number}).user_version, SCHEMA_VERSION);
    assert.equal(store.user('old-player').name, 'Original');
    const columns = (store.db.prepare('PRAGMA table_info(results)').all() as {name:string}[]).map(c => c.name);
    assert.ok(columns.includes('opponents_json'));
    assert.ok(columns.includes('player_count'));
    assert.equal((store.db.prepare('PRAGMA integrity_check').get() as {integrity_check:string}).integrity_check, 'ok');
    store.close();
    const reopened = new Store(w.db);
    assert.equal(reopened.user('old-player').name, 'Original');
    assert.equal((reopened.db.prepare('PRAGMA user_version').get() as {user_version:number}).user_version, SCHEMA_VERSION);
    reopened.close();
  } finally { w.clean(); }
});

test('future schema version is refused before any destructive migration', () => {
  const w = workspace();
  try {
    const db = new DatabaseSync(w.db);
    db.exec('PRAGMA user_version=77');
    db.close();
    assert.throws(() => new Store(w.db), /newer than supported/);
    const verify = new DatabaseSync(w.db);
    assert.equal((verify.prepare('PRAGMA user_version').get() as {user_version:number}).user_version, 77);
    const rows = verify.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    assert.equal(rows.length, 0);
    verify.close();
  } finally { w.clean(); }
});

test('online SQLite snapshot encrypts WAL-consistent user/session/rating state and restores it', () => {
  const w = workspace();
  try {
    const original = new Store(w.db);
    const player = original.createUser('Backup Player');
    const token = original.newSession(player.id);
    original.db.prepare("INSERT INTO ratings(user_id,game_id,rating,played) VALUES(?,?,?,?)")
      .run(player.id, 'chess', 1460, 17);
    // Keep the live DB connection open: the source may still be in WAL mode.
    const encrypted = join(w.dir, 'backup.naqla');
    const restored = join(w.dir, 'restored.db');
    const key = randomBytes(32).toString('hex');
    const result = cli('backup', w.db, encrypted, key);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(encrypted));
    const ciphertext = readFileSync(encrypted);
    assert.equal(ciphertext.subarray(0,8).toString(), 'NAQLABK1');
    assert.equal(ciphertext.includes(Buffer.from('Backup Player')), false);

    const recover = cli('restore', encrypted, restored, key);
    assert.equal(recover.status, 0, recover.stderr);
    const copy = new Store(restored);
    assert.equal(copy.user(player.id).name, 'Backup Player');
    assert.equal(copy.authenticate(token).id, player.id);
    assert.equal(copy.rating(player.id, 'chess'), 1460);
    copy.close();

    assert.equal(cli('restore', encrypted, restored, key).status, 1, 'existing restored DB must not be overwritten');
    const wrongKey = randomBytes(32).toString('hex');
    assert.equal(cli('restore', encrypted, join(w.dir, 'wrong.db'), wrongKey).status, 1);
    assert.equal(existsSync(join(w.dir, 'wrong.db')), false);
    // Any mutation of the authentication tag must make the entire restore fail.
    ciphertext[ciphertext.length - 1] ^= 0xff;
    writeFileSync(join(w.dir, 'tampered.naqla'), ciphertext);
    assert.equal(cli('restore', join(w.dir, 'tampered.naqla'), join(w.dir, 'tampered.db'), key).status, 1);
    assert.equal(existsSync(join(w.dir, 'tampered.db')), false);
    original.close();
  } finally { w.clean(); }
});

test('backup refuses to overwrite a snapshot and rejects missing or short encryption keys', () => {
  const w = workspace();
  try {
    const store = new Store(w.db);
    const target = join(w.dir, 'existing.naqla');
    writeFileSync(target, 'DO NOT DESTROY');
    const key = randomBytes(32).toString('hex');
    assert.equal(cli('backup', w.db, target, key).status, 1);
    assert.equal(readFileSync(target, 'utf8'), 'DO NOT DESTROY');
    assert.equal(cli('backup', w.db, join(w.dir, 'invalid.naqla'), 'deadbeef').status, 1);
    store.close();
  } finally { w.clean(); }
});
