# NAQLA Phase 2 — LAN and Online delivery

## LAN pilot: Reversi (native Android/iOS)

This release connects the existing host-authoritative Reversi LAN transport to a user-facing mode. It does **not** claim LAN support for every game or a physical-device test.

1. Build and install the generated Android or iOS application on **two real devices**; web browsers cannot access the native LAN plugin.
2. Connect both devices to the same Wi-Fi network and grant OS local-network / discovery permissions.
3. Open **Reversi → LAN** on the host and select **Host room**. Note the host address (host:8765) and Room ID.
4. On the guest open **Reversi → LAN → Find rooms**. Select the advertised room. If discovery fails, use **Join by address**, entering the host address and Room ID from the host display.
5. Both players confirm readiness. Play valid moves, verify that the host rejects out-of-turn/duplicate moves, and test resign/rematch.
6. Disable/re-enable guest Wi-Fi briefly during a game: it should reconnect to the same seat and board state within the 60-second grace period. Check long disconnection interruption.
7. Verify seat/clock/result synchronization with 15-second turn clocks and the default 10-minute bank, in both languages, at 320px and large displays.
8. Verify Android ↔ Android, iOS ↔ iOS and Android ↔ iOS physical-network interoperability; phone hotspots and client isolation may block discovery.

LAN traffic uses TCP and **is not encrypted**. Use only trusted local networks; no passwords or account tokens are transmitted via LAN. The host owns the game engine. LAN scores do not alter Online Elo.

## Online production checklist

The code already provides account authentication, private rooms, quick-match, server-authoritative moves, authenticated WebSocket reconnect, clocks and match recovery. Native clients MUST be built against a deployed HTTPS origin. With no `VITE_SERVER_URL`, the native app now explicitly rejects Online selection rather than incorrectly using its local WebView origin.

Production owner actions (not performed here):
- Provision a persistent Node 24+ host with SQLite durable storage, backups and a TLS domain; configure `DATABASE_PATH`, `ALLOWED_ORIGINS`, `PUBLIC_SERVER_URL`, `APP_URL` and other server environment values. Use a reverse proxy that forwards `/ws` WebSocket upgrades.
- Rebuild Android/iOS with `VITE_SERVER_URL=https://your-real-server` (not a placeholder, not HTTP).
- Test two phones on **different Internet networks** using distinct accounts. Run quick-match, private room, move validation, app background, airplane mode, reconnect, timeout, rematch and Elo settlement.
- Monitor server CPU, memory, active sockets and database durability; implement trusted proxy client-address handling and per-user abuse safeguards before unbounded public use.
- Use separate staging and production backends; do not point the shipped client at a developer PC or `localhost`.

Automated unit/UI validations and native binaries from GitHub Actions are development evidence. They are **not** equivalent to physical-network QA, production TLS validation or app-store release certification.

## Future LAN expansion

Reversi is the pilot. Extending LAN to Chess, Checkers, Gomoku, Connect Four, etc. requires versioned game-specific move parsing, authoritative state projection, clock rules and regression tests per game. Dominoes, Digital Game and Naval Battle need per-seat secret-state projections before LAN support can be advertised; broadcasting the full host state would reveal hidden information. Do not simply swap game IDs in the existing Reversi-only LAN authority.
