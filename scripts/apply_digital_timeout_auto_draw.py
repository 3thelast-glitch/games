from pathlib import Path


def patch(path: str, old: str, new: str, count: int = 1):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise RuntimeError(f'patch target missing in {path}: {old[:160]!r}')
    p.write_text(text.replace(old, new, count), encoding='utf-8')


def write(path: str, content: str):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')


# Make timeout behavior a game-owned policy instead of hard-coding Digital Game in shared services.
patch(
    'packages/core/src/game.ts',
    "  evaluate(state: S, player: P): number;\n  /** Optional online projection used to hide private information from other seats. */",
    "  evaluate(state: S, player: P): number;\n  /** Optional move automatically applied when this game's clock expires. */\n  timeoutMove?: M;\n  /** Optional online projection used to hide private information from other seats. */",
)
patch(
    'packages/core/src/game.ts',
    "  evaluate(state: BaseState, player: Seat): number;\n  view?(state: BaseState, player: Seat): BaseState;",
    "  evaluate(state: BaseState, player: Seat): number;\n  /** Optional move automatically applied when this game's clock expires. */\n  timeoutMove?: unknown;\n  view?(state: BaseState, player: Seat): BaseState;",
)
patch(
    'packages/core/src/game.ts',
    "    legalMoves: (state) => engine.legalMoves(state as S),\n    evaluate: (state, player) => engine.evaluate(state as S, player as P),\n    view: engine.view ?",
    "    legalMoves: (state) => engine.legalMoves(state as S),\n    evaluate: (state, player) => engine.evaluate(state as S, player as P),\n    timeoutMove: engine.timeoutMove,\n    view: engine.view ?",
)

# Digital Game times out by drawing exactly one tile, which already advances the turn transactionally.
patch(
    'packages/games/digital-game/rules.ts',
    "  legalMoves: digitalLegalMoves,\n  evaluate: evaluateDigital,\n  view: projectDigitalState,",
    "  legalMoves: digitalLegalMoves,\n  evaluate: evaluateDigital,\n  timeoutMove: { type: 'draw' },\n  view: projectDigitalState,",
)

# Offline/local shared timing applies a game's timeout move at the exact deadline.
patch(
    'packages/core/src/offline.ts',
    "  createClocks,\n  remainingTimeMs,\n  type TimeControl,",
    "  createClocks,\n  timeoutAt,\n  type TimeControl,",
)
patch(
    'packages/core/src/offline.ts',
    "  private charge() {\n    const c = this.current,\n      now = this.now();\n    c.clocks = chargeClock(this.control(), c.clocks, c.state.turn, c.turnStartedAt, now);\n    c.turnStartedAt = now;\n  }",
    "  private charge(at = this.now()) {\n    const c = this.current;\n    c.clocks = chargeClock(this.control(), c.clocks, c.state.turn, c.turnStartedAt, at);\n    c.turnStartedAt = at;\n  }",
)
patch(
    'packages/core/src/offline.ts',
    "  tick() {\n    const c = this.current;\n    if (\n      !c.result &&\n      remainingTimeMs(this.control(), c.clocks, c.state.turn, c.state.turn, c.turnStartedAt, this.now()) <= 0\n    )\n      this.finish(this.bestRemaining(c.state.turn), 'timeout');\n    return this.current;\n  }\n  finish(winner: Seat | null, reason: MatchResult['reason']) {\n    if (this.current.result) return;\n    this.charge();\n    this.current = {\n      ...this.current,\n      endedAt: this.now(),",
    "  private applyTimeoutMove(at: number): boolean {\n    const automatic = this.game.timeoutMove;\n    if (automatic === undefined) return false;\n    const previousTurn = this.current.state.turn;\n    this.history.push(structuredClone(this.current));\n    this.charge(at);\n    const next = this.game.apply(this.current.state, automatic);\n    this.current = { ...this.current, state: next };\n    if (next.winner !== null) this.finish(next.winner, this.game.winReason, at);\n    else if (next.drawReason) this.finish(null, next.drawReason, at);\n    else this.current.clocks = beginTurn(this.control(), this.current.clocks, previousTurn, next.turn);\n    return true;\n  }\n  tick() {\n    const now = this.now();\n    for (let safety = 0; safety < 256 && !this.current.result; safety++) {\n      const c = this.current,\n        deadline = timeoutAt(this.control(), c.clocks, c.state.turn, c.turnStartedAt);\n      if (deadline > now) break;\n      if (this.applyTimeoutMove(deadline)) continue;\n      this.finish(this.bestRemaining(c.state.turn), 'timeout', deadline);\n      break;\n    }\n    return this.current;\n  }\n  finish(winner: Seat | null, reason: MatchResult['reason'], at = this.now()) {\n    if (this.current.result) return;\n    this.charge(at);\n    this.current = {\n      ...this.current,\n      endedAt: at,",
)

