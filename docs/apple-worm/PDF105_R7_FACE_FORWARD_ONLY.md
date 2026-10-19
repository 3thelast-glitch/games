# Apple Worm PDF105-R7 — face direction & realistic apple anticipation

## Bug reproduced from the user's two screenshots

- The R6 proximity heuristic considered any apple within Manhattan distance <= 2.
- It returned the **apple's direction**, and the renderer fed that direction into the ENTIRE face: eyes, head and mouth were turned toward an apple underneath or beside the worm even when the head had not turned in gameplay.
- The closed/idle mouth remained drawn as a conspicuously open magenta oval.
- A nearby apple behind a brown tile, gray blocker or body could cause false anticipation.

## R7 fix implemented

1. **Face stays naturally forward.** Compute one orientation from the existing head + next neck segment, preserving the approved Level 002 right-facing source-frame exception. Do not change the face, eyes, nose or head angle based on fruit positions.
2. **Mouth opens only for a reachable apple directly in FRONT.** Check just one or two cells along the existing face vector (right, left, up or down). Fruit below an upward-looking head, beside a horizontal face, behind the head, or diagonally away cannot trigger opening.
3. **No opening through obstacles.** Stop lookahead at the first source terrain cell, gray item or occupied body cell. Do not invent any changes to obstacles/geometry. Distance 2 is allowed only if distance 1 is clear and both lie on the same row/column.
4. **Default mouth actually closes.** The idle magenta mouth is now visually slim/closed; only a fruit ahead opens it. The existing real-fruit chewing animation expands, bites, then closes. These mouth transforms do not affect the character hitbox or the game engine.
5. **Tests** reproduce the reported vertical-worm/apple-below scenario, horizontal side/behind/diagonal fruits, actual stage screenshot layouts, blocked front paths, chewing particles and open portal effects. The browser smoke asserts R7 and initial head direction for Level 002.
6. **Version:** `PDF105-R7` is visible in the single PC/mobile game.

## Unchanged
- 105 approved stage layouts, coordinates, numbering and stage selection
- movement, turns, worm head/body positions, gravity, growth, apple collection, win conditions
- the portal remains open the entire time and does not require collecting fruit
- saved completed levels and in-progress game state

## Existing separate issue
As before, source exits for 70, 95 and 101 were not positively identified from earlier contact sheets. This visual/mouth fix does not invent new exits.
