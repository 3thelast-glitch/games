# NAQLA Online — Render Deployment & Acceptance

**Status:** Configuration and smoke test are prepared. This is not proof of a live deployed server or real two-network play.

## 1. Review billing and create the service

The repository's render.yaml defines one **paid Starter Docker service** and a **paid 5 GB persistent disk** at /app/data. Review/approve Render billing before applying the Blueprint. A free web service is unsuitable for the current SQLite database because the filesystem is ephemeral. Keep **one instance** of the SQLite-backed server.

1. Connect GitHub repository 3thelast-glitch/games in Render, create a Blueprint using render.yaml on main and review the costs before applying.
2. Enter the **actual** Render HTTPS origin for PUBLIC_SERVER_URL and APP_URL, e.g. https://YOUR-ACTUAL-HOST.onrender.com (replace this example).
3. Enter ALLOWED_ORIGINS as the actual web origin plus required native origins: https://YOUR-ACTUAL-HOST.onrender.com,https://localhost,capacitor://localhost. No wildcard or trailing slash.
4. Manually deploy the reviewed main branch. The Blueprint deliberately disables automatic deployments.
5. Verify disk attachment and write permissions; the server uses /app/data/board-arena.db and serves internally on 0.0.0.0:8787. Render terminates HTTPS/WSS at the public origin, including the /ws WebSocket route.
6. Verify /api/health returns JSON with ok=true, then test actual account persistence across a server restart.
7. Set up encrypted/offsite database backups, restore drills, monitoring, disk-space alerts, rate-limit/abuse safeguards and maintenance operations (see OPERATIONS_PHASE6.md). An attached disk is not a backup.

## 2. Test the actual public HTTPS/WSS endpoint

Run Node 24+ with dependencies installed (npm ci).

**Read-only** endpoint probe: checks TLS, GET /api/health, protocol v3 and WSS upgrade with an allowed Origin.

    node scripts/online-smoke.mjs --url https://YOUR-ACTUAL-STAGING-HOST

**Staging ONLY** destructive-data / persistent-write smoke test: deliberately creates four guest accounts and two matches.

    node scripts/online-smoke.mjs --url https://YOUR-ACTUAL-STAGING-HOST --mutating

The mutating probe checks distinct identities, authentication over WSS, a private-room code and join, rejection of an out-of-turn move, valid synchronized moves, reconnect/resume and two-player casual Quick Match. **Do not point this mutating probe at production user data.** It does not establish ranked Elo correctness or physical network quality.

The same two modes are exposed in the manually triggered GitHub Actions workflow "Online HTTPS/WSS Smoke" after the workflow file is available on main. Neither probe deploys a Render service.

## 3. Build a native Android APK with the correct endpoint

GitHub → Actions → Build Android APK → Run workflow. Set server_url to the exact deployed HTTPS origin. Once the workflow succeeds, download the new NAQLA-debug-APK and install it on the two devices.

Native clients bake VITE_SERVER_URL into the APK at build time: REST uses HTTPS, WebSocket uses WSS on /ws. An APK built without server_url still works for local/AI/LAN but **does not** have a real public Online backend. Rebuild after changing hostnames.

## 4. Mandatory physical two-network acceptance

Use TWO actual phones, TWO different user accounts, and TWO independent networks (for example device A on Wi-Fi and device B on mobile data with Wi-Fi turned off). Record both device models, OS versions, APK commit SHA, exact server URL, date and test results.

- Both authenticate with valid HTTPS/TLS and WSS without mixed-content or certificate errors.
- Private room creation/code joining works across networks; both devices see the same board and turn.
- Quick Match pairs the two independent accounts into one authoritative game with correct seats.
- Server rejects out-of-turn and illegal moves, with no remote board advance.
- Valid moves arrive exactly once and in order on both clients.
- Brief airplane-mode interruption reconnects within grace, preserving the same state.
- Exceeding grace/turn time results in a consistent timeout/forfeit without double settlement.
- Resign, rematch, end-game results and session resume work.
- Ranked mode with **two registered accounts** records exactly one Elo change/history entry and persists after restart.
- Dominoes, Digital Game and Naval Battle do not expose opponent hands/fleets in payloads or on resume.
- Arabic/English layouts and stable RTL board coordinates work on real devices.

**Go/no-go:** Do not call Online complete unless the Render service is live, its SQLite state is durable, HTTPS/WSS probes pass, and the two-device/two-network acceptance matrix has been exercised.
