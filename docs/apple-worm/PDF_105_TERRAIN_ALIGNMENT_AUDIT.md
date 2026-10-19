# Apple Worm — PDF terrain-grid alignment audit (19 October 2026)

## Reference and method

Input: user-supplied `apple-worm(1).pdf` (11 contact-sheet pages, 105 labelled frames). Each page contains one 1600×423 raster image; five 320px-wide stage frames per row and two rows on pages 1–10 (five stages on page 11).

Independent cell-centre sampling compared the reference PDF to `appleWormSourceTerrainCandidate(stage).cells` over every stage:

- Logical board: 21 columns × 9 rows, 189 probes per stage.
- Contact-sheet local cell centres: approximately `(16.5 + 15*x, 66.5 + 15*y)`, using the stage's 320px-wide contact tile.
- Terrain candidates: majority brown/brick pixels in 9×9 samples around each cell centre, excluding blue sky/green worm/light clouds.
- The original 640×360 scene is now rendered in the live SVG at grid centres `(33 + 30*x, 73 + 30*y)`.
- Source frames were compared as provided; they may depict positions after gameplay has begun.

## Results

| Check | Result |
| --- | --- |
| Indexed PDF stages | 105 / 105 |
| Terrain positions checked | 19,845 (105 × 21 × 9) |
| Terrain cells present | 1,847 |
| Initial terrain disagreements | 2 cells at Level 010: `(10,0)` and `(11,0)` |
| Terrain disagreements after correction | **0** in sampled occupancy |
| Level 001 | 12 terrain cells, zero visible apples; raised two-cell step and long floor |
| Level 002 | 10 terrain cells, zero visible apples in the reference frame; raised L-shaped terrain; visible portal at `(13,2)` |
| Level 010 | Corrected the uppermost two cells of the tall pillar |
| Rendering | Changed from 630×270 to native 640×360; correct grid offset and 16:9 framing |
| Level 002 head | Upper bend chosen as head and right-facing initial mouth restored |
| Level 002 route | Regression test proves direct portal completion with zero collected apples |
| Portal evidence | **105/105 black-spiral portal candidates located** in PDF images; eight edge cases manually transcribed (y=-2 or y=9) |

The automated terrain classification is a **cell-occupancy check**, not a pixel-perfect render comparison. Brown terrain sprites extend across tile boundaries; a cell-centre match does not certify texture, bevel widths, colors, shadows or image-level 1:1 identity.

## Items NOT accepted yet

The following remain **unverified**:

- All 105 complete pixel-by-pixel initial-frame render comparisons
- Manual head and tail orientation on every level (the legacy rightmost-head heuristic still applies beyond the specifically audited stage)
- Exact original apple-eating, gravity, saw, spike and movable-obstacle physics
- Exact asset styles and animations
- All 105 contact-sheet frames now have a black-spiral portal candidate. The last eight required individual enlargement: Levels 56, 66, 70, 95, 96, 101 above the main terrain rows, and Levels 73, 100 at lower edge y=9. These positions are **image observations, not verified winning routes**; some spiral art is partly obscured or cropped.
- Portal-entry physics was widened to support the last visible row y=9 without changing the original nine terrain rows. Full solutions for these levels have not yet been replayed.
- Complete original winning replay sequence and solvability for all 105 stages

**Do not label 105 stages as 100% identical or fully solved on the strength of the terrain-grid check.** Review the original high-resolution per-stage frames and the source video before promoting `exactVisualComparisonPassed` or `exactPhysicsVerified` to true.
