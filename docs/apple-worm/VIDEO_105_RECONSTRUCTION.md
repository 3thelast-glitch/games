# Apple Worm — 105-stage video reconstruction evidence and acceptance contract

## Source
The user supplied the complete **47:53, 30 fps, 640×360** gameplay walkthrough, `Apple Worm - All Levels 1 - 105 / Solving All Levels - Full Game`. This document is based on inspection of the uploaded MP4, including a 12-second whole-video visual survey and frame-by-frame samples of the opening stages. `packages/games/apple-worm/reference-video.ts` indexes all 105 observed stages.

**Status: 105 stages are indexed, NOT implemented.** Live NAQLA still uses 40 separately authored puzzles. The contact-sheet atlas and 105 video stills have been exported for developer reference and are not committed as copied sprites to this public repository.

## Specific observed gameplay evidence
| Time in original video | Stage | Direct observation | Consequence |
| --- | --- | --- | --- |
| 00:00–00:07 | 1 | Continuous green worm starts bent in an L: head points right, body turns downward. A long brown floating floor is interrupted by a two-block-high step. One black spiral exit; **zero apples**. The worm traverses the hump and enters the exit. | Support stages without fruit, bent initial body, turns, rigid gravity, ledges and direct exit activation. |
| 00:08.7–00:10.2 | 2 | Green worm begins beneath a red apple left of a raised brown L-shaped platform. The head is moved vertically into/under the apple and the apple disappears as the body grows. | The live `moveWorm` branch forbidding vertical mouth-first apple entry is **not equivalent to the reference**. Implement intentional vertical fruit pickups in a reference-verified engine, while separately testing passive falls. |
| 00:12.7–00:14.2 | 2 | After collecting fruit, the worm climbs around the raised platform, turns 90 degrees and approaches the black spiral portal from the left. | Body must remain visually connected around corners, length must persist, and gravity/turning must be deterministic. |
| 00:16.5–00:24 | 3 | Two small, separated brown platforms, a suspended apple in the gap and exit above the right platform. | Actual separated terrain and suspended fruit; do not replace with a solid full-width floor. |
| 00:27–00:37 | 4 | A floor with recess and raised offset geometry; the worm climbs by turning and supporting itself. | Support nontrivial overhang and body-weight routing. |
| ~09:24–10:24 | late 20s → 31 | Spike beds become visible, then the brown terrain style transitions to a reddish brick grid. | Hazards and terrain families are mechanics/art requirements. |
| ~44:36–47:24 | 101–105 | Many red apples in some stages; gray stacked blocks/platforms, brick paths and circular hazards appear in the late sequence. | The existing 40-stage schema is inadequate; object-specific collisions, possible moving elements, and growth need separate evidence and tests. |

These observations are **not complete tile-by-tile transcriptions** and cannot prove implementation fidelity or every mechanic. Stills captured later in a level must never be passed off as untouched initial-state screenshots.

## Target gameplay, physics and animation
1. **Source geometry first.** For each 1–105 stage, trace an untouched entry state and its grid: full traversable boundaries, solid brown/brick blocks, spikes, gray blocks, apples (including zero), exit, worm's ordered head-to-tail coordinates and orientation. Compare the reconstructed still to the actual first source frame.
2. **Continuous segmented worm.** The source character is one visibly continuous bright-green shape with darker segment shading, two forward-facing eyes and magenta mouth; its body bends seamlessly around square-cell turns. Head motion is discrete grid navigation, visually interpolated, with segment order preserved. Never render disconnected circular beads or teleport during moves.
3. **Apples and growth.** A collected red apple disappears and the worm lengthens by one grid unit. Stage 2 shows an **intentional vertical** pickup; distinguish that from the different question of passive gravity landing on an apple. Neither side-only pickup nor unconditional pickup-during-fall should be accepted without source-based route tests.
4. **Gravity and support.** Reproduce the rigid, connected body's fall and stopping conditions, ledge catching, collision, turns, no instant 180-degree head reversal, and eventual failure/off-screen behavior by observing solutions. No arbitrary hidden invisible floor.
5. **Black spiral portal.** The exit appears as a dark circular spiral resting near the end of the obstacle course, not a glowing turquoise fantasy portal. Activation should follow the **actual fruit requirement** for each stage, including zero-fruit cases. Confirm transition/end-of-level animations against footage.
6. **Original 2D visual vocabulary.** Reference screenshot uses cyan-to-blue sky with wide radial beams; a low band of scalloped white clouds and green bushes along the bottom; solid chocolate-brown connected beveled terrain early on; brick terrain later; glossy red apples with brown stalk and green leaf. **No grassy caps, fantasy islands/waterfalls, unrelated gradients or scenic clutter** in the playable environment.
7. **Landscape composition.** Keep the puzzle comfortably centred in a full-bleed landscape viewport, scenery filling screen edges, and original proportions/cell alignment without stretch. Existing swipe-only mobile input remains the product requirement; keyboard arrows/WASD may remain on desktop. The reference video's on-screen arrow pad is NOT a requirement to reinstate it.
8. **Motion polish.** Precisely preserve phase ordering (press/swipe → grid move → growth/consumption → gravity settling → portal/win/loss); animate connected segment movement, corner turns, chewing cues and screen transitions without affecting deterministic logical state. Respect reduced-motion accessibility and pause/undo/restart.