# Authoritative server applies the same game-owned timeout move, saves it, increments revision,
# clears transient draw offers, and only ends the match if that automatic move itself ends the game.
patch(
    'apps/server/src/matches.ts',
    "  expire(m: StoredMatch): StoredMatch {\n    if (m.result) return m;\n    const now = this.options.now();\n    const deadlines: { at: number; loser: Seat; reason: 'timeout' | 'disconnect' }[] = [\n      { at: timeoutAt(this.controlOf(m), m.clockMs, m.state.turn, m.turnStartedAt), loser: m.state.turn, reason: 'timeout' },\n    ];\n    for (const seat of seats(m.players.length))\n      if (m.disconnectedAt[seat] !== null)\n        deadlines.push({ at: m.disconnectedAt[seat]! + m.graceMs, loser: seat, reason: 'disconnect' });\n    deadlines.sort((a, b) => a.at - b.at);\n    const first = deadlines[0];\n    if (first.at > now) return m;\n    if (first.reason === 'timeout')\n      return this.finish(m, this.bestRemaining(m, [first.loser]), 'timeout', first.at);\n    const simultaneous = deadlines\n      .filter((deadline) => deadline.reason === 'disconnect' && deadline.at === first.at)\n      .map((deadline) => deadline.loser);\n    if (simultaneous.length === m.players.length) return this.finish(m, null, 'abandoned', first.at);\n    return this.finish(m, this.bestRemaining(m, simultaneous), 'disconnect', first.at);\n  }",
    "  private applyTimeoutMove(m: StoredMatch, at: number): StoredMatch | null {\n    const game = this.games.get(m.gameId),\n      automatic = game.timeoutMove;\n    if (automatic === undefined) return null;\n    const previousTurn = m.state.turn;\n    m.clockMs = chargeClock(this.controlOf(m), m.clockMs, previousTurn, m.turnStartedAt, at);\n    m.turnStartedAt = at;\n    const next = game.apply(m.state, automatic);\n    m.state = next;\n    m.revision++;\n    m.drawOffer = null;\n    m.drawAccepts = [];\n    if (next.winner !== null) return this.finish(m, next.winner, game.winReason, at);\n    if (next.drawReason) return this.finish(m, null, next.drawReason, at);\n    m.clockMs = beginTurn(this.controlOf(m), m.clockMs, previousTurn, next.turn);\n    this.store.saveMatch(m);\n    return m;\n  }\n  expire(m: StoredMatch): StoredMatch {\n    if (m.result) return m;\n    const now = this.options.now();\n    for (let safety = 0; safety < 256 && !m.result; safety++) {\n      const deadlines: { at: number; loser: Seat; reason: 'timeout' | 'disconnect' }[] = [\n        { at: timeoutAt(this.controlOf(m), m.clockMs, m.state.turn, m.turnStartedAt), loser: m.state.turn, reason: 'timeout' },\n      ];\n      for (const seat of seats(m.players.length))\n        if (m.disconnectedAt[seat] !== null)\n          deadlines.push({ at: m.disconnectedAt[seat]! + m.graceMs, loser: seat, reason: 'disconnect' });\n      deadlines.sort((a, b) => a.at - b.at);\n      const first = deadlines[0];\n      if (first.at > now) return m;\n      if (first.reason === 'timeout') {\n        const advanced = this.applyTimeoutMove(m, first.at);\n        if (advanced) {\n          m = advanced;\n          continue;\n        }\n        return this.finish(m, this.bestRemaining(m, [first.loser]), 'timeout', first.at);\n      }\n      const simultaneous = deadlines\n        .filter((deadline) => deadline.reason === 'disconnect' && deadline.at === first.at)\n        .map((deadline) => deadline.loser);\n      if (simultaneous.length === m.players.length) return this.finish(m, null, 'abandoned', first.at);\n      return this.finish(m, this.bestRemaining(m, simultaneous), 'disconnect', first.at);\n    }\n    return m;\n  }",
)

