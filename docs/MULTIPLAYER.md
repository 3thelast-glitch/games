# Board Arena Multiplayer — Reversi LAN and Online

Status: repository-scoped Reversi LAN implementation is complete on `feature/reversi-lan-multiplayer`; physical-device/WAN-off and managed-provider verification remain external prerequisites.

## Baseline discovered

Board Arena is a React 19 + Vite application packaged for Android/iOS with Capacitor 8. The backend is a Node 24 HTTP/WebSocket authority using Zod runtime validation and persistent SQLite storage. Reversi already uses the shared deterministic game-plugin boundary and the online server already supports guest/account identity, private room codes, authoritative moves, revisions, command deduplication, reconnect grace, rematches, and result persistence.

The LAN implementation is intentionally a separate transport/authority path. It reuses the same `reversi` game plugin rather than copying capture rules.

## Architecture decision (ADR-001)

### Online

Keep the existing trusted Node/WebSocket authority for current deployments and local/self-host use. Clients send intent only; the server binds identity from the authenticated socket and computes canonical state. Do not accept a client board, score, color, actor, or winner.

For a future zero-cost managed deployment, Cloudflare Workers + SQLite-backed Durable Objects is the preferred target because the current Workers Free plan includes Durable Objects and Durable Objects are designed for coordinated stateful WebSocket applications. This repository does **not** claim a Cloudflare deployment until an authorized Cloudflare account/project is available and the endpoint is actually deployed and exercised. The current Node + local SQLite process cannot honestly promise restart persistence on a hosting plan with an ephemeral filesystem.

Fallback: the existing Docker/Node server can be self-hosted on a persistent volume. Self-hosting avoids a provider subscription but is not guaranteed zero operating cost and may require public routing/TLS.

### LAN

Android/iOS production/development builds use an app-local native TCP listener plus native local service discovery. The host device is the friendly-LAN authority. The guest may join via discovery or directly by host/address and port. Cloud auth, DNS, signaling, and the Internet are not part of the LAN protocol.

The LAN protocol is newline-delimited JSON over the native socket. It has explicit protocol/ruleset versions, room identity, random membership/resume tokens, match epochs, monotonic revisions, expected revisions, action IDs, duplicate receipts, authoritative snapshots, ready state, reconnect grace, rematches, and payload bounds.

LAN trust limit: the host is inside the trust boundary. A modified host app can cheat. Membership tokens prevent accidental/unauthorized seat reuse within the protocol but raw friendly-LAN TCP is not described as encrypted or safe from a malicious same-network observer.

Web browsers do not expose a general inbound TCP listener or native mDNS/Bonjour server API, so Web LAN hosting/discovery/manual raw-TCP joining is unsupported. Same-device, AI, and Internet modes remain available on Web.

## Protocol invariants

- Game: `reversi`; protocol version 1; ruleset version 1.
- Host and guest are authenticated by room-local random resume tokens. Seat/color is assigned by authority, not claimed by the client.
- Both seats must be present, connected, and ready before a match starts.
- A move includes `matchId`, `actionId`, `expectedRevision`, and `{row,col}` only.
- The authority checks an existing receipt before stale-revision rejection. Exact retry returns the recorded accepted result; reusing the ID with another payload is rejected.
- The shared Reversi plugin resolves flips, forced pass, score, and terminal result. There is no client `PASS`, `SET_BOARD`, `SET_SCORE`, or `SET_WINNER` command.
- Rematch needs both votes, creates a new match epoch, clears receipts/version, and swaps colors.
- A guest reconnect within the 60-second default grace gets the exact canonical snapshot. Grace expiry is an interruption, not a fabricated board-rule victory.
- A turn timer, when selected, is adjudicated by the host authority. `Off` keeps the normal untimed-per-turn LAN rule path.

## Manual LAN address

Accepted forms:

- `192.168.1.20:8765`
- `board-arena.local:8765`
- `[fe80::1234]:8765`

Port defaults to `8765` when omitted. URL schemes, credentials, paths, query strings, fragments, whitespace, and invalid ports are rejected. Manual address entry bypasses discovery only; it cannot bypass AP/client isolation, a firewall, VPN routing, or a different unreachable subnet.

## Native build requirements

The repository generates native Capacitor projects with `npm run mobile:android` / `npm run mobile:ios`. LAN native source and platform configuration must therefore be copied/registered by `scripts/mobile.mjs` so regeneration is repeatable.

Android requires ordinary network access and the platform NSD APIs used by the plugin. iOS requires Local Network privacy text plus the `_boardarena._tcp` Bonjour service declaration. Do not globally enable cleartext WebView traffic for LAN; the native plugin owns its TCP socket and the Internet endpoint remains HTTPS/WSS.

## Online hosting research — 2026-09-08

No third-party cloud provider can be guaranteed to remain free forever. Any free plan below is current and subject to quotas/policy changes.

| Option | Role | Current no-cost suitability | Key limitation | Verdict |
| --- | --- | --- | --- | --- |
| Cloudflare Workers + SQLite Durable Objects | Managed authoritative realtime runtime | Durable Objects are available on Workers Free with daily request/compute/storage quotas | Requires adapting the Node-specific server/storage layer to a Durable Object runtime and an authorized account | **Primary managed target** |
| Existing Node 24 + SQLite Docker server | Portable authority/self-host | No provider fee if run on existing hardware | TLS, routing, backups, electricity/Internet and CGNAT are operator concerns | **Fallback** |
| Render Free web service | Node hosting | Can run the process | Free service sleep/cold-start and ephemeral filesystem mean local SQLite cannot satisfy promised restart persistence | Not selected for persistent matches |

