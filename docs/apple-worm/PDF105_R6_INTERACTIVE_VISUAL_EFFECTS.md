# Apple Worm — PDF105-R6, visual animations only

## User request
Polish the **single approved 105-level Apple Worm game** with expressive mouth, animated fruit, an always-open victory exit, and special effects. The user does NOT want stage layouts or win conditions changed.

## Implemented in actual running game
1. **Mouth anticipation** — a pure visual cue (`apple-worm-animation-cues.ts`) checks the existing head position against **remaining** visible apples. When fruit is 1–2 grid cells away, the face turns to the nearest fruit and the mouth opens conspicuously. If the apple is distant/gone, the mouth rests closed. No apple is inserted, moved, or counted as required.
2. **Bite / chew feedback** — when the existing `moveScreenshotWorm` result increases collected fruit, the UI triggers a 720 ms one-shot mouth chewing animation and an 8-piece glowing fruit burst at the **same source-grid coordinate**. The effect clears automatically, and is cancelled on stage change, restart, and undo. No engine movement code changed.
3. **Fruit animation** — remaining apples float subtly, have a breathing golden halo and a lively glimmer.
4. **Always-open portal animation** — for every source stage with a known exit, the existing active portal (`ready`) gains a slow rotating orbital ring, pulsing aura and small sparks **even when apples remain**. Entering a portal adds an expanding victory halo; no fruit prerequisite.
5. **Accessibility and performance** — CSS animations use SVG/CSS only, no per-frame React state, no canvas draw loop, no extra movement calls. `prefers-reduced-motion:reduce` suppresses movement, spin and flashes.
6. **Visible version** — `PDF105-R6` in game, allowing PC/Android verification.

## Files changed (without stage data updates)
- `apps/mobile/src/AppleWormArt.tsx`: mouth pose class and detailed mouth shape.
- `apps/mobile/src/apple-worm-animation-cues.ts`: pure visual proximity helper.
- `apps/mobile/src/AppleWormReferenceScene.tsx`: decorative SVG auras, orbit/sparks, bite burst and mouth props.
- `apps/mobile/src/AppleWormScreenshotGame.tsx`: triggers transient bite effect only on an already-computed successful fruit pickup; clears it on undo/reset/stage switch.
- `apps/mobile/src/apple-worm-immersive.css`: animations, transitions and reduced-motion rules.
- Tests of proximity, closing mouth, completed fruit pickup visuals and 105 always-active known portals; Playwright stage 1, 2 and 15 art checks.

## NOT CHANGED
- All 105 stage IDs, terrain cells, source-frame geometry, initial worm, apples, portals, gray object locations
- `packages/games/apple-worm/screenshot-game.ts` and all `video-*-105.ts` data
- Movement, worm growth, collisions, gravity, collection and win rules
- Existing saved player progress (the save key is not changed)

## Existing separate gap
Previous source frames still have 3 unresolved portals (70/95/101); this effects-only task does NOT invent exits where screenshots do not establish one. For every existing portal, the portal is always ready even before collecting apples. Full original winning-route certification is a separate gameplay QA issue.

## How to identify the installed version
Look for `PDF105-R6` in Apple Worm. GitHub merge does not automatically replace a running desktop dev server or an installed Android APK.
