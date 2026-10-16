# NAQLA Phase 6 — Database operations and recovery

**Implementation scope:** schema migrations v1–v2 plus encrypted SQLite online snapshots and a verified, **no-overwrite** restore command. No remote backup service, automated schedule, recovery-time guarantee, or live production restore is claimed.

## Schema upgrades

- `Store` now runs versioned, transactional migrations before serving accounts or matches.
- Fresh databases and older databases with `PRAGMA user_version=0` are upgraded to v2 (including the existing `results.opponents_json` and `results.player_count` legacy columns).
- A failed migration rolls back. A database carrying a **newer** `user_version` is refused instead of silently opening or downgrading.
- Existing matches, users, sessions and ratings are not intentionally reset. Migration compatibility is exercised in `tests/db-operations.test.ts`.
- **Before any deployment:** make and retain an encrypted backup; rehearse the upgrade on an isolated copy, then deploy the matching app version. Do not point old server binaries at upgraded production databases.

## Back up a live SQLite database

The command uses Node's built-in `sqlite.backup` API. It supports a WAL-mode database while the server is running; copying only `*.db` would not reliably capture pending WAL writes.

1. Generate a unique **32-byte** encryption key using an approved secret manager or a cryptographic random source. Provide it to the process as `NAQLA_BACKUP_KEY_HEX` (64 hex characters). Store the key **separately** from the backup and protect access. Losing the key makes a backup irrecoverable.
2. Run from the checked-out repo with Node 24+ and a writeable, private backup directory:

```bash
export NAQLA_BACKUP_KEY_HEX="<64-hex-character-secret-from-secret-manager>"
node scripts/db-backup.mjs backup data/board-arena.db /secure-backups/naqla-2026-10-16.naqla
```

3. The utility creates a private working directory, takes a SQLite-consistent snapshot, checks `integrity_check`, `foreign_key_check` and schema version, then encrypts the complete snapshot with **AES-256-GCM** and a new 96-bit nonce. It refuses to overwrite a prior backup and creates the encrypted file with owner-only permissions. Unencrypted temporary snapshots are removed after processing.
4. Transfer encrypted snapshots to a separate access-controlled location. Set an operator-owned retention cadence, integrity monitoring, restore frequency, rotation policy and alerting. There is **no automatic scheduling or remote transfer** in the app.
5. The backup includes sensitive player accounts, hashed credentials, sessions and match history; treat even ciphertext as confidential.

## Restore drill on an isolated system

```bash
export NAQLA_BACKUP_KEY_HEX="<same-64-hex-key>"
node scripts/db-backup.mjs restore /secure-backups/naqla-2026-10-16.naqla /tmp/naqla-drill.db
```

The restore refuses to overwrite a destination database or associated WAL/SHM files, authenticates the GCM tag, checks SQLite integrity and foreign keys, and only then exposes the restored database. A wrong key or modified file leaves no restored database at the destination.

1. Use a **new** isolated path, not the live production database.
2. With a disposable test backend, start the matching NAQLA application against the restored DB; verify representative accounts, sessions, ratings and a saved match from the period of the backup. Check app logs for successful migrations and no cross-account leakage.
3. For an actual emergency recovery, **stop the backend first**, ensure no active SQLite/WAL files, preserve the damaged original for incident analysis and switch to a separately verified restored file. Do not restore into a running server's active path.
4. Record the backup timestamp, test results, schema version, RPO/RTO actually achieved, key reference (not key value), and operator sign-off.

### Limitations / production blockers

- This CLI is run by an operator. **Backups are not scheduled**, not replicated, not automatically monitored and no cloud encryption-key custody is configured.
- A process crash can leave a transient plaintext snapshot in a private working directory; protect the host volume, use disk encryption, restrict shell users and clean stale `.naqla-snapshot-*` / `.naqla-restore-*` directories only after investigating failed jobs.
- SQLite-consistent backups are not equivalent to whole-system disaster recovery. Rehearse restore in a separate environment, not just the unit test suite.
- Multi-instance clustering, account deletion, OAuth live QA and real physical-device testing remain separate release gates. See [deployment](DEPLOYMENT.md), [security](SECURITY_PHASE4.md), issues #90–#92 and [store rollout](RELEASE_PHASE5.md).

**Related tests:** `tests/db-operations.test.ts` checks legacy migrations, idempotent reopening, forward-version rejection, live-WAL encrypted backup, restored sessions/ratings, incorrect keys, tamper detection and overwrite protection.
