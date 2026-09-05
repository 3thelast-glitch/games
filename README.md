# Board Arena

<<<<<<< HEAD
A modular, bilingual strategy game platform for the web, Android and iOS. Version **0.1.0** is a functional initial implementation with Abalone and Quoridor, local play, three AI levels, and a separate authoritative multiplayer server.
=======
A modular, bilingual strategy game platform for the web, Android and iOS. Version **0.1.0** is a functional initial implementation with six games: Abalone, Quoridor, Checkers, Gomoku, Nine Men’s Morris and Connect Four, plus local play, three AI levels, and a separate authoritative multiplayer server.
>>>>>>> 86095ba4b22459c5703fc305861ae0c76432fe97

[دليل التشغيل بالعربية](README.ar.md) · [Architecture](docs/ARCHITECTURE.md) · [Deployment](docs/DEPLOYMENT.md) · [Delivery status](docs/STATUS.md)

## Run locally

Use **Node.js 24 or newer** and npm. The server uses Node's built-in SQLite module. No database service or account provider is needed for local development.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. Vite forwards `/api` and `/ws` to the server on port 8787. Local two-player and AI modes do not require login. For online testing, open a second browser profile or private window so the two players have separate sessions.

```sh
npm test
npm run build
npm start
```

<<<<<<< HEAD
The built server serves the app and API at `http://localhost:8787`. `GET /api/health` reports the registered games and protocol version. The initial delivery passes **107 automated tests** covering rules, AI legality, authority, recovery, accounts, client networking and component interactions.
=======
The built server serves the app and API at `http://localhost:8787`. `GET /api/health` reports the registered games and protocol version. The current implementation passes **158 automated tests** covering rules, AI legality, authority, recovery, accounts, client networking and component interactions.
>>>>>>> 86095ba4b22459c5703fc305861ae0c76432fe97

## Included

- Original dark interface, large illustrated game cards, responsive navigation, Arabic/English and RTL/LTR layouts. Physical board coordinates stay fixed in both languages.
- Abalone: 61-cell hex board, 14 marbles each, contiguous groups of 1–3, six directions, inline and sidestep moves, strict Sumito strength checks, edge ejection and six-capture victory.
- Quoridor: 9×9 board, ten walls each, legal pawn jumps and conditional diagonal jumps, two-edge walls, collision checks, and breadth-first path validation for both players on every attempted wall placement. Wall previews require confirmation.
<<<<<<< HEAD
- Local two-player, AI, quick match and private rooms for both games. Ranked quick matches require a registered account; guests can play casual online matches.
=======
- Checkers (English/American 8×8): forced captures, complete multi-jump turns, king promotion ending the turn, backward king moves, capture/blockade wins, threefold repetition and 40-turn-per-player no-progress draws.
- Gomoku (freestyle 15×15): preview/confirm placement, five-or-more in all four directions, unrestricted openings and full-board draws.
- Nine Men’s Morris: nine-piece placement, adjacent movement, flying at three pieces, mills and protected captures, re-forming mills, blocked/two-piece losses and automatic threefold repetition.
- Connect Four (7×6): gravity, full-column rejection, four-in-a-row in all directions, winning highlights and full-board draws.
- Local two-player, AI, quick match and private rooms for all six games. Ranked quick matches require a registered account; guests can play casual online matches.
>>>>>>> 86095ba4b22459c5703fc305861ae0c76432fe97
- Easy random legal play, medium positional evaluation and hard bounded alpha-beta search, running outside the UI thread.
- Optional guest/email accounts, provider adapters for Google and Apple, editable profiles, avatar choices, favorites, match history and friend codes.
- Per-game Elo, six ranks, global/friends standings and UTC weekly/monthly net-rating-gain standings. Statistics come from actual matches.
- Match clocks, turn/piece/wall indicators, local-only undo, restart, resignation, mutual draw offers, emotes, rematch and result animations. Sound, haptics and reduced motion are configurable.
- WebSocket authentication, heartbeat, reconnect, grace periods, persisted recovery, revision checks and duplicate-command protection. The server validates all online moves and computes clocks/results/ratings.
- Capacitor configuration and generation scripts for Android/iOS, Docker deployment files and GitHub Actions for validation and Android debug builds.

## Project map

