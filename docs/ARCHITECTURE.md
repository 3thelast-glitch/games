# Architecture

## Boundaries

Board Arena is a TypeScript monorepo with one root lockfile. The React/Capacitor app and Node server both import the same pure rules. A rules engine owns a serializable immutable state and a move parser, validator, reducer, legal-move generator and evaluator. UI components only choose moves and render state.

`RulesEngine<S, M>` provides strong types inside each game. `asPlugin` is the explicit type-erasure boundary used by the registry and generic controllers. Untrusted move input is parsed again at that boundary. `GamePlugin.winReason` is a translation key supplied by the game. Game-specific victory conditions do not require a change to core networking types.

| Layer              | Owns                                                        | Does not own                             |
| ------------------ | ----------------------------------------------------------- | ---------------------------------------- |
| Game engine        | Board geometry, valid moves, winner, evaluation             | Sessions, clocks, sockets, React         |
| Offline controller | Local clock, history, undo and termination                  | Elo or trusted online results            |
| Match service      | Seats, revisions, server clock, grace, termination, rematch | Rendering or AI decisions                |
| Store              | Accounts, sessions, matches, ratings, atomic settlement     | Client-submitted result updates          |
| Network adapter    | Auth frames, reconnect, outbox, snapshots                   | Validating moves on behalf of the server |
| Game view          | Selection, previews, animation and accessibility            | Authoritative state mutation             |

<<<<<<< HEAD
The current contract supports two-player, alternating-turn, perfect-information games. Chess, checkers, Connect Four, Reversi, Nine Men's Morris, Gomoku and Mancala fit this starting point. Hidden-information or simultaneous-turn games would need a new state projection or turn model.
=======
The current contract supports two-player, perfect-information games. A command may retain the current player while a compulsory capture sequence is in progress; each command increments `ply` for replay and AI-worker identity. Chess, checkers, Connect Four, Reversi, Nine Men's Morris, Gomoku and Mancala fit this starting point. Hidden-information or simultaneous-turn games would need a new state projection or turn model.
>>>>>>> 86095ba4b22459c5703fc305861ae0c76432fe97

## Game details

Abalone uses axial hex coordinates with radius four. A move selects 1–3 own marbles and one of six axial direction vectors. Validation checks a unique contiguous straight selection, distinguishes inline from broadside movement, checks destinations and walks an opponent chain. A push requires strict numerical superiority. A legal reduction produces a fresh board and motion records with stable marble identities for animation.

Quoridor uses fixed row/column coordinates. Walls are anchors between squares and block two bidirectional edges. Move generation inspects adjacency and walls before allowing straight jumps or the permitted side jumps. Before accepting a wall, a breadth-first search must find a path from each pawn to its target row. That search ignores temporary pawn occupancy, since the pawn does not permanently close a route. A WeakMap adjacency cache is safe because accepted states are immutable.

<<<<<<< HEAD
=======
### Additional games and terminal draws

Checkers uses a 64-cell board with owner/king pieces and a `forcedFrom` continuation. Every submitted jump is validated; a capture chain retains the current player and clock, and promotion ends the turn. Repetition positions are recorded only after complete turns. Captures and uncrowned movement reset the no-progress/repetition history.

Gomoku and Connect Four share direction-aware line detection and a window evaluator. Gomoku keeps all 225 intersections legal and uses freestyle five-or-more wins. Connect Four resolves a submitted column to its lowest empty slot. Their views highlight winning lines; Gomoku previews a placement before confirmation.

Nine Men’s Morris owns an explicit 24-point graph and 16 mill lines. `remaining` tracks reserves; `capturing` keeps the turn with the mill maker until a legal opponent piece is removed. Reserves count toward survival. Flying applies only after placement, with exactly three pieces. Repetition keys include side to move and reserves, and captures reset the history.

`BaseState.drawReason` is an optional, server-owned terminal translation key, separate from `winner`. It is absent from legacy snapshots. The offline and online controllers settle these draws, and the AI stops on them and scores them as zero. Clients still cannot supply results. Draw snapshots and multi-command turns use the existing persistence and revision protocol.

>>>>>>> 86095ba4b22459c5703fc305861ae0c76432fe97
## AI

`packages/core/src/ai.ts` accepts any registered game. Easy samples legal moves. Medium evaluates the one-ply outcomes. Hard performs iterative deepening through depth three with alpha-beta pruning, ordered root candidates and a limited candidate set. The hard search has a nominal 1.4-second budget; move generation/evaluation may run between time checks. This is a replaceable baseline, not a claim of expert playing strength.

