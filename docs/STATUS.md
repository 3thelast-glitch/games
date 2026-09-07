# Delivery status — 0.1.0

This is a functional implementation under active development. It is not yet a publicly deployed or app-store-ready service.

## Implemented and exercised

| Area | Evidence |
| --- | --- |
| Abalone rules | All six directions, inline/sidestep moves, legal Sumito strengths, equal-strength rejection, blocked pushes, edge ejections, victory, malformed input, immutable updates and seeded playout tests |
| Quoridor rules | Cardinal moves, straight jumps, permitted diagonals, blocked jumps, wall collisions/intersections, both-player path protection, either goal row, malformed input and seeded playout tests |
| Checkers rules | Mandatory captures and continuations, promotion stopping a chain, kings, alternate capture routes, blocked opponents, repetition and no-progress draws |
| Gomoku / Connect Four | All line directions, freestyle Gomoku overlines, gravity, full columns, row-boundary rejection and full-board draws |
| Nine Men’s Morris | Placement, reserve handling, protected captures, sliding/flying, re-formed/double mills, blocked/two-piece wins and repetition |
| Digital Game | Classic numbered-tile engine, server-side hidden-state projection, variable player counts, timer behavior, multiplayer synchronization and concurrency regression coverage |
| Reversi | Standard 8×8 opening, Black first, all eight capture directions, multi-direction flips, strict move parsing, automatic forced pass, terminal no-move/full-board detection, disc-count wins/draws and deterministic immutable updates |
| AI | Legal output on shared difficulty levels, UI-free engine and worker integration, including Reversi legal-move regression coverage |
| Server authority | Authenticated membership, current turn, strict message schemas, server clocks, illegal-move rejection, forged-seat tests and authoritative execution of registered game engines |
| Reliability | Duplicate/reused command IDs, revision/write-version handling, disconnect deadlines, restart recovery, persisted sessions/state, result settlement and client outbox recovery |
| Accounts/ranking | Email password/session handling, guest upgrade, verifier-bound OAuth exchange, per-game Elo, rooms, queues, friend filtering and UTC ranking periods |
| UI interactions | Board selection/placement flows, Arabic controls, local-only undo/restart, result rendering, Reversi legal targets/flip feedback and fixed LTR game coordinates inside RTL UI |
| Browser layout | Playwright responsive matrices across English/Arabic, mobile/landscape/tablet/desktop sizes, touch geometry and Chromium/Firefox/WebKit checks |

The repository test runner discovers all `*.test.ts` and `*.test.tsx` files under `tests`, so the suite grows with game modules. CI reports the authoritative current test count; this document intentionally does not hard-code a number that becomes stale as coverage is added.

## Built/configured

- TypeScript checking, production frontend bundle, AI worker and server bundle are part of validation CI.
- Dependency auditing is part of validation CI.
- Android/iOS generation is supported through Capacitor; Android has a supplied GitHub Actions debug-build workflow.
- Docker and GitHub Actions definitions are supplied.
- English/Arabic dictionaries, responsive CSS, reduced motion, sound and haptics are implemented.
- Reversi has dedicated English/Arabic rule documentation and is included in the responsive/cross-browser matrices.

## External setup and release work

| Item | Remaining step |
| --- | --- |
| Public online play | Deploy a persistent server, configure domain/TLS and allowed origins, then build clients with its HTTPS URL |
| Google/Apple | Supply provider credentials/configuration and test genuine sign-in, consent and deep-link returns |
| Android release | Build/sign against the intended production backend and test on physical devices before store distribution |
| iOS release | Build/sign using Xcode on macOS and verify on physical iOS devices |
| Device QA | Repeat accessibility, performance, touch, Arabic/RTL and native audio/haptics checks on representative real devices |
| Operations | Configure monitoring, backups/migrations, capacity testing and abuse/collusion controls before public ranked deployment |

## Product choices relevant to the current game set

- Most board games are two-player. Digital Game supports variable 2–4 player matches through the shared seat model.
- Undo is local-only; online matches remain server-authoritative and do not expose client-side state rollback.
- Ranked results alter per-game Elo; casual/local play does not let a client submit trusted ratings or results.
- Automatic board draws are engine-owned. Reversi ends when the board is full or neither side can move and uses final disc counts; equal counts are a draw.
- Reversi passing is automatic only when the next player has no legal move; there is no voluntary pass action.
- Reversi board coordinates remain LTR even inside Arabic RTL UI so row/column geometry is stable across languages.
- The shared hard AI is a bounded baseline and is not claimed to be tournament-strength.

## Planned expansion

LAN multiplayer, Chess and Mancala remain planned additions. **Reversi is implemented and playable**, not a Coming Soon entry. The engine/view registries provide the extension points described in [architecture](ARCHITECTURE.md).

For Reversi-specific behavior, see [English rules](reversi.md) and [Arabic rules](reversi.ar.md).
