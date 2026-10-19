# Apple Worm — the supplied PDF is the approved level-design source

## Non-negotiable reference contract

The user-supplied `apple-worm(1).pdf` is the **authoritative, accepted design reference** for all 105 Apple Worm levels inside NAQLA. Do not investigate whether the reference levels are legitimate, playable, original, or correctly solved as a condition of matching the game to them. The reference is accepted by the user.

**Matching direction:** NAQLA rendered level N → corresponding PDF Level N (001 through 105). Never adjust a PDF design to fit the current code.

Each source image is also the required **initial visual presentation target** for the corresponding NAQLA level, even if a video screenshot happens to depict an intermediate gameplay state. The image is not to be silently replaced by a conjectured earlier starting position. In particular:

- Preserve visible worm shape, exact segment count, pose, mouth/head direction and position.
- Preserve visible apples (zero visible means **zero apples shown in that reference frame**); do not insert apples inferred from earlier unseen moves.
- Reconstruct the same platform layout, elevation, gaps, brick/earth variants, gray items, saws/spikes and the background scene.
- Keep observed exit locations exactly where the image shows them; if the image does not actually expose an exit, recover it from the accompanying source walkthrough rather than guessing.
- Stage 001 in NAQLA corresponds to Level 001 in PDF, ..., Stage 105 to Level 105. The separate 40-level practice maps are **never** substitutes for PDF levels.

## Gameplay behavior required inside NAQLA

1. The exit is active immediately and **does not require consuming any apples**. Apples remain optional growth items.
2. Any level may be restarted, and its first displayed frame returns to the pictured PDF state.
3. Keyboard, touch and swipe movement operate without displacing or changing the initial photographed layout before the first legal move.
4. Completing a level is based on entering the exit. Game engine testing checks **NAQLA implementation**; it is not an attempt to challenge the user's approved PDF designs.

## Visual acceptance, distinct from code checks

A level's visual acceptance requires an actual screenshot of **the running NAQLA game at initial state**, compared side-by-side against that stage's PDF image **excluding contact-sheet timestamp bars/video-control overlays**. Check positions and shapes of all visible elements. Grid-cell occupancy alone is insufficient for full-image acceptance.

Use separate fields in reports:

- **PDF reference accepted:** 105/105 (input design specification; not contingent on implementation)
- **NAQLA terrain cell mapping compared:** 105/105 (source-grid classification check)
- **NAQLA full-frame visual matching approved:** only after rendering and comparing the actual game image for that level
- **NAQLA gameplay behavior verified:** only after the game's tests/runs, independently of the PDF reference's validity

Never say that `0/105` visual approvals means `0/105` reference levels are wrong; it describes the **absence of completed app-to-reference acceptance checks**, not a failing reference. Never claim all NAQLA levels are 1:1 until the in-game screenshots actually pass comparison.

## Current implementation status

See `PDF_105_TERRAIN_ALIGNMENT_AUDIT.md` for measured terrain, worm, portal, and technical reconstruction progress. That document describes **gaps in NAQLA**, not errors in the user-supplied designs. PR #121 contains the renderer calibration and source-data corrections, and should be merged only after applicable release checks pass and remaining issues are clearly tracked.
