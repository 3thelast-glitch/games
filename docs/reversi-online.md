# Reversi online behavior

Online Reversi uses the generic authoritative match service. The client sends only `{ row, col }` move intents with the match command metadata; the server resolves the authenticated seat, validates the move with the Reversi engine, advances the canonical revision and broadcasts the resulting match snapshot. Ranked ratings and match history therefore use the same settlement path as other Board Arena games.
