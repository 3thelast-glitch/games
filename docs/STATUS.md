# Delivery status — 0.1.0

This is a functional initial implementation. It is not yet a publicly deployed or app-store-ready service.

## Implemented and exercised

| Area                     | Evidence                                                                                                                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Abalone rules            | All six directions, inline/sidestep moves, legal Sumito strengths, equal-strength rejection, blocked pushes, edge ejections, victory, malformed input, immutable updates and seeded playout tests    |
| Quoridor rules           | Cardinal moves, straight jumps, permitted diagonals, blocked jumps, full/partial wall overlap, intersections, both-player path protection, either goal row, malformed input and seeded playout tests |
| Checkers rules           | Mandatory captures and continuations, promotion stopping a chain, kings, alternate capture routes, blocked opponents, repetition and no-progress draws                                               |
| Gomoku / Connect Four    | All line directions, overlines for freestyle Gomoku, gravity, full columns, row-boundary rejection and full-board draws                                                                              |
| Morris rules             | Placement, reserve handling, protected captures, sliding/flying, re-formed/double mills, blocked/two-piece wins and repetition                                                                       |
| Classic game integration | All three AI levels, tactical line wins/blocks, per-game rooms and Elo, same-player capture clocks, persisted terminal draws, idempotent settlement and rematch                                      |
| AI                       | Legal output on all three levels, tactical finishing moves on evaluated levels, UI-free engine and worker integration                                                                                |
| Server authority         | Authenticated membership, current turn, strict message schemas, server clocks, illegal-move rejection and forged-seat tests                                                                          |
| Reliability              | Duplicate/reused command IDs, revision handling, disconnect deadlines, server restart, persisted sessions/state, exactly-once result settlement, client outbox replay and stale-socket isolation     |
| Accounts/ranking         | Email password/session handling, guest upgrade, one-time verifier-bound OAuth exchange, per-game Elo, rooms, queues, friend filtering and UTC ranking periods                                        |
| UI interactions          | Selected Abalone moves, Quoridor preview/confirmation and blocked-path feedback, Arabic controls, local-only undo/restart and result rendering                                                       |
| Live networking          | Actual local HTTP and WebSocket server exercised with two sessions, private-room join and synchronized moves                                                                                         |

**158 tests pass.** Tests use Node's test runner, `tsx`, and JSDOM/React Testing Library for components. They execute without a graphical browser. This is an automated test count, not a measured coverage percentage or a proof that every possible position has been enumerated.

## Built/configured

- TypeScript checking, production frontend bundle, dedicated AI worker and server bundle pass.
- Android and iOS native project generation and plugin synchronization passed in the initial delivery; they were not repeated for this game-module update.
- Android callback manifest and iOS URL scheme/privacy configuration are present.
- Docker and GitHub Actions definitions are supplied.
- English/Arabic dictionaries, responsive CSS, reduced motion, sound and haptics are implemented.

## External setup and unverified behavior

| Item               | Remaining step                                                                                                                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub             | Source repository: `3thelast-glitch/games`, default branch `main`. GitHub Actions results are reported separately from the local verification below.                                                                                                                   |
| Public online play | Deploy one persistent server, configure domain/TLS and allowed origins, then build native clients with its HTTPS URL.                                                                                                                                                  |
| Google/Apple       | Supply provider credentials/configuration and test genuine sign-in, consent and deep-link returns.                                                                                                                                                                     |
| Android binary     | Run the supplied workflow or use Java 21 and Android SDK locally. This workspace did not provide the required SDK/toolchain, so no APK was compiled.                                                                                                                   |
| iOS binary         | Build/sign using Xcode on macOS. No IPA or device build was produced here.                                                                                                                                                                                             |
| Visual/device QA   | The cloud browser denied the local app URL under its access policy. No visual browser inspection was completed. The same local-URL block was encountered during this update. Component tests do not verify pixels, responsive fit, native audio/haptics or touch feel. |
| Container/hosting  | Docker execution and public proxy routing have not been run here.                                                                                                                                                                                                      |

## Product choices made for this version

- Two players per game. Local and AI play work without an account; ranked play requires registration.
- Ten-minute clocks per player. Online defaults and reconnect grace are configurable on the server. There is no time-control picker in this UI.
- Undo is local two-player only. Restart is available offline; an online rematch needs both players to agree and swaps sides.
- A mutual draw is a platform agreement between two human players, not an automatic board rule. AI draw negotiation is disabled. Automatic full-board draws are implemented for Gomoku/Connect Four. Checkers and Morris support automatic threefold repetition; Checkers also draws after 40 turns per player without capture or moving an uncrowned man.
- The hard AI is a bounded baseline and has not been strength-rated through tournament play.
- Local/AI history is device-only. Online profile totals include casual and ranked matches; only ranked results alter Elo. Abandoned matches record a draw result with the abandonment reason and no Elo change.
- Friends are one-way lists by code. Notifications are in-app alerts, not background push.
- Six supplied avatar symbols, original SVG game art and synthesized audio avoid external asset downloads. User-uploaded avatars are not implemented.
- Single-process SQLite persistence. Local match resume restores the last saved turn snapshot; it is a convenience feature, not a trusted competition clock.

## Work needed for a public service

- Email ownership verification, password recovery and account deletion/export flows.
- Native secure session storage and a complete session/device management policy. The current client persists sessions using Capacitor Preferences (localStorage on web), which is not encrypted secret storage.
- Provider credential rotation, privacy/retention policy and store-specific release metadata.
- Operational monitoring, migration/backup procedures, capacity testing, trusted-proxy rate limiting, and abuse/collusion controls for ranked play.
- Shared presence/matchmaking and coordinated match ownership before adding server replicas.
- Real browser/device accessibility and performance checks, including Arabic text, keyboard focus, touch target size, motion and screen readers.

## Planned expansion

LAN multiplayer and Chess, Reversi and Mancala are marked **Coming soon**. Their rules and networking mode are not simulated or included yet. The engine and view registries provide the extension points described in [architecture](ARCHITECTURE.md).