Before any managed provider is labeled deployed, record service/project, region if applicable, deployment revision, public HTTPS/WSS endpoint, two independent client sessions, legal + rejected move, reconnect, safe logs, and confirmed no paid-overage configuration.

## Quota model

A Reversi match has at most 60 successful placements after the four-disc opening. Forced passes do not create extra placement actions. A conservative online estimate should count lobby/auth/setup, accepted/retried commands, one authoritative snapshot fan-out to two players per transition, reconnect/sync traffic, WebSocket setup, and heartbeat/hibernation accounting according to the selected provider.

For `M` matches/month and `P` accepted placements/match:

- accepted move commands ~= `M * P`, where `P <= 60`
- delivered move snapshots ~= `M * P * 2`
- room/session requests = actual create/join/auth/resume operations, not assumed zero
- retained match storage = serialized match + command receipts until configured retention cleanup

Measured payload/operation totals must replace estimates after a real deployed-provider smoke test. Daily/burst/concurrency quotas can bind before monthly totals.

## Troubleshooting

| Symptom | Likely causes / checks | Recovery |
| --- | --- | --- |
| LAN room not visible | Local-network permission, NSD/Bonjour unavailable, multicast blocked, stale service | Refresh discovery; verify permission; use manual address |
| Manual LAN join fails | Wrong address/port, listener closed, different subnet, firewall, VPN, client isolation | Check host waiting screen endpoint; keep same reachable LAN; disable conflicting VPN/firewall rule; online mode is an explicit alternative |
| iOS local permission denied | Local Network privacy denied/revoked | Enable Local Network for Board Arena in iOS Settings and retry discovery/join |
| Android discovery fails | NSD unavailable, network changed, service stopped, router blocks multicast | Refresh; use manual address; verify both devices can directly reach each other |
| Wi-Fi works but WAN is down | Accidental cloud dependency would be a bug | LAN create/join/play must continue; use local address, not online room code |
| Room full/incompatible | Another guest owns seat or protocol/ruleset mismatch | Leave stale room or update both builds; do not bypass compatibility checks |
| Guest briefly disconnects | Wi-Fi switch/background/network pause | Keep host open; guest resumes with the stored room-local token during grace |
| Host exits/OS kills host | Host is LAN authority | Match becomes interrupted; recreate room. Host migration is intentionally not claimed |
| Online service unavailable/quota exhausted | Provider outage/cold start/quota | Bounded reconnect only; Same Device, AI, and LAN remain independent |

## Verification ledger

Use `PASS` only for checks actually executed on the PR revision. `BLOCKED` names a missing external prerequisite; `NOT TESTED` is applicable but unexecuted.

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Repository/architecture | PASS | Source inspection of manifests, Capacitor, Reversi plugin, Node authority, protocol, CI |
| Reversi rules | PASS | Deterministic Reversi unit/UI tests plus LAN tests reuse the same plugin |
| LAN protocol/authority automated tests | PASS | Validate Board Arena on the final implementation head completed successfully |
| Android native compile | PASS | Build Android APK completed successfully on the final implementation head |
| iOS native compile | PASS | Build iOS simulator app completed successfully on the final implementation head using macOS/Xcode CI |
| Physical Android/iOS LAN | BLOCKED | Requires two compatible physical devices/local router |
| WAN-off new LAN session | BLOCKED | Requires installed physical builds and controllable router/WAN |
| Existing online authority regression | PASS | Validate Board Arena and browser CI completed successfully on the final implementation head |
| Managed backend deployment | BLOCKED | No authorized hosting-provider project/credentials are available through the current repository connection |
| Two-device different-network online | BLOCKED | Requires deployed public endpoint and independent devices/networks |
| Arabic/English responsive Web checks | PASS | Responsive smoke plus Firefox/WebKit full-matrix checks completed successfully on the final implementation head |

## Real-device acceptance runbook

Record build revision, device/OS, host/guest role, locale, router/network, and result for every case.

1. Install the same compatible build on two devices.
2. With WAN available: Reversi → Local Network → Create Game on host; Find Games on guest; join; both Ready; play several legal moves and attempt one illegal/wrong-turn action; verify identical board/scores/actor.
3. Disable WAN and cellular fallback while preserving Wi-Fi. Continue the match, including a forced pass if reached, finish, and rematch.
4. With WAN still unavailable, cold-launch both apps and create a **new** room. Discover/join it. Then repeat using Join by Address while discovery is stopped/unavailable.
5. Disconnect guest Wi-Fi briefly, reconnect inside grace, and verify exact match ID/revision/board. Repeat beyond grace and verify interrupted state.
6. Background/foreground each device, lock/unlock, change Wi-Fi address when possible, deny/re-enable local-network permission, and document behavior.
7. For Online, use a real deployed HTTPS/WSS endpoint and two genuinely different Internet connections. Create/join a private room, play, reconnect, finish, and rematch.

## Provider/self-host operations

Self-host current backend only on storage that persists `DATABASE_PATH`. Terminate TLS at a maintained reverse proxy/load balancer, set `ALLOWED_ORIGINS`, keep `.env` secrets server-only, back up the SQLite file consistently, monitor disk/CPU/socket counts, and retain command receipts through the reconnect/retry window. Use `docker compose` only after configuring environment and persistent volume appropriate to the target machine.

Provider migration must drain or explicitly interrupt active matches unless the target can import the exact canonical match/session/receipt state. Export retained data, deploy compatible protocol first, rotate credentials, update `VITE_SERVER_URL`, rebuild native clients, verify health + gameplay, then retire the old endpoint with a rollback window. A changed endpoint alone is not a tested migration.
