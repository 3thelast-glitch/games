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

## 3. Mindustry

Pinned upstream source: https://github.com/Anuken/Mindustry

Mindustry is a native Java/Arc game. Its Android and iOS targets are
standalone applications, not drop-in React components. There is currently NO
Mindustry JNI/Gradle/RoboVM embed inside NAQLA, so the game is explicitly
unavailable. The page only enables launch when an actual Capacitor plugin
`NaqlaMindustry` provides `available(): Promise<{available:boolean}>` and
`launch(): Promise<void>`. This project does not register a dummy plugin.
Any eventual native integration must survive the regenerated Android/iOS
projects from `scripts/mobile.mjs` and remain **within the same NAQLA
application**, not an external APK.

## Licenses and distribution obligations

- SuperTux: GPL-3.0-or-later, assets often CC BY-SA.
- Freeciv-web: AGPL-3.0 web client; GPL Freeciv C server.
- Mindustry: GPL-3.0.

All three have reciprocal-source and attribution obligations. Embedding
upstream code into the NAQLA product may subject the combined work to
corresponding-source obligations. Before distribution, evaluate license
compatibility, publish required complete corresponding sources, preserve
copyright/licensing notices and inspect licenses for all artwork and third
party dependencies. The upstream source pin itself is not packaged in the
current NAQLA browser, Android or iOS build.

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
