# Apple Worm — first of three 33-problem-stage batches

Source: user-supplied `Apple_Worm_Selected_33_Levels(1).mp4` (640×360, ~966.82s).

## Scope is EXACTLY 15 stages
**Batch 1:** 5, 7, 8, 9, 12, 13, 14, 15, 17, 18, 19, 20, 28, 30, 34

**Batch 2 (later):** 39, 40, 42, 44, 49, 51, 58, 59, 71, 72, 73, 76, 86, 96, 97

**Batch 3 (later):** 98, 104, 105

Neither batch 2 nor batch 3 is modified or certified in this PR. They are left on the pre-batch baseline. No merge to main until batch 1's quality gate is accepted.

## Verified video-body correction in batch 1

| Stage | Video timestamp (s) | New head-to-tail length | Present engine win? | Replay moves |
|---:|---:|---:|---|---:|
| 5 | 0 | 4 | **YES** | 13 |
| 7 | 17 | 3 | **YES** | 13 |
| 8 | 25 | 3 | **YES** | 17 |
| 9 | 47 | 4 | **YES** | 8 |
| 12 | 65 | 3 | **YES** | 13 |
| 13 | 86 | 3 | **NO** (all reachable states explored) | — |
| 14 | 105 | 3 | **NO** (all reachable states explored) | — |
| 15 | 117 | 3 | **NO** (all reachable states explored) | — |
| 17 | 140 | 3 | **NO** (all reachable states explored) | — |
| 18 | 169 | 3 | **NO** (all reachable states explored) | — |
| 19 | 184 | 4 | **NO** (all reachable states explored) | — |
| 20 | 219 | 3 | **NO** (all reachable states explored) | — |
| 28 | 263 | 3 | **NO** (all reachable states explored) | — |
| 30 | 293 | 3 | **YES** | 19 |
| 34 | 340 | 3 | **YES** | 19 |

These 7 YES statuses are from actual `moveScreenshotWorm` routes replayed to `phase='won'` on the CURRENT NAQLA engine, not just geometric previews. The eight NO statuses are a diagnosis of the current provisional NAQLA implementation, not of the user-provided game's validity.

### Additional source correction

- **Stage 12:** reposition one gray block to the filmed opening (10,4) instead of the original mid-play still.
- **Stage 30:** restore two bottom apples (nine? No: five total visible when added to the three originally recorded) and source-frame gray blocks (9,5) and (10,7). Stage 30 belongs in batch 1.
- **All 15:** preserve the already-approved terrain grid and known portal cell; no shortcut/automatic win.
- Before this split an earlier draft accidentally touched Level 59 and caused CI failure. The current batch STRICTLY excludes 59 and all later levels.

### Verified physics defect from stage 18 sequence

Inspect the ~169–181 second section of the user's video: the worm uses gray cubes in a tight enclosed room as physical support/steps and then escapes toward the exit. The current NAQLA screenshot engine treats gray candidates as *immobile blockers*. That is not enough to match the video. Don't move original terrain or place arbitrary worm body pieces; implement and verify the actual source box-support/movement behavior, then prove winning replay.

## Release and continuation gates

1. Unit test `apple-worm-video-batch-1.test.ts` enforces exactly these 15 source overrides and 7 already known replayable wins.
2. **Batch 1 remains incomplete until all 15 source stages have replayed real winning routes.** The video and screenshot source layouts are not rejected because engine searches fail.
3. Resolve the remaining eight in this batch only: **13, 14, 15, 17, 18, 19, 20, 28**.
4. Only after batch 1 passes 15/15: merge it, build Android, then start batch 2's 15 levels.
5. Batch 3 has exactly 3: 98, 104, 105. None is changed in this PR.

## Actual GitHub files
- `packages/games/apple-worm/video-start-poses-selected-33.ts` — only 15 source-frame poses, numbered above.
- `packages/games/apple-worm/screenshot-game.ts` — only stage-start overrides, while retaining all 105 terrains and exits.
- `apps/mobile/src/AppleWormScreenshotGame.tsx` — `PDF105-R8` marker and migration that does not resurrect stale saved positions on changed stages.
- `tests/apple-worm-screenshot-game.test.ts`, `tests/apple-worm-video-batch-1.test.ts` — exact source rows, stage parity and replayed wins.
