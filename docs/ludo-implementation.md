# NAQLA Ludo — Offline implementation and remaining work

This change adds an playable **offline Ludo** feature with premium square/radial boards. It is intentionally not a full implementation of the attached 20-phase specification.

## Architecture observed on main (2026-10-17)

- The repository is a React 19 + Vite + TypeScript + Capacitor monorepo.
- Shared game contracts in `packages/core/src/game.ts` cap `Seat` at four and `PlayerCount` at 2/3/4. Standard match UI/server data is tied to this contract.
- The central registry `packages/games/registry.ts` contains twelve other games.
- Adding `ludo` as a standard registry plugin before extending the shared contracts would falsely advertise ten-player online support. Ludo therefore has a dedicated local feature path and does not appear in multiplayer matchmaking or rankings.

## Delivered paths

- `packages/games/ludo/engine.ts`: deterministic topology and turn resolution for exactly 4, 6, 8, or 10 players; Classic and Fast objectives; captures; safe cells; third-six penalty; ranking; resignation; simple AI; uniform local RNG sampler.
- `apps/mobile/src/LudoPage.tsx`: local pass-and-play and one-human-versus-AI sessions; legal token action tray; zoom/overview/focus; versioned save/resume.
- `apps/mobile/src/LudoBoard.tsx`: premium playable square 4-player board and radial 6/8/10-player boards, warm-gold frame, glossy pawn markers, colored lanes, star safe tiles, accessible keyboard-selectable pawns; rendered cells are mapped to rules-engine route IDs.
- `apps/mobile/src/ludo.css`: responsive board and setup styling.
- `apps/mobile/src/ludo-i18n.ts`: localized Arabic and English copy.
- App/library integration: `apps/mobile/src/App.tsx`, `apps/mobile/src/gameViews.tsx`, `apps/mobile/src/components.tsx`, `apps/mobile/src/pages.tsx`, `apps/mobile/src/i18n.tsx`, `apps/mobile/src/main.tsx`.
- Tests: `tests/ludo.test.ts`, `tests/e2e/games/ludo.spec.ts` (counts, saves, zoom, Arabic RTL and board shape).

## Rules and topology

| Count | Circuit | Route destinations | Tokens | Safe nodes |
|---|---:|---:|---:|---:|
| 4 | 52 | 57 | 16 | 8 |
| 6 | 78 | 83 | 24 | 12 |
| 8 | 104 | 109 | 16 (2 per player) | 16 |
| 10 | 130 | 135 | 10 (1 per player) | 20 |

The **4-player and 6-player boards have four pawns per player**, the **8-player board has two**, and the **10-player board has one**. Routes remain independent of pawn quota, so each seat retains an equally long circuit. Each circuit has thirteen logical nodes per seat, with safe offsets 0 and 8. Five private approach nodes precede the player's own finish. Exact landing is mandatory. Releasing on a six consumes the roll; it does not move six extra steps. Unsafe capture returns the opposing token(s) to their original base slots. Bonus turns do not stack. Three consecutive sixes discard the third roll while keeping earlier committed moves. Classic requires all allotted pawns to finish. Fast requires up to two pawns (the minimum of two and the available quota), and withdraws any unused pawns.

## Legacy save compatibility

- Saves created by the old renderer used schema version 1, with four pawns for every seat count. The redesign introduces schema version 2 and saves under `ludo-offline-v2`.
- Four-player and six-player legacy sessions are migrated without changing their pawn IDs, turn or positions.
- Eight-player and ten-player legacy sessions cannot be migrated without silently removing pieces. Their original `ludo-offline-v1` records are retained and a localized message asks for a fresh game. No in-progress match is silently truncated.
- App test selectors: `data-ludo-board-variant`, `data-ludo-cell`, `data-ludo-base-slot`, and `data-ludo-token`.

## Supported modes and explicit gaps

| Mode | 4 | 6 | 8 | 10 |
|---|---|---|---|---|
| Offline pass-and-play | Implemented | Implemented | Implemented | Implemented |
| Offline versus AI | Implemented | Implemented | Implemented | Implemented |
| Offline save/resume | Implemented | Implemented | Implemented | Implemented |
| Online private rooms | Not implemented | Not implemented | Not implemented | Not implemented |
| Quick Match | Not implemented | Not implemented | Not implemented | Not implemented |

AI is a configurable heuristic (Easy, Medium, Hard) — captures valued by victim advancement, escape-from-danger value, destination-danger and threatened-stack penalties on Hard — measured with the seeded simulation in `docs/ludo-ai-measurement.md` (it is still not a rollout/lookahead engine). Online dice and results are **not** trusted to this client: online mode remains disabled. No cosmetic store, leaderboard integration, online replay/idempotency, AFK timer, server-side version check, or production matchmaking is claimed.

## Next implementation gates

1. Extend shared `PlayerCount`, `Seat`, transport, lobby capacity, ownership, match snapshots, results, and rematch protocols compatibly with the twelve existing games.
2. Adapt this rules engine to the verified central server coordinator so online rolls use server CSPRNG, server-side legal moves, serialization/transactional revisions, idempotency and reconnect recovery. Establish a versioned command/event protocol.
3. Build 4/6/8/10 independent authenticated-client tests, including concurrent joins, deadline/forfeit races and reconnects.
4. ~~Tune and measure AI Easy/Medium/Hard policies~~ Done for 4p/6p classic and 4p fast via seeded simulation (`docs/ludo-ai-measurement.md`); Grand (10p) duration/balance measurement and any lookahead/rollout policy remain open.
5. Complete real device UI accessibility/performance and reduced-motion checks; produce actual bilingual screenshots; verify app install and lifecycle behavior.
6. Run release CI, verify downloadable Android/iOS artifacts when available, then convert this draft PR after the blockers are resolved.

Run `npm test` and `npm run typecheck` from the repository root. Run the Ludo browser spec using `npx playwright test tests/e2e/games/ludo.spec.ts` where browsers are installed. CI evidence should be recorded against the exact final commit.
