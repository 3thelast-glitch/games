import { backup, DatabaseSync } from 'node:sqlite';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import {
  appendFileSync, closeSync, createReadStream, createWriteStream, existsSync,
  mkdtempSync, openSync, readSync, readFileSync, renameSync, rmSync,
  statSync, writeFileSync, linkSync, unlinkSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';

const MAGIC = Buffer.from('NAQLABK1', 'ascii');
const HEADER_LENGTH = MAGIC.length + 12;
const TAG_LENGTH = 16;

function encryptionKey(env) {
  const value = env.NAQLA_BACKUP_KEY_HEX ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(value))
    throw new Error('NAQLA_BACKUP_KEY_HEX must be exactly 64 hexadecimal characters (32 secure random bytes)');
  return Buffer.from(value, 'hex');
}

function assertDb(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const result = db.prepare('PRAGMA integrity_check').all();
    if (result.length !== 1 || result[0].integrity_check !== 'ok')
      throw new Error('Backup SQLite integrity check failed');
    const broken = db.prepare('PRAGMA foreign_key_check').all();
    if (broken.length) throw new Error('Backup SQLite foreign key check failed');
    const version = db.prepare('PRAGMA user_version').get()?.user_version;
    if (version !== 2) throw new Error(`Unsupported backup schema version: ${version}`);
  } finally {
    db.close();
  }
}

/** An authenticated encrypted backup of a WAL-consistent live SQLite database. */
export async function createEncryptedBackup(source, destination, env = process.env) {
  const key = encryptionKey(env);
  const original = resolve(source), output = resolve(destination);
  if (original === output || !existsSync(original)) throw new Error('Source database missing or destination equals source');
  if (existsSync(output)) throw new Error('Refusing to overwrite an existing backup');
  const privateDir = mkdtempSync(join(dirname(output), '.naqla-snapshot-'));
  const temporary = join(privateDir, 'snapshot.db');
  let db;
  let outputCreated = false;
  try {
    db = new DatabaseSync(original, { readOnly: true });
    await backup(db, temporary);
    db.close();
    db = undefined;
    assertDb(temporary);
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    writeFileSync(output, Buffer.concat([MAGIC, nonce]), { flag: 'wx', mode: 0o600 });
    outputCreated = true;
    await pipeline(createReadStream(temporary), cipher, createWriteStream(output, { flags: 'a', mode: 0o600 }));
    appendFileSync(output, cipher.getAuthTag());
    return output;
  } catch (error) {
    if (outputCreated) rmSync(output, { force: true });
    throw error;
  } finally {
    db?.close();
    key.fill(0);
    rmSync(privateDir, { recursive: true, force: true });
  }
}

/**
 * Decrypt to a private temporary file, verify its authenticated tag and SQLite
 * integrity, then create the destination without ever replacing live data.
 * The server must be stopped before an operator swaps a restored DB into use.
 */
export async function restoreEncryptedBackup(source, destination, env = process.env) {
  const key = encryptionKey(env);
  const encrypted = resolve(source), output = resolve(destination);
  if (encrypted === output || !existsSync(encrypted)) throw new Error('Encrypted backup not found');
  if (existsSync(output) || existsSync(output + '-wal') || existsSync(output + '-shm'))
    throw new Error('Refusing to overwrite existing SQLite data or WAL files');
  const size = statSync(encrypted).size;
  if (size <= HEADER_LENGTH + TAG_LENGTH) throw new Error('Encrypted backup is truncated');
  const handle = openSync(encrypted, 'r');
  const header = Buffer.alloc(HEADER_LENGTH);
  const tag = Buffer.alloc(TAG_LENGTH);
  try {
    if (readSync(handle, header, 0, HEADER_LENGTH, 0) !== HEADER_LENGTH ||
        readSync(handle, tag, 0, TAG_LENGTH, size - TAG_LENGTH) !== TAG_LENGTH ||
        !header.subarray(0, MAGIC.length).equals(MAGIC))
      throw new Error('Unrecognized or truncated NAQLA encrypted backup');
  } finally {
    closeSync(handle);
  }
  const privateDir = mkdtempSync(join(dirname(output), '.naqla-restore-'));
  const plain = join(privateDir, 'restored.db');
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(MAGIC.length));
    decipher.setAuthTag(tag);
    await pipeline(
      createReadStream(encrypted, { start: HEADER_LENGTH, end: size - TAG_LENGTH - 1 }),
      decipher,
      createWriteStream(plain, { flags: 'wx', mode: 0o600 }),
    );
    assertDb(plain);
    // An atomic no-replace filesystem link prevents accidental deletion of live data.
    linkSync(plain, output);
    unlinkSync(plain);
    return output;
  } finally {
    key.fill(0);
    rmSync(privateDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/db-backup.mjs')) {
  const [, , action, source, destination] = process.argv;
  if (!['backup', 'restore'].includes(action) || !source || !destination) {
    console.error('Usage: node scripts/db-backup.mjs backup|restore SOURCE DESTINATION');
    process.exitCode = 2;
  } else {
    try {
      const output = action === 'backup'
        ? await createEncryptedBackup(source, destination)
        : await restoreEncryptedBackup(source, destination);
      console.log(`NAQLA ${action} validated: ${output}`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Backup operation failed');
      process.exitCode = 1;
    }
  }
}
