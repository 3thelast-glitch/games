# Mindustry inside NAQLA — offline first playable candidate

This branch focuses **only Mindustry**, not SuperTux or Freeciv-web. The
goal is to install a SINGLE NAQLA APK that embeds the original Mindustry
engine, maps, textures, sounds and menus and plays locally without contacting
a remote host.

## Source

- Original Mindustry: https://github.com/Anuken/Mindustry
  (pinned in `native/community/mindustry`).
- Browser-compatible derivative (Mindustry and Arc/TeaVM):
  https://github.com/khoichon/mindustry-web at
  `33652d79b21498d2cbd0d7f38cab46aa3a8fe183`,
  now also recorded as a source submodule at
  `native/community/mindustry-web`.
- Official v159.7 `Mindustry.jar` with the game resources and data:
  SHA-256 `67b2e5c7575e564b184ed11e139c01ddc140afd28b238715e7d42e81612fdfbe`.

`git clone --recurse-submodules` fetches the pinned source. Assets and
binary files are compiled/downloaded at build time; this is not an
external run-time dependency. In particular, an ordinary `npm run build`
does not include the Mindustry game unless the local files have already been
packaged.

## Reproducible dedicated Android build

Run GitHub Actions workflow
`.github/workflows/mindustry-offline-playable.yml` to build the upstream
TeaVM game, package its actual JS/assets and GPL license into NAQLA, build
the real Android debug APK and start the NAQLA website with the very same
assets for Playwright Chromium rendering and touch input smoke.

If the job succeeds, download
`NAQLA-Mindustry-offline-engine-debug-APK` from that workflow's artifacts.
To inspect its game frame, also inspect the
`NAQLA-Mindustry-rendering-verification` screenshots.

Install on a test Android device with
`adb install -r app-debug.apk`.
Open NAQLA → Mindustry → Play. The bundle includes game assets, so it must
not need a separate download, account or Internet connection to *load* the
local game. **Verify airplane mode, touch gameplay, new map, campaign,
saving, resuming and returning to NAQLA on real hardware**. A green CI
smoke certifies only first render + a touch event, not gameplay correctness,
complete offline campaign or save persistence.

The included `scripts/offline-game-csp.mjs` injects an app-level
Content-Security-Policy with `connect-src 'self'`, preventing remote game
requests in the Android WebView as well as the web server. Multiplayer
controls, if any remain in the upstream canvas UI, will not connect in
this offline edition. They must be removed/disabled in the original
Arc/Mindustry port for a polished production release.

## License and quality gate

Mindustry and the unofficial TeaVM browser port use GPL-3.0 licensing.
Before distributing the combined app publicly, evaluate the combined
source-disclosure obligations, include the complete corresponding source
and build scripts, and review licenses for all art/sound/font dependencies.

No new game is marked production-ready until boot, original gameplay,
touch, world load, save/load and airplane-mode verification work on
physical Android hardware. iOS requires separate testing. Neither source
copies nor a compiled APK alone proves a fully working game.

## Original game startup blocker fixed

Mindustry's real WebAssets startup can fetch over 700 files in a burst.
NAQLA's historical IP-wide HTTP limiter allowed only 600 requests per minute,
returning HTTP 429 on fonts, shaders, and textures and preventing the first
render. The server now assigns **GET/HEAD requests under
`/third-party/mindustry/` only** a distinct bounded 3,000/minute bucket.
Authentication, match, and API requests retain the original stricter
600/minute limit. A regression test fetches 720 local game assets, then
confirms the API bucket is not consumed and still enforces its own limit.

Browser first-frame test is still the release gate: do not treat an HTTP fix
as proof of game progression, save/load or touch gameplay.


## Small-screen original UI adaptation

Mindustry's source includes `UI Scaling` (original `uiscale` setting).
The original desktop main menu can overlap the logo and its own Play/Editor
actions when rendered in a 390px-high landscape mobile WebView.
`scripts/patch-mindustry-teavm-ui.mjs` applies a fail-closed patch to the
reviewed `offlinemode/backend-teavm/src/mindustry/Vars.java` BEFORE TeaVM
compilation. The default scale uses CSS-pixel height (physical graphics height
divided by devicePixelRatio), proportionally reducing original menu elements
for 390px-height phones; 680px+ displays retain 100%. Existing player-defined
`uiscale` values still win. The full original game logic and content remain
unchanged, and the source adaptation is included in the corresponding-source
build instructions.

For browsers denying orientation lock, NAQLA rotates the in-app iframe by CSS,
preserving pointer mapping. Android attempts to rotate the native activity.
The test artifact must still be verified with Play → Campaign/Custom → actual
world progression, saves and audio on a physical device before final release.