## Source-to-implementation verification process
For **each stage, in exact order**:
- Find the real untouched entry frame, not merely the first frame showing its numeral; record the timestamp and the grid origin/pixel cell size.
- Transcribe the complete board from the video and label all moving/static object types. Flag any partly hidden tile as unknown; do not invent it.
- Follow the playthrough at high temporal resolution and transcribe the winning input sequence and relevant gravity/apple/hazard transitions.
- Implement missing physics only with clear observations; keep existing curated-40 gameplay intact until a verified reference mode is available.
- Prove a replayable winning route, compare screenshots at the start, after key interactions and at completion, then run touchscreen/landscape Arabic/English QA.
- Change the stage's four `mapTranscribed` / `initialPoseVerified` / `mechanicsVerified` / `solutionVerified` indicators **only when that exact evidence exists**; never mark stage 105 or all stages completed because they are indexed.

Start with 1–10, then 11–25, 26–50, 51–75, 76–100, 101–105. Do not publish unverified/placeholder maps and do not change the live 40-stage count to 105 before the verified playable pack exists.

## Existing code gaps verified by inspection
- `packages/games/apple-worm/levels.ts`: 40 original layouts, all with >=1 apple; no video level tiles.
- `packages/games/apple-worm/engine.ts`: requires first apple and disallows head entry from up/down; zero-fruit source stage cannot be loaded as-is. Current ground/hazard support is less expressive than high-level source evidence.
- `apps/mobile/src/AppleWormArt.tsx`: fantasy floating islands, grassy-capped blocks and related vector motifs differ from the actual user's provided screenshots. Visual replacements must be in **live game artwork**, not a mocked-up cover.
- `apps/mobile/src/AppleWormPage.tsx`: live stage save namespace is still `apple-worm-curated-40-v3`; preserve existing player saves during a future migration.

This PR remains intentionally **DRAFT** until the gameplay maps, physics and matching tests are real.


## Implementation checkpoint: first ten *source-traced map blueprints* (2026-10-18)
The first ten stage-entry frames were extracted directly from the MP4 (source timestamps: 0, 8.50, 16.60, 26.70, 40.50, 55.00, 65.80, 78.40, 100.70, 111.90 seconds). The following are **real reconstructed maps**, not the previously authored generic corridor levels:

- `packages/games/apple-worm/video-traced-stages.ts`: per-stage 21×9 map grids, three ordered worm segments, apple coordinates, exit coordinates, source timestamps, and clear route/gameplay **unverified** flags. Stage 1 is zero-fruit and L-shaped. Stage 3 has two detached three-cell platforms. Stage 6 has a suspended exit. Stage 8's exit is beneath the right platform.
- `tests/apple-worm-video-traced-stages.test.ts`: geometry/schema bounds, no impossible overlaps, connected source worm starts, independent stage terrain distinctness and special source-specific assertions.

Grid tracing compared each ground tile's 9×9 pixel center against brown foreground threshold from its actual unoccluded entry video screenshot; all **10 × 21 × 8** sampled terrain cells matched in that specific check. This does NOT prove sprite-by-sprite pixel fidelity, complete 105 maps, realistic gravity, object interactions, or winning paths.

The ten source-versus-reconstructed image sheets and machine-readable manifest have been delivered separately for inspection. The live `levels.ts` still uses the old 40 independently generated stages and the live game was **not updated** to run these new blueprints, because stage-1 zero-apple physics and stage-2 vertical biting differ from the existing engine and source solution routes have not yet been replayed. Do not merge or publish as 105 playable stages.
