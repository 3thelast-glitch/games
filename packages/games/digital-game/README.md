# Digital Game

`digitalGame` is Board Arena's tile-based number strategy module. The implementation is intentionally isolated from React so the rules can be validated authoritatively by the server and reused by local play, AI and tests.

## Implemented rules

- 106 unique tiles: numbers 1–13 in four colors, two copies of every number/color pair, plus two Jokers.
- Deterministic seeded shuffle on the authoritative state and 14 tiles dealt to each seat.
- Groups: 3–4 equal-number tiles with unique colors.
- Runs: 3+ consecutive tiles of one color; 1 is low only and never follows 13.
- Joker resolution in groups and runs. A Joker removed from a public meld must still be assigned to a legal public meld before commit.
- Initial meld: 30+ points using rack tiles only. Existing public table tiles stay locked until that player completes the requirement.
- Full table reconstruction after the initial meld. A commit validates every meld on the resulting table, not only the meld being edited.
- Draw exactly one tile and end the turn.
- Empty-rack win, rack-value scoring and 30-point Joker penalty.
- Empty draw pool continues play until both seats pass; the lowest rack penalty wins the blocked round.
- Transactional client editing: the UI keeps a working table/rack until Commit Turn; Reset Turn restores the authoritative turn-start state.

## Architecture

- `state.ts` — tile/state types, deterministic tile construction/shuffle and setup.
- `rules.ts` — pure validation, move application, scoring, AI move enumeration and online state projection.
- `ai.ts` — adapter to the shared Board Arena AI chooser.
- `ui.tsx` — mobile-friendly transactional table/rack editor.
- `ui.css` — isolated responsive styling bundled by the mobile entrypoint.
- `tests/digital-game.test.ts` — rules, Joker, table-reconstruction, scoring and hidden-information coverage.

## Authoritative multiplayer and privacy

The client sends tile IDs and the complete intended public table. The shared server applies the registered game engine, so clients do not control tile values, colors, ownership, draw results, scores or turn identity.

For online snapshots, `projectDigitalState()` exposes only:

- the viewer's own rack IDs and tile definitions,
- public table tile IDs and definitions,
- opponent rack count,
- draw-pool count.

Opponent rack IDs/properties, draw order and the deterministic shuffle seed are redacted. The existing match revision/command-id protocol provides stale-action rejection and duplicate-command idempotency.

## Current host-platform boundary

Board Arena's shared `Player`, match snapshot, clocks, lobby and rating protocol are currently two-seat structures. This module therefore integrates safely with the existing two-player local/AI/online flows without rewriting unrelated games. Expanding the platform to 3–4 seats requires a separate core protocol migration covering every game, lobby, reconnect path, clock tuple and persisted match schema.

Likewise, the shared match clock is currently platform-owned rather than a per-game configurable 30/45/60/90-second turn timer. The rules engine is kept independent so a future settings/state-machine layer can add those presets without rewriting meld validation.
