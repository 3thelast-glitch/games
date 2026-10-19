# Apple Worm — PDF105-R5 (visual-only premium restoration)

## User-approved scope

The PDF-derived stages 001–105 and their gameplay are approved and **must not be changed**. The user wants only the old premium visual artwork restored.

## Exactly what changed

- **AppleWormReferenceScene.tsx:** replaced the primitive separate green circles with the existing premium **WormCharacter** SVG (one continuous body, shaded segments, expressive face, eyes and mouth), without modifying any worm cell; restored previous premium **WormApple**, **WormTerrain** (grass/flowers/shaded soil), **WormSky** (clouds and floating islands) and the always-ready **WormPortal**. Upgraded the appearance of source gray objects to glossy metallic/question-mark tiles. Their positions and meanings remain unchanged.
- **AppleWormScreenshotGame.tsx:** updated visible version to `PDF105-R5`; preserved the saved in-progress worm state across this visual-only version instead of resetting it. The same one game and same selector remain.
- **apple-worm-immersive.css:** visual polish to stage frame, background, navigation buttons, keyboard focus and selected level status. No layout geometry or pointer controls changed.
- **tests:** Playwright now asserts the premium objects and head coordinates across movement/undo and stages 1/2/10/15/101. New SSR unit regression renders **all 105** approved levels and verifies terrain-cell counts, worm head coordinates, visible apples, obstacles and portal anchor positions have NOT moved.

## Explicitly unchanged

- `packages/games/apple-worm/screenshot-game.ts`: all movement, gravity, win logic and stage state
- `packages/games/apple-worm/video-* `: 105 reference source geometries and objects
- All stage numbering, all 105 source layouts, all apple/gray item/exit cell coordinates
- 630×270 SVG viewBox, grid size and portal requirement (apples optional)
- Stage navigation, keyboard/swipe behavior and progress keys

## Known pre-existing limitations

This visual-only commit does not recover previously uncertain portal locations 70, 95, 101, correct provisional source physics, or certify 105 original victory paths. These are not grounds for changing source stages without further verified evidence.

The updated Android APK should show `PDF105-R5`. An already installed APK does not auto-update from a GitHub merge.
