# Reversi verification checklist

The automated suite is expected to verify the following before Reversi is merged:

- Exact standard 8×8 opening with Black to move.
- Four legal Black opening moves.
- Horizontal, vertical and diagonal captures in all eight directions.
- Multi-direction captures in one move.
- Rejection of occupied, non-capturing, out-of-range and malformed moves.
- State immutability and deterministic results.
- Automatic forced pass when the next player has no legal move.
- End-of-game detection on a full board or no legal moves for either player.
- Black win, White win and exact draw scoring.
- Legal AI moves at easy, medium and hard difficulties.
- Authoritative server execution in online/private/ranked flows.
- English and Arabic UI strings and fixed LTR board coordinates under RTL layout.
- 64 rendered cells, highlighted legal targets and flip feedback.
- Responsive square geometry, touch reachability and no global horizontal overflow.
