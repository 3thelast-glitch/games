# Apple Worm — Video batch 3 of 3: source-corrected starts and replayed wins

## Fixed scope

**Only stages 98, 104 and 105** from the user's selected 33-level MP4.
Previously approved first 30 stages remain unchanged, as do all 105 terrain
masks, portal positions, stage IDs and the single premium NAQLA game.

Reference files (user uploads):
- `Apple_Worm_Selected_33_Levels(1).mp4` (640×360, 966.82 seconds)
- `apple-worm(2).pdf` (snapshot montage; not necessarily level-start frames)

## Stage-by-stage source evidence

| Stage | Video timestamp | Source worm (head → tail) | Source object correction | Replayable win |
| ---: | ---: | --- | --- | ---: |
| 98 | ~821 s | (14,3),(14,4),(13,4),(12,4) | Restore apple (15,1) and a third upper saw (5,-1) | 26 moves |
| 104 | ~848 s | (6,7),(5,7),(5,6) | Classify seven-cell pillar x=4,y=1..7 as **fixed** and isolated crate (7,7) as **movable** | 8 moves |
| 105 | ~914 s | (12,3),(12,2),(12,1) | Preserve pictured apples and gray obstacles | 37 moves |

The original snapshot scanner had only one visible green cell on 98 and
104, and two on 105, because those PDF frames were not the untouched starts.
All three video-derived opening poses are connected, in-bounds, and avoid
approved terrain cells. Stage 98's source apple and upper saw are visible in
the first filmed 98 frame, not in the later PDF frame.

## Engine implementation

- `video-start-poses-batch-3.ts`: source frame timing, connected opening
  body order and limited missing object corrections.
- `gray-box-physics-batch-3.ts`: stage-104-only selection of the single
  pushable crate. Reuses existing legal push, support and falling-crate
  rules; seven static column cells stay solid.
- `screenshot-game.ts`: uses the same actual movement/gravity/win
  transitions as every other level; dynamic box state is saved and restored.
- `AppleWormReferenceScene.tsx`: keeps the fixed pillar visible while
  rendering the moving crate at its current location.
- `AppleWormScreenshotGame.tsx`: revision `PDF105-R11`, selective save
  migration. Older first and second batches' active saves at already updated
  revisions remain intact; completion history is preserved.
- `apple-worm-video-batch-3.test.ts`: no overlap with earlier batches,
  source start assertions, static/movable gray separation, save/restore,
  and full legal-route replay to the original portal.

## In-engine replay certificates

The following compact `U/R/D/L` inputs are applied **one legal move at a time**
through `moveScreenshotWorm`, beginning at `startScreenshotWorm`.
The final state must be `phase='won'` with the head at the original portal.
No direct state edits, fake exits, changed terrain or forced wins.

| Stage | Steps | Route |
| ---: | ---: | --- |
| 98 | 26 | `UURRRUULLLLLLLLLUULLLLDLLD` |
| 104 | 8 | `RRRURUUU` |
| 105 | 37 | `RULULLLLLLLUULLLDRDRRRRRRRURUUURRRRRR` |

The route strings are tested as concrete acceptance certificates.
The short stage-98/104 routes are also independently checked with bounded
BFS. This establishes **reachability in NAQLA's current game engine**,
not exact frame-by-frame timing or original commercial physics parity.

## Validation boundaries

- All 15+15 previously accepted stage winning routes continue to be
  required by their existing regression tests.
- CI must pass `Validate NAQLA`, `Build Android APK`, `Build iOS`
  and `Playwright` before this batch is considered merged/released.
- Do not misinterpret this as 105/105 source gameplay fidelity: exits
  missing on 70/95/101 and high-complexity audit cases need separate review.
- No changes to stages outside 98,104,105 or to any portal or terrain.
