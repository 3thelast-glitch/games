# Gas Station — implementation audit and continuation plan (23 Oct 2026)

Reference specification: user-supplied *NAQLA Gas Station — Complete Gameplay, Art, Mission, and Implementation Prompt*.
Reference inspiration: https://poki.com/ar/g/gas-station. Do not copy third-party assets.

## Confirmed existing implementation

- `packages/games/gas-station/engine.ts`: single-player economy, progression levels, seven aggregate mission counters, car spawn/serve/leave loop, basic garage steps, purchases, staff automation, one race event, version 1 local saves.
- `apps/mobile/src/GasStationArt.tsx`: stylized 2.5D SVG scene (not an actual 3D model renderer).
- `apps/mobile/src/GasStationPage.tsx`: HUD, movement, contextual interaction, inventory purchases, construction, staffing, event and missions.
- `apps/mobile/src/gas-station-i18n.ts`: Arabic and English.
- `tests/gas-station.test.ts`: engine coverage.

## Milestone implemented in this PR

- Active pump, shop, and tire jobs reserve pending stock until the receipt finalizes; no allocation of the same stock to two simultaneous jobs.
- Each worker may actively serve only one car. The manual garage sequence prevents staff taking over a half-finished diagnosis.
- A service bay cannot be reused while a car is still occupying it (including its short completed dwell).
- Washing requires consumable soap; a working wash receives three starter units once, then must be restocked.
- No free recurring shop income without a transaction.
- Offline staff revenue capped at two hours, bounded by supplies and one settlement per save timestamp; manual mission counters do not advance while offline.
- Saved in-progress cars, partial repair steps, and race event countdown/counters are restored after reload. Existing save schema remains version 1 with additive fields.
- Mobile movement/action controls use 44px minimum dimensions.
- Regression tests target concurrency, stock conservation, persistence, event and offline settlement.

## Remaining work before calling the user specification complete

### Simulation and game loop
- Implement fixed-step deterministic simulation, world route graph, physical car arrivals/parking/exit, actor navigation, explicit service steps with animations, inventory transaction ledger and stronger corrupted-save recovery.
- Deliver the requested neglected-site opening with eight debris targets, initial pump restoration and tutorial economy. Existing mainline values currently start with a functional pump and 180 cash.
- Implement real interactive shop shelves, delivery crates and checkout, four garage job types with persistent per-step state, simulated wash coverage and richer workers.
- Complete 30 distinct authored missions (M01–M30) with five chapters, preconditions, hints, world locators, claim idempotency, and whole-campaign solvability tests.
- Add replayable morning commute/pit-stop/clean finish events and M30 final challenge; validate event arrivals and time limits under test.
- Add stock/cash deadlock recovery (a bounded virtual emergency consignment) and stronger stock reservation/rollback transaction IDs.

### Visual quality and platform integration
- Replace current SVG-as-world with actual runtime 3D models/camera/animation if performance and repository tooling permit. Maintain original art and retain an efficient low-end option.
- Add full-screen self-contained game landing + Continue/Campaign/Challenges/Practice entry and concise in-world HUD.
- Improve accessible interaction cues, proper character/tool poses, soft shadows, vehicle animation, audio/haptics, safe areas, keyboard/motion and touch support.
- Verify performance on representative mobile hardware, supported Android/iOS builds, RTL at small sizes, complete campaign playthrough, and screenshot captures.

## Integrity gates

Do not merge merely because TypeScript passes. Check `npm test`, `npm run build`, mobile packaging, stock transaction regressions, real touch interaction and save/reload after active fuel/garage/event.

This document records **implemented versus pending scope**. It is not a claim that the full specification has shipped.
