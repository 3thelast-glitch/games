#!/usr/bin/env bash
# Execute on the SAME durable host/volume as the running SQLite server.
# Requires Node 24+, AWS CLI v2, database access, a scoped S3 identity and a secret key.
set -Eeuo pipefail
umask 077
: "${DATABASE_PATH:?DATABASE_PATH points to the actual persistent SQLite DB}"
: "${NAQLA_BACKUP_KEY_HEX:?Supply a managed 32-byte backup key in hex}"
: "${NAQLA_BACKUP_S3_BUCKET:?Specify private offsite S3 bucket}"
[[ "$NAQLA_BACKUP_KEY_HEX" =~ ^[0-9a-fA-F]{64}$ ]] || { echo 'Invalid encryption-key length' >&2; exit 2; }
command -v aws >/dev/null || { echo 'AWS CLI v2 required' >&2; exit 2; }
command -v node >/dev/null || exit 2
[[ -f "$DATABASE_PATH" ]] || { echo 'Database not present: refusing empty backup' >&2; exit 2; }

prefix="${NAQLA_BACKUP_S3_PREFIX:-naqla}"
[[ "$prefix" =~ ^[a-zA-Z0-9/_-]+$ && "$prefix" != /* && "$prefix" != */ ]] ||
  { echo 'Invalid S3 prefix' >&2; exit 2; }
id="$(node -e "process.stdout.write(require('node:crypto').randomBytes(8).toString('hex'))")"
name="naqla-$(date -u +%Y%m%dT%H%M%SZ)-${id}.naqla"
key="${prefix}/${name}"
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
encrypted="$work/$name"
downloaded="$work/retrieved.naqla"
restored="$work/restored.db"

# SQLite online snapshot captures pending WAL transactions before encryption.
node scripts/db-backup.mjs backup "$DATABASE_PATH" "$encrypted"
AWS_PAGER="" aws s3 cp "$encrypted" "s3://${NAQLA_BACKUP_S3_BUCKET}/${key}" --only-show-errors
# Read back the actual remote object; this is not merely a successful upload response.
AWS_PAGER="" aws s3 cp "s3://${NAQLA_BACKUP_S3_BUCKET}/${key}" "$downloaded" --only-show-errors
cmp --silent "$encrypted" "$downloaded" || { echo 'Remote backup digest mismatch' >&2; exit 1; }
node scripts/db-backup.mjs restore "$downloaded" "$restored"
node --input-type=module - "$restored" <<'EOF'
import { DatabaseSync } from 'node:sqlite';
const file = process.argv[2];
const db = new DatabaseSync(file, { readOnly: true });
try {
  const tables = ['users', 'sessions', 'matches', 'ratings', 'results'];
  const count = {};
  for (const table of tables)
    count[table] = Number(db.prepare(`SELECT count(*) AS count FROM ${table}`).get().count);
  if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw Error('Restore integrity check failed');
  if (db.prepare('PRAGMA foreign_key_check').all().length) throw Error('Restore foreign-key check failed');
  console.log('Remote backup round-trip verified; restored row counts:', JSON.stringify(count));
} finally { db.close(); }
EOF
echo "Encrypted offsite backup and isolated restore validated: s3://${NAQLA_BACKUP_S3_BUCKET}/${key}"
