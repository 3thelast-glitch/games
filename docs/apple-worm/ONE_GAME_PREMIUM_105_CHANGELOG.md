# NAQLA Apple Worm — ONE GAME, premium design, 105 PDF stages

## User's video (19 October 2026, 26.7s)

- Video opening, around 03–14 seconds: first lightweight source/screenshot game, small board in a dark web shell, using 105 stage maps.
- Video around 16–26 seconds: **second polished premium-looking game** with floating mountain-islands, bright sky, lush grassy platforms, a detailed green worm and a blue/gold exit. That screen used a separate 40-stage game.

User request: **there must be only one Apple Worm game**. Preserve the polished appearance from the video second segment; replace its old, different maps with the PDF's numbered 105 stage layouts. Do not let users switch back and forth between two games.

## Implemented — source changes

1. `apps/mobile/src/AppleWormPage.tsx`: replaced prior dual-mode launcher/legacy game with one `AppleWormScreenshotGame` entry. There is no accessible 40-stage practice game through this Apple Worm screen.
2. `apps/mobile/src/AppleWormScreenshotGame.tsx`: removed `onLegacy` and the "Legacy 40" navigation button. The main screen is now one immersive full-viewport game, rather than a small alternate source player. Version marker is `PDF105-R3`.
3. `apps/mobile/src/AppleWormReferenceScene.tsx`: adopted existing premium `WormSky`, `WormTerrain`, `WormCharacter`, `WormApple`, and active `WormPortal` inside the **105-stage screenshot engine**. Grid centres and terrain positions remain the PDF's 640×360 geometry (x=33+30*x; y=73+30*y). This changes visible game art and presentation without replacing stage layouts.
4. `apps/mobile/src/AppleWormArt.tsx`: optional head angle for the PDF Level 2 original pose.
5. `apps/mobile/src/apple-worm-immersive.css`: full-screen premium board (no scrollable dark mini-board), pointer input and original 16:9 SVG viewbox preserved.
6. Tests: one premium scene, no switch to second game, source stage selection and separate in-game stages 1, 2, 10, 101; touch/swipe/undo and responsive checks.

## What remains to do

- Not all 105 layout/obstacle/hazard sprites have passed a pixel-level source comparison. Some original screenshots are game-in-progress frames.
- Three portal locations (70,95,101) were not verified from previous source frame.
- Real game route physics and hazards for each stage still require dedicated comparison and QA.
- An existing APK will not update itself. Verify `PDF105-R3` on an installed APK compiled from this commit/merge.

## Verification

Use GitHub Actions (Validate NAQLA, Playwright Responsive Smoke & Full Matrix, Android APK and iOS) before declaring release status. Never equate successful build with 100% level fidelity.
