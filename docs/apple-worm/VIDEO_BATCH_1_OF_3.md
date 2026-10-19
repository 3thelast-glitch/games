# Apple Worm — source-video corrections, Batch 1 of 3 (15/15 winners)

**Source:** the user's `Apple_Worm_Selected_33_Levels(1).mp4` (640×360, ~966.8 s). These are improvements to **NAQLA's playable implementation**, not challenges to the user's approved reference.

## Strict batch boundaries

**Batch 1 (15, completed in current NAQLA physics):** 5, 7, 8, 9, 12, 13, 14, 15, 17, 18, 19, 20, 28, 30, 34.

**Batch 2 (next, 15; no stage-start changes here):** 39, 40, 42, 44, 49, 51, 58, 59, 71, 72, 73, 76, 86, 96, 97.

**Batch 3 (later, 3; unchanged here):** 98, 104, 105.

The branch protects this boundary in `tests/apple-worm-video-batch-1.test.ts`.

## Results — REAL replayed victory for every stage

The actual NAQLA game-state API `startScreenshotWorm` + `moveScreenshotWorm` is used to replay every route, asserting **every command is legal** and the final `phase === 'won'`. The live exit stays open without having to collect all apples.

| Stage | Video frame (seconds) | Initial worm pieces | Verified moves | Proof |
|---:|---:|---:|---:|---|
| 5 | 0 | 4 | 13 | BFS + replay |
| 7 | 17 | 3 | 13 | BFS + replay |
| 8 | 25 | 3 | 17 | BFS + replay |
| 9 | 47 | 4 | 8 | BFS + replay |
| 12 | 65 | 3 | 13 | BFS + replay |
| 13 | 86 | 3 | 24 | BFS + replay |
| 14 | 104 | 3 | 19 | BFS + replay |
| 15 | 117 | 3 | 22 | BFS + replay |
| 17 | 140 | 3 | 13 | BFS + replay |
| 18 | 168 | 3 | 23 | BFS + replay |
| 19 | 184 | 4 | 9 | BFS + replay |
| 20 | 217 | 3 | 64 | Deterministic route replay |
| 28 | 263 | 3 | 17 | BFS + replay |
| 30 | 293 | 3 | 19 | BFS + replay |
| 34 | 340 | 3 | 19 | BFS + replay |

**Result: 15/15 replay-proven winners.** The stage-20 shortest budgeted BFS run remains *undetermined at 12,000 explored states*, but its 64-step real-state route is verified independently and is a genuine winner; search-time cutoff is not a gameplay failure.

## What was implemented and WHY

1. **Video-accurate 15 worm opening poses:** recovered head location, head-to-tail sequence and length, including the actual opening source frame for 14, 18 and 20. The previous draft mistakenly chose moving/winning intermediate poses for some stages.
2. **Moving gray crates in ONLY the eight failing stage IDs** `13,14,15,17,18,19,20,28`. The crates can be pushed when a neighboring grid cell is vacant, fall when unsupported, and provide physical support to the worm. Their current positions travel with the saved game state; undo and restart restore them correctly. The other 97 source stages retain previous static-gray behavior unchanged.
3. **Apples physically support crates while uncollected.** At 104–114 seconds (Stage 14), the gray crate visibly rests above a red apple; at 168–179 seconds (Stage 18), the initial gray crate also rests over an apple. An earlier implementation incorrectly dropped boxes straight through apples. When the fruit is eaten, the box can fall as shown by the video.
4. **Level 12:** source initial gray box at (10,4). **Level 30:** preserve two additional source-visible apples (five total), with source starting gray boxes at (9,5) and (10,7).
5. **Apple and portal data are otherwise unchanged.** No level terrain cells, source portal coordinates or stage numbering were edited; no forced completion, teleport or invulnerability shortcuts added.
6. **R9 UI:** actual changing gray-box locations are displayed in the one premium game. State restore and movement history keep box positions. A prior stale save for a corrected stage is reset to its new frame-derived opening pose without erasing completed levels.
7. **Solver state correctness:** BFS now hashes the positions of gray boxes as well as worm body and collected apples. Without this, different crate arrangements were being incorrectly treated as the same game state.

## CI and regression protection

- `tests/apple-worm-video-batch-1.test.ts`: asserts exactly the first 15 video pose overrides and all 15 real replay wins. Log marker `APPLE_WORM_VIDEO_BATCH_1_JSON` includes each stage.
- `tests/apple-worm-video-batch1-recovered-routes.test.ts`: explicit 14, 18 and 20 gameplay inputs verified from restart.
- `tests/apple-worm-gray-box-physics-batch-1.test.ts`: moving crates, falling/stacking, fruit-as-support, restore, and isolation from the remaining 97 stages.
- Existing source visual and 105-stage audits remain enabled.

**Evidence:** [Validate NAQLA — success](https://github.com/3thelast-glitch/games/actions/runs/39339818369), including 15/15 verified winner logging.

## Remaining limitations / next steps

The 15 actual NAQLA game levels can win, but this does **not** certify that *every intermediary frame* precisely matches the commercial Apple Worm video or that its crate/worm animations use identical timing. Source physics beyond this batch remains provisional. Batch 2 (15 levels) starts separately after merge. The full 105-level win audit Issue #130 remains open for the other 18 troublesome levels and unresolved three other exit locations.
