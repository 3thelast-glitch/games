# Chess Piece Reference Trace

Reference image: user-supplied authoritative six-piece silhouette sheet.

The implementation in `packages/games/chess/pieces.tsx` is traced from the supplied raster reference rather than reconstructed from generic chess symbols.

## Mapping

The source order is treated as authoritative:

1. Pawn
2. Knight
3. Queen
4. King
5. Bishop
6. Rook

Queen and King are intentionally mapped according to the labels in the reference, not conventional assumptions about the silhouettes.

## Measured source bounds

Coordinates below are measured directly from the supplied 1536x840 reference after excluding labels and the white background.

| Piece | Source bounds (x0,y0,x1,y1) | Width px | Height px | Height vs King |
| --- | --- | ---: | ---: | ---: |
| Pawn | 106,415,236,603 | 130 | 188 | 0.462 |
| Knight | 319,327,488,603 | 169 | 276 | 0.678 |
| Queen | 571,274,733,602 | 162 | 328 | 0.806 |
| King | 801,195,963,602 | 162 | 407 | 1.000 |
| Bishop | 1026,283,1189,603 | 163 | 320 | 0.786 |
| Rook | 1262,342,1422,603 | 160 | 261 | 0.641 |

All six traced paths share one `0 0 220 430` viewBox. Their source-derived vertical positions are preserved, so the King remains tallest and the Pawn remains shortest. Their lower edges share the same baseline band instead of independently scaling each piece to fill its box.

## Vectorization method

- Thresholded the dark silhouettes from the supplied high-resolution reference.
- Excluded the text labels and white background.
- Preserved disconnected King crown geometry and the visible crown/head separator.
- Preserved the Bishop's diagonal opening as true transparent negative space.
- Preserved the Knight as a left-facing silhouette with no added eye, bridle, mane, or internal decoration.
- Simplified pixel/compression noise while retaining the recognizable outer contour details.
- Centered every trace in the shared coordinate system without changing its measured width/height ratio.
- Both player colors reuse exactly the same SVG geometry.

## Binary-mask comparison

After rasterizing the SVG paths back into the common reference coordinate system, the silhouette Intersection-over-Union (IoU) against the thresholded source masks is:

| Piece | Mask IoU |
| --- | ---: |
| Pawn | 97.48% |
| Knight | 97.64% |
| Queen | 97.66% |
| King | 97.03% |
| Bishop | 96.57% |
| Rook | 97.59% |

These values are evidence of close contour matching, not a claim of 100% identity. Remaining differences are primarily intentional smoothing of source JPEG/edge noise and threshold ambiguity around anti-aliased edges.

## Rendering policy

- Dark pieces: flat near-black.
- Light pieces: flat ivory/off-white with the smallest practical dark edge treatment for contrast.
- Transparent background.
- No gradients, bevels, glossy shading, stock sets, icon fonts, emoji, or Unicode chess glyphs.
- SVG source orientation is never mirrored for RTL.
- Existing Local Tabletop rotation remains a board/game behavior and is separate from source artwork orientation.

## Verification

`tests/chess-ui.test.tsx` verifies:
- all 32 starting pieces render as traced SVGs;
- all six source-mapped piece types are present;
- Queen and King mappings remain distinct;
- the shared reference viewBox is used;
- legacy Unicode chess glyphs are absent.

`tests/e2e/visual/chess-piece-reference-screenshots.spec.ts` captures integrated board evidence at:
- 320x568
- 360x640
- 390x844
- 430x932
- 768x1024
- 844x390 landscape
- 1366x768 desktop

The screenshot matrix covers both English/LTR and Arabic/RTL.
