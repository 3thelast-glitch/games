# Original community game integration — staging and runtime contract

This work prepares **SuperTux**, **Freeciv-web**, and **Mindustry** to appear in
NAQLA's library, with honest install/runtime detection. A launcher tile is NOT a
claim that the upstream game engine is packaged or playable. Production launch
is gated on supplying the real original runtime.

## 1. SuperTux

Pinned upstream source: https://github.com/SuperTux/supertux

```sh
git submodule update --init --recursive native/community/supertux
```

Use the **original** upstream Emscripten build, based on the commands in
`native/community/supertux/.github/workflows/wasm.yml` (Emscripten/CMake
and dependencies). Once you have compiled the release build in
`native/community/supertux/build` and generated
`supertux2.{js,wasm,data}` plus `supertux2.html` (or `template.html`), run:

```sh
node scripts/package-supertux-web.mjs native/community/supertux/build
npm run build
```

The runtime must be copied to
`apps/mobile/public/third-party/supertux/` **before** running Vite/Capacitor
builds. The launcher checks an explicit `naqla-runtime.json` created only
after all required binary assets exist, avoiding false positive SPA fallback
responses. The generated runtime directory is intentionally gitignored; do not
accidentally commit large binary assets or unreviewed upstream artwork.

Verify full gameplay, touch controls, audio, pause/resume, license notices and
saves on real browsers and Android/iOS WebViews before releasing.

## 2. Freeciv-web

Pinned upstream source: https://github.com/freeciv/freeciv-web

The original Freeciv-web JavaScript client requires a *separately deployed*
Freeciv-web stack. Its README documents Tomcat/Java, nginx, Python
WebSocket proxy and Freeciv C game servers; an iframe without those services
is not a functioning game.

Deploy an instance that you operate and set the HTTPS origin/URL at Vite
build time:

```sh
VITE_FREECIV_WEB_URL=https://your-freeciv-host.example/ npm run build
```

**The URL is a placeholder, not a working service.** It must permit framing by
the NAQLA origin through CSP `frame-ancestors`; the server must provide
real authentication, privacy controls and security patching. If not configured,
NAQLA displays an unavailable/runtime setup state rather than silently loading
someone else's public service or pretending to implement the game. Do not
redirect users to an unrelated website.

## 3. Mindustry (browser preview path, not yet a proven release)

Pinned **official** game source: https://github.com/Anuken/Mindustry .
The original Android/iOS app is Java/Arc and is NOT a React component.
The `NaqlaMindustry` native plugin is only a future native-engine option.

To try real playable gameplay in the same NAQLA APK **without a second
application**, this PR adds an **experimental** local web build option using
https://github.com/khoichon/mindustry-web (GPL-3.0).
It compiles Mindustry + a modified Arc to static JavaScript assets using
TeaVM; the port is not an official Mindustry release and has known bugs.

A reproducible GitHub Actions test build is at
`.github/workflows/community-mindustry-preview.yml`.
It checks out web-port commit
`33652d79b21498d2cbd0d7f38cab46aa3a8fe183`, obtains the exact
official v159.7 asset source `Mindustry.jar`, checks its release SHA-256,
runs `./gradlew :backend-teavm:buildWeb`, packages the *real compiled*
files into `apps/mobile/public/third-party/mindustry/`, then creates a
NAQLA Android **preview** APK artifact containing those files.

Run it on the PR's branch (or manually once the workflow has landed on
the default branch) and install the resulting debug APK **for testing only**.
Offline static files are embedded inside the APK and are served from its
Capacitor origin. The Mindustry launcher checks `naqla-runtime.json`
and starts the bundled `index.html` in a fullscreen game frame only when
the real TeaVM bundle exists. Without these assets, it continues to show
"Setup required".

Local equivalent from a clean checkout (Java 21, Android SDK, Node 24):

