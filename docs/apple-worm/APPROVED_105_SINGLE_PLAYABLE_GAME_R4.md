# Apple Worm PDF105-R4 — approved gallery is the ONE playable game

## User-confirmed acceptance baseline

The reference screenshot/video from 2026-10-19 shows a desktop gallery titled “105 مراحل من الفيديو الأصلي” with brown square platforms, green circular worm cells, red apples, gray question-mark obstacles, black swirl portals, and a selector numbered 1 through 105 in batches of 15.

The user approves **these 105 pictured stage layouts and this stage design** and wants them to replace competing designs or 40 experimental stages. The phrase “صور مرجعية • ليست قابلة للعب أو معتمدة نهائيا” was a defect in the previous UI messaging, not a rejection of the user's source.

## Actual implementation changes

1. `apps/mobile/src/AppleWormReferenceScene.tsx`: the prior reference gallery's 630×270 visual scene (brown tiles, green body circles, red circular apple, gray '?' obstacles, black spiral) is now the **real game renderer**, not a static preview. It uses exactly the same `screenshotWormLevel` data used for keyboard, touch, swipe, apple collection, portal win, undo and restart. Drawing groups include testable data attributes.
2. `apps/mobile/src/AppleWormScreenshotGame.tsx`: a single playable title/board/stage list with the same gallery presentation, all seven batches of 15 stage buttons, previous/next and movement buttons. Removed all “not playable/unapproved” labels. Reference stage selection always reads the 105 source maps. Revision `PDF105-R4` shown in the UI.
3. `apps/mobile/src/apple-worm-immersive.css`: one responsive gallery-layout screen for desktop and mobile, preserving the 630×270 source preview aspect ratio. On phone the stage selector can expand; on PC it remains shown.
4. `apps/mobile/src/AppleWormSourceGallery.tsx`: retired the non-playable separate viewer; obsolete calls are redirected to the same unified playable 105-stage screen. The independent 40-stage legacy game is not linked anywhere from Apple Worm’s public entry.
5. `tests/e2e`: updated the playable-gallery geometry checks and tested selected levels 001, 002, 010, 015 (from the user's screenshot) and 101, stage switching, win/undo input and mobile responsive geometry.
6. The portal remains active even with zero apples, per user rule.

## What this does / does not certify

- **Accepted stage source:** all 105 screenshots, per user.
- **Stage select:** all 105 sourced stage IDs are offered inside the same game.
- **The actual renderer:** now the approved gallery visual vocabulary. The old miniature reference gallery and alternative premium art are not the runtime gameplay.
- **NOT certified:** individual sprite-pixel matching against all 105 PDF images, exact original physics and 105 winning sequences. The underlying snapshot data still has 3 source exits that could not be observed from the available PDF: stages 70, 95 and 101. They can be selected and moved, but an original portal win cannot be established until source video evidence recovers the exits; do not fabricate coordinates or advertise confirmed wins on them.
- **Old PC dev server/cache:** a previously running localhost build does not auto-update when GitHub main changes. After merge, fetch latest source and restart the PC dev server; hard-refresh. The `PDF105-R4` marker confirms this renderer/version.
