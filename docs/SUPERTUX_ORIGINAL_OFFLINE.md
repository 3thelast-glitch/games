# SuperTux original offline gameplay in NAQLA

This is an implementation/testing branch for SuperTux only. Freeciv-web is a
**separate** workstream tracked by [issue #169](https://github.com/3thelast-glitch/games/issues/169).

## Original engine and assets
- Original GPL C++/SDL game: https://github.com/SuperTux/supertux
- Exact reviewed source revision: `c837f4f5d8b5945e22df1e36ab8f05801cf08f9c`
- Full official Emscripten `supertux2.js`, `supertux2.wasm` and `supertux2.data` with
  original levels, sounds, sprites and art were compiled successfully by upstream's
  CMake/Emscripten steps in [NAQLA run 40082924498](https://github.com/3thelast-glitch/games/actions/runs/40082924498).
  This is a real original engine, not a reimplementation.

## Build and run
- `scripts/package-supertux-web.mjs` validates the compiled C++ WASM
  magic header and file sizes, embeds the complete original data pack,
  license and original HTML, and generates a strictly offline manifest.
- `scripts/supertux-touch-controls.js` adds local mobile arrow controls,
  Jump, Run/Action, Enter, Pause. All buttons synthesize keyboard input for
  the *existing* original Emscripten SDL engine. It does not alter game rules.
- NAQLA checks `runtime=emscripten`, `offline=true`,
  `requiresRemoteServer=false` before exposing Play. It opens in immersive
  landscape mode and returns to NAQLA's games library.
- Node's server streams the original large `.data` and `.wasm`
  files rather than loading them entirely into server memory.
- Dedicated workflow `.github/workflows/supertux-original-offline.yml` uses
  the already compiled upstream artifact, packages all source-derived
  assets into NAQLA, runs NAQLA tests, boots the original game in Chromium,
  waits until the true upstream loader is gone, verifies mobile key
  events, checks outside network calls, and builds a full test Android APK.

The old compilation artifact expires after seven days. A sustainable release
pipeline must compile the upstream pinned source again as in PR #167 or the
original `SuperTux/supertux/.github/workflows/wasm.yml`; it must never
download assets when the installed game runs offline.

## Required acceptance before marking production-ready
1. Original C++ WASM game renders its main menu/first frame in a real browser,
   then enter a **real first level** and move Tux using only touch controls.
2. Confirm complete maps, artwork and music, pause/resume, progression,
   save/restore and no external fetches in Airplane Mode.
3. Install the APK on a **physical Android phone**; test touch,
   landscape, WebGL compatibility and performance. iOS separately.
4. Review GPL combined-program obligations, complete corresponding original
   source, modifications, and asset-level notices before distributing NAQLA.

Passing a build or packaging test does not, by itself, demonstrate playable
levels. Keep this branch as a draft PR until actual engine/gameplay evidence
is obtained.
