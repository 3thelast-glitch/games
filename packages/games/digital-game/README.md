# Digital Game — Rummikub Classic ruleset

Digital Game implements the Board Arena Rummikub Classic ruleset for 2–4 players.

## Tile set and deal

- 106 physical tiles: two copies of values 1–13 in four colors, plus two Jokers.
- Each player receives 14 tiles.
- Before the real deal, seats draw temporary numbered tiles to choose the starting player; the highest value starts. Jokers are redrawn and tied highest seats redraw until one remains.
- The temporary setup draw is returned before the complete set is shuffled and dealt.

## Melds

- A group contains 3–4 tiles of the same value in distinct colors.
- A run contains at least 3 consecutive values of one color.
- Value 1 is low only; there is no 13→1 wraparound.
- Jokers may substitute inside valid groups and runs.

## Initial meld

- A player who has not yet opened must place at least 30 points using tiles from that player's own rack.
- Existing table tiles cannot be manipulated or counted toward that initial 30-point requirement.

## Table manipulation and Jokers

After completing the initial meld, a player may rearrange the table as long as the final committed table is entirely legal and every physical table tile remains present.

- A Joker retrieved from an existing table set must be reused on the table during the same turn.
- Joker manipulation is unavailable before the acting player completes the initial meld.
- A Joker-retrieval turn must play at least one tile from the acting player's rack.
- A retrieved Joker must participate in a newly formed legal set; it cannot merely extend an otherwise unchanged existing set.
- Replacement material may come from the rack or from another table set when the final whole-table arrangement remains legal.

## Drawing and passing

- If the player cannot or chooses not to make a legal play while the pool has tiles, drawing exactly one tile ends the turn.
- When the pool is empty, the explicit `pass` action advances the turn without changing racks.
- A legacy empty-pool `draw` command is temporarily accepted as a compatibility alias for `pass`.
- A blocked round is not decided merely by one pass cycle: the Classic solver must establish that no player can make a legal play before blocked scoring is finalized.

## Fixed 60-second turn and incomplete-manipulation penalty

Every Digital Classic turn is exactly 60 seconds in local, AI, quick-match, and private-room play. Legacy 30/45/90 client timer requests are normalized to 60 seconds by the runtime.

Table/rack manipulation in the UI is transactional: `workingTable` and `workingRack` remain a local draft until Commit. The authoritative game state therefore always contains the last complete legal table.

- Starting an actual table manipulation marks the current turn as having an unfinished draft without advancing `ply`, changing the turn, incrementing the online revision, or restarting the 60-second deadline.
- Resetting the draft back to the authoritative table clears that marker and also does not restart the timer.
- If 60 seconds expire with no unfinished table manipulation, the existing normal timeout consequence applies: draw one tile when available, then advance the turn; with an empty pool, advance like a pass.
- If 60 seconds expire while table manipulation is unfinished, the entire draft is discarded and the table/rack return to the last authoritative snapshot first. The timed-out player then draws three penalty tiles when at least three remain in the pool.
- If only one or two tiles remain, the player draws every remaining tile; no synthetic tiles are created.
- If the pool is empty, rollback is still complete and the timeout advances like a pass without changing any rack or table tile.
- The timeout advances `ply`/revision once and late commands from the pre-timeout revision are rejected as stale.

## Scoring

- Emptying the rack after a legal commit wins the round.
- Rack penalty uses face value; a Joker is worth 30 penalty points.
- In a blocked round, the player with the lowest rack penalty wins when there is a unique lowest rack.
- Blocked scoring is relative to the winning rack penalty; a tie for the lowest penalty is recorded as a blocked-round draw.

## Hidden information and multiplayer

- Online projections expose the viewer's own rack, public table, and public rack counts only.
- Opponent rack identities, authoritative draw order, and shuffle seed remain hidden.
- Digital Game supports 2, 3, and 4 seats for local/private/online play. AI remains a two-player mode.
- Server-side rules, turn ownership, revision checks, timeout transitions, and scoring remain authoritative.