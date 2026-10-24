# NAQLA — original games, local-only/offline edition

## Product requirement

NAQLA must embed **complete original game engines and assets**, not
replicas, screenshots, iframes pointing to external game websites, or a
launcher that requires an upstream server. The intended experience is:
install one NAQLA APK, disconnect Wi-Fi and mobile data, open a game, play
single-player against its local AI (if available), save locally, close/reopen,
and return to the NAQLA library. No account, remote authentication, external
game CDN or online matchmaking is acceptable for these games.

There are two separate deliverables:
1. **Original source**: the pinned recursive upstream checkouts. Git
   submodules at `native/community` refer to the full original game
   repositories; they are *not* copied source files until recursively cloned.
   The offline build also checks out an original-engine-derived TeaVM port for
   Mindustry. GPL/AGPL full corresponding source must accompany redistribution.
2. **Installed gameplay runtime**: the compiled code, levels, audio, art,
   content, local input and local storage actually bundled inside NAQLA's
   APK assets. A source checkout or a tile alone is not a playable game.

## Build the two local-engine candidates

GitHub Actions: `.github/workflows/community-offline-complete.yml`

This three-job preview builds source engines in parallel, then produces a
single **NAQLA-2-ORIGINAL-GAMES-OFFLINE-ANDROID-TEST** debug APK and a local
web files artifact. The workflow is not a normal release:

| Game | Source and content | Packaging | Current limit |
| --- | --- | --- | --- |
| SuperTux | SuperTux/supertux at `c837f4f5d8b5945e22df1e36ab8f05801cf08f9c`, recursively checked out; original `data/` maps, textures, sound and music are included in `supertux2.data` by upstream CMake/Emscripten | `scripts/package-supertux-web.mjs` → original JS/WASM/data, entry HTML, original GPL license and an explicit offline runtime manifest | WebAssembly input / save / touch / audio and full gameplay not device verified; upstream WASM failures have occurred in releases |
| Mindustry | Original Mindustry and Arc code from the pinned `khoichon/mindustry-web@33652d79b21498d2cbd0d7f38cab46aa3a8fe183` recursive tree, original Mindustry v159.7 resources from the SHA256-pinned official JAR | TeaVM `buildWeb` → original-derived JS, sprites/maps/audio/asset-manifest and GPL licenses, installed by `scripts/package-mindustry-web.mjs` | Upstream experimental port: some mods, minimap, saves and browser compatibility may be incomplete; actual mobile gameplay not proved |

Build-time Internet fetching of the exact upstream source and resources is
**not** runtime Internet use. The finished debug APK embeds files locally at
`android/app/src/main/assets/public/third-party/…` and leaves
`VITE_SERVER_URL` empty. The game's runtime manifests require
`offline: true` and `requiresRemoteServer: false`. If a complete game
runtime was not built, NAQLA must **not** offer a working Play button.

The website on a *remote host* necessarily needs Internet to load initially.
The offline web archive can instead be hosted on your computer via a local
server with no external network access. Browser PWA offline caching is a
separate acceptance item. Do not claim that merely visiting a remote webpage
once produces a guaranteed self-contained offline installation.

## Why the third game is not a static offline port yet

**Freeciv-web is not currently a fully offline game under the NAQLA UI.**
Its original UI is JavaScript/Java/JSP; crucial AI, rules, maps, turns and
game processing run in the separate Freeciv **C** server. The original web
stack uses Tomcat, nginx, Python WebSocket proxy and a process launcher. Even
its single-player mode needs that server. Simply copying HTML or using
mock standalone demos would be a fake game, not the full original rules and
AI. That is explicitly rejected.

The original source is pinned in `native/community/freeciv-web`. To meet
NAQLA's single installed, **truly offline Android** requirement, the full
Freeciv C engine needs a documented, tested in-process native Android bridge,
or a validated WASM port with its local protocol and state persistence.
Only then can the full Freeciv-web presentation, all rules and AI, maps and
save files be bundled. An always-on public server, external URL, account or
link to another app is forbidden. The existing hosted-client configuration is
intentionally not used by the offline launcher.

## Acceptance — do not merge as "3 games playable" without this

- Game boots from its own embedded engine and graphics assets with phone
  in Airplane mode on Android (and later separately test iOS).
- Controls work by touch, and gameplay actually progresses with original
  game rules/AI; background/resume/exit can restore the NAQLA library.
- Levels/maps/audio/textures fully load with zero external requests.
- Save, close and restore on a second launch with device storage retained.
- No hidden startup requests to Google fonts, upstream CDNs, login, rooms
  or public game servers. Use explicit network-blocking end-to-end tests.
- Check memory, FPS, orientation and control placement on small Android
  phones, and verify no regression of existing 20 NAQLA games.
- Verify exact code and asset licenses; make complete corresponding source,
  modifications, build scripts, attributions and required GPL/AGPL notices
  available before distribution.

No genuine on-device end-to-end test of these two games has yet succeeded in
this document; green CI **only proves compilation and packaging**.
