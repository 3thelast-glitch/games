# Apple Worm — video-verified 105-stage reconstruction

## Source and current status
The user supplied a 47m53s 640×360 gameplay video titled *Apple Worm - All Levels 1 - 105 / Solving All Levels - Full Game*. The source video **was inspected**. `reference-video.ts` indexes **all 105 stage numerals in chronological order**, with approximate timestamps of the first available 5-second keyframe for each level.

### What is proven by the source
- Stage 1 has **no apple**, unlike the current NAQLA engine which assumes at least one.
- Earlier stages feature distinctly different terrain geometries — steps, overhangs, U-bends and separated platforms. They are not 40 long, near-identical corridors.
- High-numbered stages (101–105) feature many apples, gray blocks, brick grids and circular saw-like hazards; the current 40-stage NAQLA engine cannot faithfully represent their rules.
- The first indexed screenshot is not necessarily a frame before the player has moved.
- The footage shows player actions and successful completions. Those routes can form stage-specific mechanical regression tests.

### NON-NEGOTIABLE acceptance gate
**Do not change the live stage count to 105 or merge placeholder/generated maps.** Each level needs:
1. Extract a true untouched initial frame and cross-check level number.
2. Rebuild correct traversable/blocked grid geometry, worm head and body sequence, every apple (including zero-apple levels), exit, hazards and moving objects.
3. Observe the solution route and special interactions; add missing rule types to the engine with tests *before* using that level.
4. Confirm an internally solved route under the same rules, with screenshots comparing rebuilt start/end frames to actual source frames.
5. Test both Arabic/English and Android landscape full-screen touch controls.
6. Only then mark the map and mechanics verified and include it in a release; ship contiguous verified stages, never fake later stages.

## Development batches
- 1–10: starter geometries, zero-fruit maps, one-fruit side-bite and basic gravity.
- 11–25: U-bends, overhangs, gaps, body weight, constrained navigation.
- 26–50: height changes, movable/stone obstacles if shown, multiple fruit where source proves it.
- 51–75: longer routes and advanced constraints taken **stage-by-stage from the footage**.
- 76–100: stronger multi-hazard/brick maps.
- 101–105: many apples, bricks, gray movable-looking objects and saw-like hazards. Analyze their rules, not just sprites.

## Provenance and quality
The atlas (105 frame captures and 11 contact sheets) is generated from the user's uploaded video and was not committed as copied game assets. Source art/assets are independently drawn for NAQLA. The timing index is evidence only, NOT playable level data. Do not claim exact fidelity to any source level without detailed map and mechanical validation. Retain existing 40-stage gameplay until an accurately transcribed pack is ready.