<<<<<<< HEAD
| Path                         | Responsibility                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/core/src`          | Game interfaces, generic AI, offline controller, wire protocol and rating policy         |
| `packages/games/abalone`     | Abalone state, pure rules, AI entry point and board UI                                   |
| `packages/games/quoridor`    | Quoridor state, pure rules, AI entry point and board UI                                  |
| `packages/games/registry.ts` | Register available rules engines                                                         |
| `apps/server/src`            | Authentication, SQLite persistence, authoritative matches and matchmaking                |
| `apps/mobile/src`            | React application, localization, game view registry, worker, network and native adapters |
| `tests`                      | Headless rules, server, client-network and component tests                               |
| `scripts`                    | Development runner, test discovery and repeatable native project setup                   |
| `docs`                       | Architecture, deployment and verification/remaining work                                 |
=======
| Path                                                                    | Responsibility                                                                           |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/core/src`                                                     | Game interfaces, generic AI, offline controller, wire protocol and rating policy         |
| `packages/games/abalone`                                                | Abalone state, pure rules, AI entry point and board UI                                   |
| `packages/games/quoridor`                                               | Quoridor state, pure rules, AI entry point and board UI                                  |
| `packages/games/checkers`, `gomoku`, `nine-mens-morris`, `connect-four` | New independent state/rules/AI/UI modules                                                |
| `packages/games/shared`                                                 | Line evaluation, win detection and shared board primitives                               |
| `packages/games/registry.ts`                                            | Register available rules engines                                                         |
| `apps/server/src`                                                       | Authentication, SQLite persistence, authoritative matches and matchmaking                |
| `apps/mobile/src`                                                       | React application, localization, game view registry, worker, network and native adapters |
| `tests`                                                                 | Headless rules, server, client-network and component tests                               |
| `scripts`                                                               | Development runner, test discovery and repeatable native project setup                   |
| `docs`                                                                  | Architecture, deployment and verification/remaining work                                 |
>>>>>>> 86095ba4b22459c5703fc305861ae0c76432fe97

Game rules have no React, DOM, native SDK, network or database dependencies. Shared controllers and the multiplayer adapter operate on game interfaces rather than duplicate implementations inside each game folder.

## Android and iOS

```sh
npm run mobile:android
npx cap open android
```

```sh
npm run mobile:ios
npx cap open ios
```

The scripts create native projects if absent, build the web assets, synchronize plugins, and configure OAuth deep links. Native projects are generated and ignored by Git; keep durable customizations in `scripts/mobile.mjs` and `capacitor.config.ts`. Change that policy before maintaining native source manually.

Set `VITE_SERVER_URL` to your deployed **HTTPS** server origin before building a native app for online play. Without it, the packaged app provides local and AI play. Native project synchronization has succeeded in this workspace; an APK/IPA has **not** been compiled. See [deployment instructions](docs/DEPLOYMENT.md) for SDKs and the supplied Android workflow.

## Delivery boundaries

<<<<<<< HEAD
This is source code and a locally verified build, not a deployed production service. Google/Apple need your credentials and provider configuration. Public hosting, domain/TLS, native signing, device testing and store submission remain external setup steps. Email verification, password recovery, background push notifications, account deletion and multi-server scaling are not implemented. LAN and the seven additional games are explicitly shown as planned.

Read [delivery status](docs/STATUS.md) for tested behavior and open release checks before public launch. No repository has been chosen for this project, and no changes have been pushed to the unrelated connected repository.
=======
This is source code and a locally verified build, not a deployed production service. Google/Apple need your credentials and provider configuration. Public hosting, domain/TLS, native signing, device testing and store submission remain external setup steps. Email verification, password recovery, background push notifications, account deletion and multi-server scaling are not implemented. LAN, Chess, Reversi and Mancala are explicitly shown as planned.

Read [delivery status](docs/STATUS.md) for tested behavior and open release checks before public launch. Source repository: [3thelast-glitch/games](https://github.com/3thelast-glitch/games).
>>>>>>> 86095ba4b22459c5703fc305861ae0c76432fe97

## Rule and platform references

Rules were checked against the [Abalone rulebook](https://www.gokids.com.tw/tsaiss/gokids/rules/AB02ENN_RULES_2019.pdf) and [Gigamic's Quoridor rules](https://en.gigamic.com/index.php?controller=attachment&id_attachment=467). Board art, interface elements and synthesized sounds are original project assets. See [Capacitor setup](https://capacitorjs.com/docs/getting-started) for the native wrapper.
<<<<<<< HEAD
=======

Additional rule references: [WCDF English Checkers rules](https://nccheckers.org/NCCA/WCDF%20Checker%20-%20Draughts%20-%20English%20Rules.htm), [Berkeley GamesCrafters Nine Men’s Morris](https://gamescrafters.berkeley.edu/games.php?game=ninemensmorris), [Gomoku variants](https://en.wikipedia.org/wiki/Gomoku), and [Hasbro Connect Four](https://instructions.hasbro.com/en-us/instruction/connect-4-game-folio-edition). Repetition and no-progress draws are adjudicated automatically in this app; the Checkers tournament procedure normally involves a claim. Morris uses the flying variant and automatic threefold repetition. Gomoku uses freestyle (overlines win), not Renju or tournament Swap2.
>>>>>>> 86095ba4b22459c5703fc305861ae0c76432fe97