`apps/mobile/src/ai.worker.ts` isolates computation from rendering. Request IDs, match IDs and ply checks prevent stale worker responses from applying after a restart or game switch. The worker is terminated on cleanup and has a separate 15-second fail-safe.

## Online command flow

1. Authenticate the WebSocket using a bearer token in the first frame. Resolve the user's server-side identity; clients do not choose a seat.
2. Join a queue or room. The lobby checks eligibility and creates an authoritative match with randomized seats.
3. Submit `{type, matchId, commandId, expectedRevision, move}`. Strict schemas reject injected authority fields.
4. Resolve match membership, check the command fingerprint, apply expired clock/grace deadlines, and check revision and current turn.
5. Parse and apply the move through the registered game engine. Illegal moves leave the position and clock anchor unchanged.
6. Charge the moving player's server clock, advance the revision, and persist state plus the recent command record. A finished result and Elo settlement are written atomically.
7. Broadcast the authoritative snapshot and acknowledgement to both players. The client removes the acknowledged command from its persisted outbox.

Replaying an identical command is idempotent. Reusing its identifier with different content is rejected. The stored command history is bounded; sufficiently old replays still fail their revision check. An outdated client receives a fresh snapshot. There is no online undo or client endpoint for writing clocks, ratings or results.

## Disconnect and recovery

The server sends WebSocket heartbeat pings every 15 seconds. The client also sends application pings, detects silent connections and retries with exponential backoff and jitter. On reconnect it authenticates, resumes its last match and replays pending commands. Stale callbacks from replaced sockets are ignored.

The default match clock is ten minutes per player and the default reconnect grace is 60 seconds. Both are server-configurable. Clocks continue during disconnects and server downtime; the earliest clock/grace deadline decides the result. Simultaneous expired disconnect deadlines abandon a match without changing Elo. Completed results cannot be overwritten.

SQLite retains sessions, match snapshots, command history, results and ratings. After restart, active matches are marked disconnected while retaining existing earlier disconnect deadlines. Reconnecting players receive the persisted board and current server clock. Waiting rooms and matchmaking queues are in memory and must be recreated after connection loss or restart.

## Accounts, ranking and profiles

Email passwords use salted asynchronous scrypt. Session tokens are random, expire after 30 days and are stored hashed on the server. Google and Apple identities are bound to verified issuer/subject claims, not automatically linked by email. OAuth uses state/nonce checks and a one-time exchange code bound to a client verifier; provider-specific setup is described in the deployment guide.

Ratings start at 1000, use Elo with K=32 and are separate per game. Global/friends boards use current rating; weekly/monthly boards use net gains during the current UTC period, with weeks starting Monday. A unique match/user result key prevents duplicate settlement. Rank thresholds are Bronze below 1000, Silver 1000–1199, Gold 1200–1399, Platinum 1400–1599, Diamond 1600–1799 and Master from 1800.

Profile totals use server-recorded online matches, including casual matches. Local/AI history stays on the device and does not affect online stats or rankings. Level is `1 + floor((matches × 30 + wins × 50) / 500)`. Friends are a private one-way list added by friend code; there is no invitation or chat system.

## Add a game

1. Create `packages/games/<id>/state.ts` and `rules.ts`. Implement the `RulesEngine` contract and keep state JSON-serializable and reducers immutable.
2. Register the engine via `asPlugin` in `packages/games/registry.ts`. The server, room service, ranking store and generic AI then resolve it by ID.
3. Add headless rule fixtures, malformed-move tests, win conditions and seeded legal playouts under `tests`. Add an AI evaluator or replace the game's AI strategy if needed.
4. Implement its board component, then register its view, card metadata and resource counters in `apps/mobile/src/gameViews.tsx`. Supply artwork in the game-card composition layer.
5. Add English/Arabic names, rules, victory reason and interaction labels in `i18n.tsx`. Verify visual direction, keyboard control and touch input.

These are game modules and composition-root changes. Authentication, transport, match recovery, profiles and rating tables need no game-specific branches. The shared controller, AI and multiplayer adapter are deliberately reused rather than copied into each game folder.

## Deployment scope

This version assumes a **single server process** and a persistent local SQLite volume. Match ownership and lobbies are in-process. Multiple server replicas require shared matchmaking/presence, routed match ownership or locking, and an appropriate transactional persistence design. Do not run the current service as a multi-worker cluster.