# Persist local automatic timeout draws immediately instead of waiting for the next manual action.
patch(
    'apps/mobile/src/App.tsx',
    "      if (session && !session.controller.current.result) {\n        session.controller.tick();\n        if (session.controller.current.result) syncOffline();\n      }",
    "      if (session && !session.controller.current.result) {\n        const previousPly = session.controller.current.state.ply;\n        session.controller.tick();\n        if (\n          session.controller.current.result ||\n          session.controller.current.state.ply !== previousPly\n        )\n          syncOffline();\n      }",
)

write('tests/digital-turn-timer.test.ts', r'''import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { OfflineMatch } from '../packages/core/src/offline.ts';
import { clientMessageSchema } from '../packages/core/src/protocol.ts';
import {
  TURN_TIMER_SECONDS,
  bankTimeControl,
  beginTurn,
  createClocks,
  remainingTimeMs,
  turnTimeControl,
} from '../packages/core/src/timing.ts';
import { games } from '../packages/games/registry.ts';
import type { DigitalGameState } from '../packages/games/digital-game/state.ts';
import { Lobby } from '../apps/server/src/lobby.ts';
import { MatchService } from '../apps/server/src/matches.ts';
import { Store } from '../apps/server/src/store.ts';

function user(store: Store, name: string) {
  return store.createUser(name, 'email', `${name}-${randomUUID()}`);
}

test('shared turn timing counts down only the active seat and resets on turn advance', () => {
  const control = turnTimeControl(30),
    clocks = createClocks(control, 3);
  assert.equal(remainingTimeMs(control, clocks, 0, 0, 1000, 21000), 10000);
  assert.equal(remainingTimeMs(control, clocks, 0, 1, 1000, 21000), 30000);
  assert.deepEqual(beginTurn(control, [10000, 30000, 30000], 0, 1), [30000, 30000, 30000]);
});

for (const seconds of TURN_TIMER_SECONDS) {
  test(`Digital local ${seconds}-second timeout automatically draws one tile and advances the turn`, () => {
    let now = 0;
    const durationMs = seconds * 1000,
      match = new OfflineMatch(
        games.get('digitalGame'),
        'local',
        () => now,
        3,
        turnTimeControl(seconds),
      ),
      initial = match.current.state as DigitalGameState,
      initialPool = initial.drawPool.length;

    now = durationMs - 1;
    assert.equal(match.tick().result, null);
    assert.equal(match.current.state.turn, 0);
    assert.equal((match.current.state as DigitalGameState).rackCounts[0], 14);

    now = durationMs;
    const afterFirst = match.tick(),
      firstState = afterFirst.state as DigitalGameState;
    assert.equal(afterFirst.result, null);
    assert.equal(firstState.turn, 1);
    assert.equal(firstState.ply, 1);
    assert.equal(firstState.rackCounts[0], 15);
    assert.equal(firstState.rackCounts[1], 14);
    assert.equal(firstState.drawPool.length, initialPool - 1);
    assert.equal(firstState.lastAction, 'draw');
    assert.equal(afterFirst.turnStartedAt, durationMs);
    assert.deepEqual(afterFirst.clocks, [durationMs, durationMs, durationMs]);

    now = durationMs * 2;
    const afterSecond = match.tick(),
      secondState = afterSecond.state as DigitalGameState;
    assert.equal(afterSecond.result, null);
    assert.equal(secondState.turn, 2);
    assert.equal(secondState.ply, 2);
    assert.equal(secondState.rackCounts[1], 15);
    assert.equal(secondState.drawPool.length, initialPool - 2);
    assert.equal(afterSecond.turnStartedAt, durationMs * 2);
  });
}

for (const seconds of TURN_TIMER_SECONDS) {
  test(`authoritative Digital ${seconds}-second timeout auto-draws, advances revision, and keeps match active`, () => {
    let now = 0;
    const durationMs = seconds * 1000,
      store = new Store(),
      service = new MatchService(store, games, { now: () => now }),
      a = user(store, `A-${seconds}`),
      b = user(store, `B-${seconds}`),
      c = user(store, `C-${seconds}`);
    try {
      const match = service.create(
          'digitalGame',
          [a.id, b.id, c.id],
          false,
          turnTimeControl(seconds),
        ),
        initialState = match.state as DigitalGameState,
        initialPool = initialState.drawPool.length;
      assert.deepEqual(match.timeControl, turnTimeControl(seconds));
      assert.deepEqual(match.clockMs, [durationMs, durationMs, durationMs]);

      now = durationMs - 1;
      const beforeDeadline = service.get(match.id, a.id);
      assert.equal(beforeDeadline.result, null);
      assert.equal(beforeDeadline.state.turn, 0);
      assert.equal(beforeDeadline.revision, 0);

      now = durationMs;
      const afterFirst = service.get(match.id, a.id),
        firstState = afterFirst.state as DigitalGameState;
      assert.equal(afterFirst.result, null);
      assert.equal(afterFirst.endedAt, null);
      assert.equal(afterFirst.revision, 1);
      assert.equal(firstState.turn, 1);
      assert.equal(firstState.ply, 1);
      assert.equal(firstState.rackCounts[0], 15);
      assert.equal(firstState.drawPool.length, initialPool - 1);
      assert.equal(firstState.lastAction, 'draw');
      assert.equal(afterFirst.turnStartedAt, durationMs);
      assert.deepEqual(afterFirst.clockMs, [durationMs, durationMs, durationMs]);

      const storedAfterFirst = store.loadMatch(match.id);
      assert.equal(storedAfterFirst.result, null);
      assert.equal(storedAfterFirst.revision, 1);
      assert.equal((storedAfterFirst.state as DigitalGameState).rackCounts[0], 15);
      const rowsAfterFirst = store.db
        .prepare('SELECT reason FROM results WHERE match_id=?')
        .all(match.id) as { reason: string }[];
      assert.equal(rowsAfterFirst.length, 0);

      now = durationMs * 2;
      const afterSecond = service.get(match.id, b.id),
        secondState = afterSecond.state as DigitalGameState;
      assert.equal(afterSecond.result, null);
      assert.equal(afterSecond.revision, 2);
      assert.equal(secondState.turn, 2);
      assert.equal(secondState.ply, 2);
      assert.equal(secondState.rackCounts[1], 15);
      assert.equal(secondState.drawPool.length, initialPool - 2);
      assert.equal(afterSecond.turnStartedAt, durationMs * 2);
    } finally {
      store.close();
    }
  });
}

test('games without an automatic timeout move still end with timeout', () => {
  let now = 0;
  const match = new OfflineMatch(
    games.get('quoridor'),
    'local',
    () => now,
    2,
    bankTimeControl(1000),
  );
  now = 999;
  assert.equal(match.tick().result, null);
  now = 1000;
  assert.equal(match.tick().result?.reason, 'timeout');
});

test('Digital matchmaking isolates timer choices and private rooms preserve them', () => {
  const store = new Store(),
    service = new MatchService(store, games),
    lobby = new Lobby(service);
  try {
    const a = user(store, 'A'),
      b = user(store, 'B'),
      c = user(store, 'C'),
      d = user(store, 'D'),
      e = user(store, 'E');
    assert.equal(lobby.enqueue(a.id, 'digitalGame', false, 2, 30), null);
    assert.equal(lobby.enqueue(b.id, 'digitalGame', false, 2, 45), null);
    const quick = lobby.enqueue(c.id, 'digitalGame', false, 2, 30);
    assert.ok(quick);
    assert.deepEqual(quick!.timeControl, turnTimeControl(30));
    assert.equal(lobby.queue.length, 1);

    const room = lobby.createRoom(d.id, 'digitalGame', 2, 90);
    assert.equal(room.turnSeconds, 90);
    const privateMatch = lobby.joinRoomResult(e.id, room.code).match;
    assert.ok(privateMatch);
    assert.deepEqual(privateMatch!.timeControl, turnTimeControl(90));
  } finally {
    store.close();
  }
});

test('protocol accepts only 30/45/60/90 seconds and classic games reject turn clocks', () => {
  const parsed = clientMessageSchema.parse({
    type: 'queue',
    gameId: 'digitalGame',
    ranked: false,
    playerCount: 4,
    turnSeconds: 60,
  });
  assert.equal(parsed.type, 'queue');
  assert.equal('turnSeconds' in parsed ? parsed.turnSeconds : undefined, 60);
  assert.throws(() =>
    clientMessageSchema.parse({
      type: 'queue',
      gameId: 'digitalGame',
      ranked: false,
      playerCount: 4,
      turnSeconds: 15,
    }),
  );
  const store = new Store(),
    service = new MatchService(store, games),
    lobby = new Lobby(service),
    a = user(store, 'A');
  try {
    assert.throws(() => lobby.createRoom(a.id, 'quoridor', 2, 30), /turn-timer-not-supported/);
  } finally {
    store.close();
  }
});
''')
