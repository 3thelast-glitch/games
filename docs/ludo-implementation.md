# NAQLA Ludo — Offline implementation and remaining work

This change adds an initial playable **offline Ludo** feature. It is intentionally not a full implementation of the attached 20-phase specification.

## Architecture observed on main (2026-10-17)

- The repository is a React 19 + Vite + TypeScript + Capacitor monorepo.
- Shared game contracts in `packages/core/src/game.ts` cap `Seat` at four and `PlayerCount` at 2/3/4. Standard match UI/server data is tied to this contract.
- The central registry `packages/games/registry.ts` contains twelve other games.
- Adding `ludo` as a standard registry plugin before extending the shared contracts would falsely advertise ten-player online support. Ludo therefore has a dedicated local feature path and does not appear in multiplayer matchmaking or rankings.

## Delivered paths

- `packages/games/ludo/engine.ts`: deterministic topology and turn resolution for exactly 4, 6, 8, or 10 players; Classic and Fast objectives; captures; safe cells; third-six penalty; ranking; resignation; simple AI; uniform local RNG sampler.
- `apps/mobile/src/LudoPage.tsx`: local pass-and-play and one-human-versus-AI sessions; square/radial SVG board; legal token action tray; zoom/overview/focus; save/resume.
- `apps/mobile/src/ludo.css`: responsive board and setup styling.
- `apps/mobile/src/ludo-i18n.ts`: localized Arabic and English copy.
- App/library integration: `apps/mobile/src/App.tsx`, `apps/mobile/src/gameViews.tsx`, `apps/mobile/src/components.tsx`, `apps/mobile/src/pages.tsx`, `apps/mobile/src/i18n.tsx`, `apps/mobile/src/main.tsx`.
- Tests: `tests/ludo.test.ts`, `tests/e2e/games/ludo.spec.ts`.

## Rules and topology

| Count | Circuit | Route destinations | Tokens | Safe nodes |
|---|---:|---:|---:|---:|
| 4 | 52 | 57 | 16 | 8 |
| 6 | 78 | 83 | 24 | 12 |
| 8 | 104 | 109 | 32 | 16 |
| 10 | 130 | 135 | 40 | 20 |

Every player has four persistent tokens and the same route length. Each circuit has thirteen logical nodes per seat, with safe offsets 0 and 8. Five private approach nodes precede the player's own finish. Exact landing is mandatory. Releasing on a six consumes the roll; it does not move six extra steps. Unsafe capture returns the opposing token(s) to their original base slots. Bonus turns do not stack. Three consecutive sixes discard the third roll while keeping earlier committed moves. Fast mode ranks a participant after two finished tokens and withdraws the rest.

## Supported modes and explicit gaps

| Mode | 4 | 6 | 8 | 10 |
|---|---|---|---|---|
| Offline pass-and-play | Implemented | Implemented | Implemented | Implemented |
| Offline versus AI | Implemented | Implemented | Implemented | Implemented |
| Offline save/resume | Implemented | Implemented | Implemented | Implemented |
| Online private rooms | Not implemented | Not implemented | Not implemented | Not implemented |
| Quick Match | Not implemented | Not implemented | Not implemented | Not implemented |

AI is a basic configurable heuristic (Easy, Medium, Hard), not a measured competitive rollout engine. Online dice and results are **not** trusted to this client: online mode remains disabled. No cosmetic store, leaderboard integration, online replay/idempotency, AFK timer, server-side version check, or production matchmaking is claimed.

## Next implementation gates

1. Extend shared `PlayerCount`, `Seat`, transport, lobby capacity, ownership, match snapshots, results, and rematch protocols compatibly with the twelve existing games.
2. Adapt this rules engine to the verified central server coordinator so online rolls use server CSPRNG, server-side legal moves, serialization/transactional revisions, idempotency and reconnect recovery. Establish a versioned command/event protocol.
3. Build 4/6/8/10 independent authenticated-client tests, including concurrent joins, deadline/forfeit races and reconnects.
4. Tune and measure AI Easy/Medium/Hard policies, especially Grand; do not claim balance or expected match duration without seeded simulation.
5. Complete real device UI accessibility/performance and reduced-motion checks; produce actual bilingual screenshots; verify app install and lifecycle behavior.
6. Run release CI, verify downloadable Android/iOS artifacts when available, then convert this draft PR after the blockers are resolved.

Run `npm test` and `npm run typecheck` from the repository root. Run the Ludo browser spec using `npx playwright test tests/e2e/games/ludo.spec.ts` where browsers are installed. CI evidence should be recorded against the exact final commit.
