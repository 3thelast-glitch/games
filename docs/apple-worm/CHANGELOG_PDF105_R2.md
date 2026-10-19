# Apple Worm — PDF105-R2 visible update

## Changes actually made inside NAQLA

1. **Platform rendering** (`apps/mobile/src/AppleWormReferenceScene.tsx`): adjacent brown or brick blocks now render as one continuous landmass, with highlights and dark perimeter edges only where the platform is exposed. This is visibly different from the older square-by-square grid that drew black seams along every internal cell border.
2. **Recognizable game build** (`AppleWormScreenshotGame.tsx`): the main Apple Worm screen visibly displays `PDF105-R2` beside the current stage number. The game's top-level element also has `data-visual-revision="PDF105-R2"`. An installed build without this label is **not** this revision.
3. **Correct first frame after installing the updated APK**: saved completion progress and the selected stage number are retained; when upgrading from an earlier visual revision, any *old in-progress worm position* is reset to the current reference-image start pose. That prevents old saved positions from making a new design look unchanged.
4. **Stage switching regressions**: Playwright now opens real source levels 001, 002, and 010, checks that the board geometry and terrain cell counts actually change (12, 10, and 25 cells respectively), confirms connected terrain drawing and confirms `PDF105-R2` is shown. It also continues to open Level 101.
5. **Level 001–105 remains the PDF-based mode on entry**, not the separate 40 legacy practice maps. The always-open portal and optional apples remain unchanged.

## What has NOT been changed or completed in this revision

- No new source stage geometry, obstacle coordinate or apple layout has been invented. The mapped 105 source screenshots from the previous main branch remain the input for terrain positions.
- The game still has visual and mechanics discrepancies against the PDF, including provisional gray obstacle treatment, worm direction/orientation in some stages, and unresolved source exits in levels 70, 95 and 101.
- This revision does **not** claim all 105 levels have pixel-identical art or proven original win routes.
- This is a code/build change, not automatic replacement of an APK already installed on a phone. Players need the Android artifact **built from this PR head or a subsequent main merge**, not a previous release.

## Verification

- `Validate NAQLA` / TypeScript + unit tests
- Playwright source-stage selector and responsive smoke
- Android APK build artifact, iOS simulator build

Use the final CI status and run links for the exact commit before saying a fresh downloadable APK exists.
