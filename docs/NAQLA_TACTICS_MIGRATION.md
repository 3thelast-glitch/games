# NAQLA Tactics integration — implementation and remaining Athena Crisis migration

## Verified in this branch

- Adds a native React game page at `apps/mobile/src/NaqlaTacticsPage.tsx`, launched from the existing NAQLA icon library.
- Implements an **independent, original** typed tactical rules engine (`packages/games/naqla-tactics/engine.ts`), with infantry, scouts, tanks, artillery, forests, mountains, water, cities, bases, combat, income and recruitment.
- Adds three original local campaign maps, human vs AI, pass-and-play local mode, autosaved matches and Arabic/English UI.
- Provides original CSS rendering and responsive controls, including fullscreen support and reduced-motion handling.
- Adds rules tests under `tests/naqla-tactics.test.ts` for legal movement, turn validation, capture, recruitment and AI handoff.
- Integrates the launcher with `App.tsx`, `gameViews.tsx`, `gameLibraryCatalog.ts`, `components.tsx` and `i18n.tsx`.

## Absolutely not yet delivered

This is **not a copy or port of Athena Crisis**. The original Athena Crisis engine (`athena`, `apollo`, `hera`, `dionysus`) is not included. This branch does not contain Athena Crisis commercial assets, maps, soundtrack, original campaign, or proprietary online systems. The tactical battle mechanics and visuals in this branch were authored for NAQLA.

The game is not yet connected to NAQLA's authoritative match server or to its ranking/leaderboard. Online multiplayer cannot be selected from this page; a local/hot-seat game is not a network game. Passing local tests does not verify Android/iOS builds or production online/WSS.

## Upstream source and rights

- https://github.com/nkzw-tech/athena-crisis
- https://github.com/nkzw-tech/athena-crisis/blob/main/LICENSE.md

Source code is MIT licensed **but the MIT grant explicitly excludes game art, branding, sounds, remotely loaded assets, campaign content and other separately licensed material**. Always retain copyright and MIT attribution for upstream code copied in future PRs. Asset extraction or reverse engineering does not itself grant a distribution license.

## Next phases (must be implemented and tested separately)

1. **Real MIT-engine migration:** pin an upstream commit, inventory `athena`/map and `apollo`/game-state dependency graphs, port compatible source and tests with preserved attribution, bridge the server state protocol, then migrate pathfinding/combat/AI from this independent prototype. Do not introduce an upstream module unless its dependencies/build inputs are accounted for.
2. **Art/campaign:** replace prototype art with polished, original NAQLA sprite sheets, terrain transition sprites, capture/attack animations, original maps and progression, plus audio licensed for distribution. Check Arabic/English and low-memory mobile GPU constraints.
3. **Production multiplayer:** integrate a dedicated game adapter into NAQLA's server-authoritative game registry and WebSocket protocol, persisted match/reconnect logic, guest/account auth, anti-cheat visibility, rematch and rate-limits. Execute cross-network two-device test before saying Online works.
4. **Release gates:** CI `npm test`, `npm run build`, Playwright sizes 320–1920, platform signing and artifact builds for Android/iOS, accessibility, frame pacing and deterministic rules tests.

## Reproducing basic checks

From repository root (Node.js >=24):
```bash
npm ci
npm test
npm run build
```
CI should also run Android/iOS jobs if the existing workflows are configured to run on PRs.

Please **review as a partial functional integration**, not a completed upstream port.