```sh
git clone --recurse-submodules https://github.com/khoichon/mindustry-web.git .cache/mindustry-web
git -C .cache/mindustry-web checkout 33652d79b21498d2cbd0d7f38cab46aa3a8fe183
git -C .cache/mindustry-web submodule update --init --recursive
curl -fL --retry 3 -o .cache/mindustry-web/mindustry.jar \
  https://github.com/Anuken/Mindustry/releases/download/v159.7/Mindustry.jar
echo '67b2e5c7575e564b184ed11e139c01ddc140afd28b238715e7d42e81612fdfbe  .cache/mindustry-web/mindustry.jar' | sha256sum -c -
(cd .cache/mindustry-web/offlinemode && ./gradlew :backend-teavm:buildWeb)
node scripts/package-mindustry-web.mjs
cp .cache/mindustry-web/LICENSE apps/mobile/public/third-party/mindustry/LICENSE
npm run mobile:android
(cd android && ./gradlew assembleDebug)
```

Note: The runtime must be built **before** `npm run mobile:android`; otherwise
the normal NAQLA APK does not have the engine. iOS has not yet been proven
compatible. Before release, verify actual playable boot, menus, world loading,
touch controls, audio, save/load, resizing, pause/resume, offline operation,
WebGL support and memory/performance on real hardware.

## Licenses and distribution obligations

- SuperTux: GPL-3.0-or-later, assets often CC BY-SA.
- Freeciv-web: AGPL-3.0 web client; GPL Freeciv C server.
- Mindustry: GPL-3.0.

All three have reciprocal-source and attribution obligations. The Mindustry browser preview adds an unofficial GPL-3.0 Arc/Mindustry fork, which must also have corresponding sources and notices available. Embedding
upstream code into the NAQLA product may subject the combined work to
corresponding-source obligations. Before distribution, evaluate license
compatibility, publish required complete corresponding sources, preserve
copyright/licensing notices and inspect licenses for all artwork and third
party dependencies. Regular NAQLA browser, Android and iOS builds do not package the upstream runtimes by default. The dedicated Mindustry preview workflow attempts a separate explicit runtime build.

## Scope boundaries

The 3 games are standalone entries. They are not added to the authoritative
2-player strategy server, Elo, ranked matchmaking or LAN. Do not claim online
play through NAQLA's existing WebSocket protocol.

Release acceptance:
1. Verify the exact upstream source commit and licensing for code/assets.
2. Build and embed the *real* runtime, not an external deep link or imitation.
3. Confirm launch, gameplay, exit and resume on each target platform.
4. Add repeatable runtime packaging and CI smoke tests.
5. Only then claim a game is fully integrated and playable.

## Staging web preview: original Mindustry engine embedded by Docker

The earlier PR #165 proves that Mindustry TeaVM can compile and be packaged
inside an Android APK, but **the normal NAQLA web Docker image still does not
contain it**. The optional development path in
`feat/staging-playable-community-runtimes` changes the staging Docker build
to compile the pinned upstream-derived TeaVM game and copy its static files
into `dist/mobile/third-party/mindustry/` *before* building the NAQLA frontend.

The resulting Docker image serves a runtime manifest and the original game
bundle from the same HTTPS origin as NAQLA. Its game frame has a narrow
exception to the existing strict CSP: it may be framed by the same origin and
execute the upstream game's inline boot scripts. Every other NAQLA page
retains DENY, strict script-src and frame-ancestors none. A future separately
hosted Freeciv web server can be permitted in the parent's `frame-src`
**only** via the validated HTTPS origin `FREECIV_WEB_ORIGIN` on the server,
together with `VITE_FREECIV_WEB_URL` at frontend build time. Both sides of
that configuration must match; neither setting deploys Freeciv itself.

The new experimental build can be checked through GitHub Actions workflow
`Verify bundled Mindustry web runtime`, which builds the entire Docker image,
checks the packaged binary and manifest and probes static game URLs and
frame headers. CI and this document do **not** claim that full game
play on browsers, iOS or Android has been verified.

Before applying the preview to a real deployment:
- Check compile success and that every expected Mindustry file was bundled.
- Test actual boot/menu/world/touch/audio/save on the *target browser/device*.
- Check CPU, bandwidth and deployment size requirements.
- Complete legal review of GPL corresponding source, copyright notices and
  the modified Arc port, not just the upstream repository.
- Preserve the rest of the app's online backend and persistent data; do not
  replace the existing NAQLA server with a static-only site.

**SuperTux and Freeciv-web remain unavailable.** They require their real
WebAssembly binary or full game server respectively. Merely showing their
icons is not a successful integration.
