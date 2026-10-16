# NAQLA — Security, continuity and backup activation (October 16, 2026)

**Status: staged implementation, NOT a production sign-off.** The Render service
[`naqla-staging-20261016`](https://dashboard.render.com/web/srv-db8u25jbc2fs73c6me70)
is a free Docker staging service, with **no attached persistent disk and no Render
Postgres instance**. It can lose SQLite accounts, sessions, matches and ratings on
restart/redeploy. Never use it to store valuable or irreplaceable player data.

## Account security changes (this branch)

- `POST /api/auth/logout-all` with a Bearer session invalidates every session
  for the authenticated account and closes all its connected WebSockets.
- `POST /api/auth/password/change` accepts JSON
  `{"currentPassword":"...","nextPassword":"..."}`. The next password must
  have 12–128 characters. For email/password accounts, current-password
  verification and a conditional update prevent stale concurrent writes; all
  sessions and sockets are then revoked. Password-only account rules are
  explicit: OAuth-only and guest identities cannot use this endpoint.
- The readiness endpoint checks SQLite queryability; this is **not** a full
  disk-write or restore readiness test.
- Both endpoints now have bilingual account settings controls. A successful password
  change or global sign-out clears the local session and requires fresh sign-in.

**Open account work:** real transactional email provider/domain activation and
full delivery QA; guest conversion review; account deletion and match-history
retention policy (issue #91).
Do not present account self-service as fully completed.

## Live monitoring (prepared)

`.github/workflows/staging-monitor.yml` checks the deployed staging HTTPS
health/protocol and WSS upgrade **hourly** with three attempts. Failed checks
create a single open GitHub incident issue to avoid alert floods. The issue is
not automatically resolved; an operator must check logs and close it.

- Workflow schedules only activate on the repository default branch.
- GitHub Actions scheduling can be delayed/paused; this is an auxiliary
  signal, **not a guaranteed 24/7 uptime SLA**.
- On failure, inspect Render events, app logs, metrics (CPU, memory, HTTP
  errors and latency), disk capacity and GitHub Action output.
- Configure repository notifications and an independent external uptime
  monitor with a responsible incident recipient before production use.
- Free-plan sleep can delay first requests; the retries reduce false alarms.

## Durable storage and offsite backups — required before activation

1. Use one SQLite server process on a **persistent** encrypted volume (for
   example, a paid Render Starter web service with disk), **or migrate the
   application and its database operations to a supported durable database**.
   Do not simply provision Postgres: the current code still uses SQLite.
2. Choose an offsite private S3-compatible bucket, managed 32-byte backup
   key, key recovery/rotation process, scoped credentials and at least two
   operators who can access the disaster recovery procedure. Never commit
   keys to source control or expose them as Vite variables.
3. On a persistent Linux/VM host with direct access to the *same database*
   file as the running server, install Node 24+ and AWS CLI v2. Prepare
   `/etc/naqla/backup.env` owned by root (mode 0600), with:
   ```dotenv
   DATABASE_PATH=/srv/naqla/data/board-arena.db
   NAQLA_BACKUP_KEY_HEX=<64-character-hex-secret-from-a-manager>
   NAQLA_BACKUP_S3_BUCKET=<private-bucket>
   NAQLA_BACKUP_S3_PREFIX=naqla/staging
   ```
   Use AWS instance-role/workload identity where possible, rather than
   static access keys. Protect the secret from shell history, process logs
   and CI artifacts.
4. Execute `bash ops/backup-to-s3.sh` manually after validating the
   configuration. It takes a WAL-safe SQLite snapshot, encrypts AES-256-GCM,
   uploads it offsite, **downloads that exact object**, byte-compares it,
   restores to a fresh isolated file, validates SQLite integrity, foreign
   keys and table counts, then removes temporary plaintext. A success log
   includes an S3 object key; retain it in a restricted audit log.
5. On a **compatible persistent Linux host**, install
   `ops/systemd/naqla-backup.service` and `.timer` in
   `/etc/systemd/system/`; adjust `WorkingDirectory`, mount path, user
   and `ReadWritePaths` to the actual host, then:
   ```sh
   sudo systemctl daemon-reload
   sudo systemctl enable --now naqla-backup.timer
   sudo systemctl start naqla-backup.service
   sudo systemctl status naqla-backup.service
   sudo journalctl -u naqla-backup.service --since today
   ```
   The timer schedules daily at 03:00 **UTC**, with up to 10 minutes jitter.
   Wire systemd failure notifications to the operator's paging channel and
   alert if last verified backup age exceeds 26 hours.

**IMPORTANT RENDER LIMITATION:** Render cron jobs cannot be assumed to share
the persistent disk of a separate web service. Do not deploy this script as an
independent Render cron job expecting it to read `/app/data`. On Render with
a disk, first implement a *safe* same-service scheduled backup agent or another
verified direct-volume backup mechanism, or operate on a dedicated durable
host. This branch deliberately does not start a fake scheduled backup against
the ephemeral free service.

## Retention, recovery and evidence

- Configure offsite bucket versioning, MFA/access controls, lifecycle/retention
  policy (initial proposal: daily for 30 days, monthly for 12 months; review
  applicable privacy law and business requirements before activation).
- Encrypted cloud backups must remain available independently of the web
  service and its deployment lifecycle. Separate the decryption key from backups.
- For a quarterly disaster-recovery exercise, use a **separate host/account**:
  download an actual recent encrypted object, restore it to a new database
  path, start the matching application build, and verify representative
  account authentication, match history, rankings, cross-account isolation
  and sample row totals. **Never overwrite production SQLite while running**.
- Measure actual backup age (RPO) and total time to functional recovered
  gameplay (RTO), identify who signed off, and preserve run IDs without PII.
- An S3 upload/download/restore on one host is a valuable real cryptographic
  round-trip, but is **not** an independent-host production recovery drill.
- Synthetic local backup/restore tests in `tests/db-operations.test.ts` are
  regression checks and cannot replace recovery of the actual deployed data.

## Go/no-go

Do not mark issues #90 and #91 or this entire phase as complete until all
of these have dated evidence: persistent storage, offsite scheduled backups,
last successful remote round-trip, alert delivery test, independent-host restore
with real deployed data, operator ownership, account reset/verify/delete,
security review and staging acceptance. Free staging must not hold production
user data.

## Account recovery Phase 2 extension (not operational until sender configured)

The versioned SQLite schema is now **v3**, adding `users.email_verified_at` and
single-use, SHA-256-hashed, expiring `account_tokens`. The database migration
runs before the server opens for requests. Backups accept historical v2 and
current v3 snapshots; a backup made after the migration must be treated as
sensitive and can only be used with compatible application builds.

To enable transactional email, configure a verified domain at Resend and set
`RESEND_API_KEY`, `NAQLA_EMAIL_FROM` and the exact HTTPS app origin
`APP_URL` **only in Render server environment secrets**, not in `VITE_*` nor
the repository. Test that `GET /api/auth/providers` returns
`emailRecovery: true` only when configured. Never use an unverified sending
domain or credentials from another environment.

- `POST /api/auth/password/reset/request`: accepts `{"email":"..."}`;
  returns a generic 200 for unknown and known accounts to resist enumeration.
  Tokens expire after 15 minutes, can be used once and are stored hashed.
- `POST /api/auth/password/reset/complete`: accepts
  `{"token":"...","nextPassword":"..."}` and revokes all sessions and live
  sockets on success. A reset token cannot be replayed.
- `POST /api/auth/email/verification/request`: requires a session and
  sends a single-use 60-minute confirmation link to an email account.
- `POST /api/auth/email/verification/complete`: consumes the token and sets
  the verified timestamp. Old email accounts are unverified until confirmed.
- Verification delivery failures do not erase a newly registered account.
  Both verification and recovery are unavailable without a real mail sender;
  no secret tokens are ever returned by public API or printed to logs.
- The web/native UI supports requesting a reset and using the emailed link
  (HTTPS app origin). Recovery secrets are carried in URL **fragments**
  rather than HTTP requests, then removed from browser history.

**Still required before declaring account closure:** account-delete policy and
UI; deletion of historical identifiers across matches and friends; retention
and legal review, verification gate for sensitive ranked actions, live domain
and delivery QA, and recovery on two real devices. Do not advertise full
privacy-compliant deletion based on the existence of these APIs.

### Real independent offsite restore drill

`.github/workflows/offsite-restore-drill.yml` implements a manual,
**actual encrypted-object** download/decrypt/restore on an isolated GitHub
runner (not inside the running web service). It also boots the recovered
application and checks representative account access, data counts and schema.
It deliberately cannot pass without a real offsite object.

Configure a GitHub Environment named `naqla-recovery` with approval protection
and **read-only** S3 access; set environment secrets
`NAQLA_BACKUP_S3_BUCKET`, `NAQLA_BACKUP_KEY_HEX`,
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, plus variable
`AWS_REGION`. Use a short-lived OIDC role instead of static AWS keys
when adapting the workflow to your cloud security standard. Choose the
exact offsite `.naqla` object key and baseline user/match counts when
manually running the job. The job creates **only a disposable local restore**
and does not modify production or the backup bucket.

**No live restore can be certified yet:** current free Render hosting has no
durable SQLite volume; no offsite bucket, secret or successfully uploaded
production backup has been verified. The GitHub encrypted fixture test and
the future independent restore job serve different purposes. Record a dated
actual restore run ID, original snapshot timestamp, RPO/RTO, counts, and
operator sign-off before closing #90.
