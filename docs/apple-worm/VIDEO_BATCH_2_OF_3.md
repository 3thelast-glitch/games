# Apple Worm — Video batch 2 of 3: 15/15 replay-verified wins

## Source and scope

The user's uploaded **Apple_Worm_Selected_33_Levels(1).mp4**, 640×360, 966.82 s, is the reference for opening worm head/neck/body pose, fruits and gray items. All approved NAQLA **105 terrain layouts, numbering and portal coordinates remain unchanged.**

- **Batch 1:** 5,7,8,9,12,13,14,15,17,18,19,20,28,30,34 — **15/15 won**, merged PR #131
- **Batch 2 (THIS PR):** 39,40,42,44,49,51,58,59,71,72,73,76,86,96,97 — **15/15 won**
- **Batch 3 (not touched):** 98,104,105 — awaits separate correction

## Stage-by-stage video evidence and winning replay

| Stage | Source timestamp (seconds) | Actual head-to-tail segments | Winning route (moves) | Verification |
|---:|---:|---:|---:|---|
| 39 | 373 | 4 | **13** | BFS + full engine replay |
| 40 | 402 | 3 | **13** | BFS + full engine replay |
| 42 | 432 | 3 | **23** | BFS + full engine replay |
| 44 | 462 | 3 | **20** | BFS + full engine replay |
| 49 | 481 | 4 | **14** | BFS + full engine replay |
| 51 | 504 | 3 | **23** | BFS + full engine replay |
| 58 | 537 | 3 | **61** | BFS + full engine replay |
| 59 | 575 | 4 | **22** | BFS + full engine replay |
| 71 | 622 | 3 | **16** | BFS + full engine replay |
| 72 | 667 | 3 | **13** | BFS + full engine replay |
| 73 | 686 | 3 | **13** | BFS + full engine replay |
| 76 | 727 | 3 | **10** | BFS + full engine replay |
| 86 | 745 | 4 | **11** | BFS + full engine replay |
| 96 | 781 | 4 | **5** | BFS + full engine replay |
| 97 | 787 | 4 | **73** | Full 73-input engine replay |

**Result:** Every Batch 2 stage was initialized from the sourced video pose and replayed through `moveScreenshotWorm` all the way to `phase='won'`. The first 14 were found with bounded BFS, with independently replayed solutions. Stage 97 was verified by a recorded legal sequence of 73 moves; the quick BFS alone reached its 15,000-state cutoff. A search cutoff is **not** a failure to win.

CI evidence: [Validate NAQLA](https://github.com/3thelast-glitch/games/actions/runs/39342846453) — success, includes `APPLE_WORM_VIDEO_BATCH_2_JSON` marker listing all 15.

## Source-video corrections

1. **Fifteen opening worm poses:** New `packages/games/apple-worm/video-start-poses-batch-2.ts` stores the source video timestamp, exact ordered green segments and visible head. This corrects numerous PDF stills captured mid-play: e.g. 39 now starts with 4 segments, 49 with 4, 59 with 4, 86 with 4, 96 and 97 with 4. All body cells passed connection, bounds and **no approved terrain overlap** tests.
2. **Video-opening fruits:** Stage 51 gains `(9,-1)`, stage 58 `(9,-2)`, and stage 97 `(9,-1)` and `(17,5)`; all four are visible in the source clip but absent from later still-image inventories. The other source apples stay as recorded. They remain OPTIONAL for portal victory.
3. **Source-opening gray items:** Stage 97 records `(9,-2),(9,0),(2,4),(17,4)`; the added top and right cubes are visible above apples in the source footage. Existing accepted terrain/portal data are not changed.
4. **Wall-contact support where video shows it:** On stages **49,59,71,73,97 only**, the worm can remain supported when one segment touches a terrain or static gray item **from the side**, not only from below. The footage shows a hanging/clinging worm pose (especially 49 and 59), while previous gravity immediately lost such positions. Source walls remain impassable, and the remaining 100 stages retain their existing support rules.
5. **Same game on Android and desktop:** runtime reads the new start poses without opening a duplicate game; visual revision `PDF105-R10` identifies the updated version. An old in-progress saved pose is migrated for corrected video-start levels, while completions and other stages remain stored.
6. **Regression gating:** Tests prove Batch 2 touches exactly 15 stage starts, every body is connected, and all 15 end with actual portal wins. Source 105-stage validation and the first batch's 15/15 winning-route acceptance still pass.

## Scope and remaining limitations

These are **verified wins under NAQLA's running game engine**, **not** a claim that every animation/physics frame exactly matches the original commercial game. Rotating saws and gray items have provisional visual/physical classification; a separate frame-by-frame review is still required for exact timing and interaction fidelity. Source screenshots are accepted as valid and have not been redesigned. No exits were fabricated and no automatic victory was added.

**Next:** The separately scoped third batch, **98,104,105**, must have actual winning-route proofs. Overall 105-stage verification Issue #130 remains open until all source stages and the three previously missing portals are resolved.
