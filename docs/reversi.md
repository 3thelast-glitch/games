# Reversi

Board Arena implements standard two-player Reversi on an 8×8 board.

## Rules implemented

- Black moves first from the standard four-disc centre opening.
- A move is legal only on an empty square that brackets at least one opposing disc.
- Captures are resolved independently in all eight straight directions.
- Every bracketed opposing disc flips during the move.
- Passing is automatic and only occurs when the next player has no legal move.
- The game ends when the board is full or neither player has a legal move.
- The player with the most discs wins; equal disc counts are a draw.

## Board Arena integration

Reversi is available in local play, AI play, online matchmaking, private rooms and ranked play through the same game-plugin and authoritative server architecture used by the other Board Arena games.

The board keeps fixed LTR coordinates while surrounding interface text supports English and Arabic/RTL. Legal squares are highlighted, the last move is marked, flipped discs animate unless reduced motion is enabled, and the score is shown above the board.

Regression coverage includes rules, malformed moves, all eight capture directions, forced passes, terminal scoring, AI legality, server-authoritative online play, UI interaction, responsive geometry, touch targets and RTL rendering.
