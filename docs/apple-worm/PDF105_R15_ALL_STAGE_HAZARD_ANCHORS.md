# Apple Worm — global 105-stage hazard renderer audit (R15, 21 October 2026)

## Scope / verified implementation

- This change is in the **live `AppleWormScreenshotGame` rendering path** (`AppleWormReferenceScene` and `apple-worm-three.css`), not an edited screenshot.
- Every declared saw in the **105 source maps** now uses an immutable cell-centered outer `<g transform="translate(...)">`. Only the inner rotor spins.
- Each rotor is inside its **own 34 × 34 SVG viewBox centered at (0,0)**. CSS rotates relative to that local viewBox, rather than a changing painted-shape bounding box. It therefore cannot change the outer cell coordinate.
- The outer center cap and rim are static; saw blades have dark teeth with a visible direction marker.
- Accessible/reduced-motion settings stop rotation without changing any collision geometry.
- Black thorn rendering now draws four deep-black triangular points plus a base per declared spike cell. Spike geometry is **stationary**, and its face adapts to neighboring terrain (ceiling/wall/floor). Existing engine logic makes spike contact lethal, including fall contact.
- The visual revision increases to `PDF105-R15` without resetting the saved worm, unlocks, or geometry.
- A cross-stage regression test checks every saw anchor against its literal grid-center coordinates across **all 105 stages**, rotor containment, CSS pivot logic, and example black-spike rendering and lethal collision.

## Current data coverage / explicit limitation

- `VIDEO_SAW_STAGE_COUNT=54` represents **54 saw-bearing stages** found in the older video review. This patch does not invent wheels in the remaining stages.
- `VIDEO_TRIANGULAR_SPIKES` is **empty**, so none of the user's manually drawn black spike lines has been mapped to a verified grid position yet.
- The latest 55-page PDF named `NAQLA_AppleWorm_Our_Game_105_Levels_261021_211852(1).pdf` was supplied, but its page pixels were not available for reliable extraction in this pass. **Do not claim that the intended black lines were transcribed, or that spikes are fully present in the live 105 levels.** 
- Before completing that stage-specific work, inspect marked source frames at their native resolution; map each mark to level + cell + attachment face; then record the result in `VIDEO_TRIANGULAR_SPIKES` with test fixtures. Preserve the edible red fruit in L32; do not reclassify it by appearance.
- No stage win-route or pixel-perfect video equivalence was verified by this visual fix.

## Regression check

```sh
npm run typecheck
node --import tsx --test tests/apple-worm-all-105-hazard-anchor.test.ts tests/apple-worm-video-saws-stones.test.ts
npm run build
```

This R15 release addresses the **cross-stage drifting saw rendering mechanism**. The **spike coordinate transcription remains blocked** pending readable, position-specific visual evidence.
