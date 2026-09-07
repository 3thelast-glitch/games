# Reversi architecture

Reversi follows Board Arena's existing plugin boundary:

- `state.ts` owns the serializable game state and standard opening.
- `rules.ts` owns parsing, validation, capture detection, move application, forced-pass handling, terminal scoring and evaluation.
- `ai.ts` delegates to the shared bounded AI search.
- `ui.tsx` renders the board and emits move intents only; it does not own rules.
- `packages/games/registry.ts` exposes the engine to local, AI and server modes.
- The server remains authoritative for online matches through the existing generic match service.

No Reversi-specific authority is trusted from the client. Online clients submit only move coordinates, which are parsed and applied by the registered rules engine on the server.
