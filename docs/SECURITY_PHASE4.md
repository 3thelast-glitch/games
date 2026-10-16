# NAQLA Phase 4 — Security and Quality Gate

Security verification date: 2026-10-15. This is a **code-audit and automated-testing checkpoint**, not a penetration-test certificate or production security approval.

## Enforced protections in current code

| Boundary | Implementation | Current automated evidence |
| --- | --- | --- |
| Online match authority | Actor is determined from authenticated socket/session; game moves and revisions are checked by MatchService, not trusted from clients | `tests/server.test.ts`, per-game rules tests and multi-server CAS tests |
| Private information | Per-seat server projection for Dominoes, Digital Game and Naval Battle; project secret state only for the recipient | `tests/dominoes.test.ts`, `tests/naval-battle.test.ts`, `tests/server-private-projections.test.ts` |
| Replay and duplicate actions | Per-match action fingerprint, revision checks and persisted compare-and-swap | `tests/server.test.ts` and multi-server tests |
| Frame/body safety | HTTP JSON body limit 16 KiB; WebSocket max payload 16 KiB, compression disabled; Zod client schema | `apps/server/src/server.ts`, protocol/unit tests |
| Session and origin validation | Hashed sessions, logged-out token rejected; allowed HTTP/WS browser origins; per-IP connection/message throttles | `apps/server/src/server.ts`, `tests/server.test.ts` |
| Per-account WebSocket abuse limits | Queue 24/min, create room 10/min, room join 20/min, resume 30/min, rematch 12/min, in addition to preexisting global IP/socket controls | `tests/server.test.ts` (Phase 4) |
| Multiplayer room atomicity | Rejected final joins cannot leave a private room with an unauthorized/extra seat | `tests/server.test.ts` (Phase 4) |

### What the new throttles mean
Limits are **per authenticated user and per action**, not proof against coordinated Sybil accounts. The server also enforces general per-IP/per-socket limits. When a reverse proxy is deployed, the service continues to use the TCP peer address; it deliberately does **not** trust arbitrary `X-Forwarded-For` headers. A verified, explicit trusted-proxy boundary is required before adopting client IP forwarding.

### Hidden-information release gate
Any new network mode or game must avoid sending authoritative hidden state through app props, DOM, logs or WebSocket messages. A game with hidden tiles or fleets cannot be put onto the generic LAN transport without a correctly scoped per-seat projection. Test the actual server fanout and resume path, **not just a helper function**.

## Incomplete security and quality tasks

- **#90:** versioned SQLite migrations, resilient online backup, encrypted retention, full restore test, monitoring
- **#91:** verified account deletion, password reset, email confirmation, retention policy and session revocation across devices
- **#92:** malicious/oversized payload and concurrency matrix, account-auth endpoint abuse, real-device QA and load testing
- **#81:** production HTTPS/WSS server and cross-network tests; not deployed here
- **#80:** LAN between physical Android/iOS devices, cross-platform interoperability and per-game expansion

These items are **not approved for production** and must not be marked complete solely because CI passes.

## Merge gate
Require: green `Validate NAQLA`, GitHub Actions Android debug build and iOS simulator build, responsive Playwright checks, no unexpected hidden-state regression, and no high/critical unexplained findings in reviewed changes. Real physical-device tests and operational security review are separate deployment gates.

## Release acceptance record

- CI run / commit SHA: *Use latest PR checks, not a hardcoded stale run*
- Physical-device and cross-network QA: **not performed**
- External penetration test: **not performed**
- Encrypted backup restore test: **not performed**
- Production deployment: **not performed**

## Account and recovery changes awaiting deployment validation

Schema v3 introduces hashed, single-use recovery and verification tokens,
with expiring links, generic reset-request replies, throttling, session
revocation after reset, and configurable server-side transactional email.
See `docs/OPERATIONS_ACTIVATION.md`. These changes must undergo CI,
delivery-domain tests and actual host backup/restore before production sign-off.
Self-service account deletion and privacy-law/retention review remain open.
