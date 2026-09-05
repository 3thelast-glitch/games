from pathlib import Path


def patch(path: str, old: str, new: str, count: int = 1):
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    if old not in s:
        raise RuntimeError(f'patch target missing in {path}: {old[:140]!r}')
    p.write_text(s.replace(old, new, count), encoding='utf-8')


def write(path: str, content: str):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')


write('packages/core/src/timing.ts', r'''import type { Seat } from './game.ts';

export const TURN_TIMER_SECONDS = [30, 45, 60, 90] as const;
export type TurnTimerSeconds = (typeof TURN_TIMER_SECONDS)[number];
export const DEFAULT_TURN_TIMER_SECONDS: TurnTimerSeconds = 60;
export const TURN_TIMER_MS = [30000, 45000, 60000, 90000] as const;
export type TurnTimerMs = (typeof TURN_TIMER_MS)[number];

export type TimeControl =
  | { mode: 'bank'; initialMs: number }
  | { mode: 'turn'; turnMs: TurnTimerMs };

export const bankTimeControl = (initialMs: number): TimeControl => ({ mode: 'bank', initialMs });
export const turnTimeControl = (seconds: TurnTimerSeconds): TimeControl => ({
  mode: 'turn',
  turnMs: (seconds * 1000) as TurnTimerMs,
});
export const isTurnTimerMs = (value: number): value is TurnTimerMs =>
  (TURN_TIMER_MS as readonly number[]).includes(value);

export function createClocks(control: TimeControl, count: number): number[] {
  const initial = control.mode === 'bank' ? control.initialMs : control.turnMs;
  return Array.from({ length: count }, () => initial);
}

export function remainingTimeMs(
  control: TimeControl,
  clocks: readonly number[],
  activeSeat: Seat,
  seat: Seat,
  turnStartedAt: number,
  now: number,
): number {
  const base = control.mode === 'turn' ? control.turnMs : (clocks[seat] ?? 0);
  if (seat !== activeSeat) return control.mode === 'turn' ? control.turnMs : Math.max(0, base);
  return Math.max(0, base - Math.max(0, now - turnStartedAt));
}

export function chargeClock(
  control: TimeControl,
  clocks: readonly number[],
  activeSeat: Seat,
  turnStartedAt: number,
  now: number,
): number[] {
  const next = [...clocks];
  next[activeSeat] = remainingTimeMs(control, clocks, activeSeat, activeSeat, turnStartedAt, now);
  return next;
}

export function beginTurn(
  control: TimeControl,
  clocks: readonly number[],
  previousSeat: Seat,
  nextSeat: Seat,
): number[] {
  if (control.mode !== 'turn') return [...clocks];
  const next = [...clocks];
  next[previousSeat] = control.turnMs;
  next[nextSeat] = control.turnMs;
  return next;
}

export function timeoutAt(
  control: TimeControl,
  clocks: readonly number[],
  activeSeat: Seat,
  turnStartedAt: number,
): number {
  const budget = control.mode === 'turn' ? control.turnMs : Math.max(0, clocks[activeSeat] ?? 0);
  return turnStartedAt + budget;
}
''')

# Protocol v3 adds a selected Digital Game turn timer while keeping older auth handshakes valid.
patch(
    'packages/core/src/protocol.ts',
    "import type { BaseState, PlayerCount, Seat } from './game.ts';\nexport const PROTOCOL_VERSION = 2;",
    "import type { BaseState, PlayerCount, Seat } from './game.ts';\nimport type { TimeControl, TurnTimerSeconds } from './timing.ts';\nexport const PROTOCOL_VERSION = 3;",
)
patch(
    'packages/core/src/protocol.ts',
    "const playerCount = z.union([z.literal(2), z.literal(3), z.literal(4)]);",
    "const playerCount = z.union([z.literal(2), z.literal(3), z.literal(4)]);\nconst turnTimerSeconds = z.union([z.literal(30), z.literal(45), z.literal(60), z.literal(90)]);",
)
patch(
    'packages/core/src/protocol.ts',
    "version: z.union([z.literal(1), z.literal(PROTOCOL_VERSION)]),",
    "version: z.union([z.literal(1), z.literal(2), z.literal(PROTOCOL_VERSION)]),",
)
patch(
    'packages/core/src/protocol.ts',
    "      playerCount: playerCount.default(2),\n    })\n    .strict(),\n  z.object({ type: z.literal('cancel') }).strict(),",
    "      playerCount: playerCount.default(2),\n      turnSeconds: turnTimerSeconds.optional(),\n    })\n    .strict(),\n  z.object({ type: z.literal('cancel') }).strict(),",
)
patch(
    'packages/core/src/protocol.ts',
    "      gameId: id,\n      playerCount: playerCount.default(2),\n    })\n    .strict(),\n  z\n    .object({\n      type: z.literal('join-room'),",
    "      gameId: id,\n      playerCount: playerCount.default(2),\n      turnSeconds: turnTimerSeconds.optional(),\n    })\n    .strict(),\n  z\n    .object({\n      type: z.literal('join-room'),",
)
patch(
    'packages/core/src/protocol.ts',
    "  clockMs: number[];\n  turnStartedAt: number;",
    "  clockMs: number[];\n  /** Optional for persisted v1/v2 snapshots; new matches always include it. */\n  timeControl?: TimeControl;\n  turnStartedAt: number;",
)
patch(
    'packages/core/src/protocol.ts',
    "  | { type: 'queued'; gameId: string; ranked: boolean; playerCount: PlayerCount }",
    "  | {\n      type: 'queued';\n      gameId: string;\n      ranked: boolean;\n      playerCount: PlayerCount;\n      turnSeconds: TurnTimerSeconds | null;\n    }",
)
patch(
    'packages/core/src/protocol.ts',
    "      playerCount: PlayerCount;\n      joined: number;",
    "      playerCount: PlayerCount;\n      turnSeconds: TurnTimerSeconds | null;\n      joined: number;",
)

# Shared offline timing now supports either the existing cumulative bank or a resetting per-turn clock.
patch(
    'packages/core/src/offline.ts',
    "import type { MatchResult } from './protocol.ts';",
    "import type { MatchResult } from './protocol.ts';\nimport {\n  bankTimeControl,\n  beginTurn,\n  chargeClock,\n  createClocks,\n  remainingTimeMs,\n  type TimeControl,\n} from './timing.ts';",
)
patch(
    'packages/core/src/offline.ts',
    "  clocks: number[];\n  turnStartedAt: number;",
    "  clocks: number[];\n  timeControl?: TimeControl;\n  turnStartedAt: number;",
)
patch(
    'packages/core/src/offline.ts',
    "    readonly playerCount: PlayerCount = 2,\n  ) {",
    "    readonly playerCount: PlayerCount = 2,\n    readonly timeControl: TimeControl = bankTimeControl(600000),\n  ) {",
)
patch(
    'packages/core/src/offline.ts',
    "      state: game.create(playerCount),\n      clocks: Array.from({ length: playerCount }, () => 600000),\n      turnStartedAt: nowValue,",
    "      state: game.create(playerCount),\n      clocks: createClocks(this.timeControl, playerCount),\n      timeControl: this.timeControl,\n      turnStartedAt: nowValue,",
)
patch(
    'packages/core/src/offline.ts',
    "  private charge() {\n    const c = this.current;\n    c.clocks = [...c.clocks];\n    c.clocks[c.state.turn] = Math.max(0, c.clocks[c.state.turn] - (this.now() - c.turnStartedAt));\n    c.turnStartedAt = this.now();\n  }",
    "  private control(): TimeControl {\n    return this.current.timeControl ?? this.timeControl;\n  }\n  private charge() {\n    const c = this.current,\n      now = this.now();\n    c.clocks = chargeClock(this.control(), c.clocks, c.state.turn, c.turnStartedAt, now);\n    c.turnStartedAt = now;\n  }",
)
patch(
    'packages/core/src/offline.ts',
    "    const next = this.game.apply(this.current.state, input);\n    this.history.push(structuredClone(this.current));\n    this.charge();\n    this.current = { ...this.current, state: next };\n    if (next.winner !== null) this.finish(next.winner, this.game.winReason);\n    else if (next.drawReason) this.finish(null, next.drawReason);\n    return this.current;",
    "    const previousTurn = this.current.state.turn,\n      next = this.game.apply(this.current.state, input);\n    this.history.push(structuredClone(this.current));\n    this.charge();\n    this.current = { ...this.current, state: next };\n    if (next.winner !== null) this.finish(next.winner, this.game.winReason);\n    else if (next.drawReason) this.finish(null, next.drawReason);\n    else this.current.clocks = beginTurn(this.control(), this.current.clocks, previousTurn, next.turn);\n    return this.current;",
)
patch(
    'packages/core/src/offline.ts',
    "    if (!c.result && c.clocks[c.state.turn] - (this.now() - c.turnStartedAt) <= 0)\n      this.finish(this.bestRemaining(c.state.turn), 'timeout');",
    "    if (\n      !c.result &&\n      remainingTimeMs(this.control(), c.clocks, c.state.turn, c.state.turn, c.turnStartedAt, this.now()) <= 0\n    )\n      this.finish(this.bestRemaining(c.state.turn), 'timeout');",
)

# Authoritative server timing uses the same timing helpers.
patch(
    'apps/server/src/matches.ts',
    "import type { MatchSnapshot, MatchCommand, ResultReason } from '../../../packages/core/src/protocol.ts';",
    "import type { MatchSnapshot, MatchCommand, ResultReason } from '../../../packages/core/src/protocol.ts';\nimport {\n  bankTimeControl,\n  beginTurn,\n  chargeClock,\n  createClocks,\n  isTurnTimerMs,\n  timeoutAt,\n  type TimeControl,\n} from '../../../packages/core/src/timing.ts';",
)
patch(
    'apps/server/src/matches.ts',
    "  create(gameId: string, users: string[], ranked = false): MatchSnapshot {\n    const game = this.games.get(gameId);",
    "  private control(gameId: string, requested?: TimeControl): TimeControl {\n    const control = requested ?? bankTimeControl(this.options.clockMs);\n    if (control.mode === 'bank') {\n      if (!Number.isFinite(control.initialMs) || control.initialMs < 1000)\n        throw new RuleError('invalid-time-control');\n      return control;\n    }\n    if (gameId !== 'digitalGame' || !isTurnTimerMs(control.turnMs))\n      throw new RuleError('turn-timer-not-supported');\n    return control;\n  }\n  private controlOf(match: Pick<StoredMatch, 'gameId' | 'timeControl'>): TimeControl {\n    return this.control(match.gameId, match.timeControl);\n  }\n  create(gameId: string, users: string[], ranked = false, requestedTimeControl?: TimeControl): MatchSnapshot {\n    const game = this.games.get(gameId),\n      timeControl = this.control(gameId, requestedTimeControl);",
)
patch(
    'apps/server/src/matches.ts',
    "      clockMs: users.map(() => this.options.clockMs),\n      turnStartedAt: now,",
    "      clockMs: createClocks(timeControl, users.length),\n      timeControl,\n      turnStartedAt: now,",
)
patch(
    'apps/server/src/matches.ts',
    "  snapshot(match: StoredMatch): MatchSnapshot {\n    const { commands, ...publicMatch } = match;\n    return { ...publicMatch, serverNow: this.options.now() };\n  }",
    "  snapshot(match: StoredMatch): MatchSnapshot {\n    const { commands, ...publicMatch } = match;\n    return { ...publicMatch, timeControl: this.controlOf(match), serverNow: this.options.now() };\n  }",
)
patch(
    'apps/server/src/matches.ts',
    "    m.clockMs[m.state.turn] = Math.max(0, m.clockMs[m.state.turn] - Math.max(0, at - m.turnStartedAt));\n    m.turnStartedAt = at;",
    "    m.clockMs = chargeClock(this.controlOf(m), m.clockMs, m.state.turn, m.turnStartedAt, at);\n    m.turnStartedAt = at;",
)
patch(
    'apps/server/src/matches.ts',
    "      { at: m.turnStartedAt + m.clockMs[m.state.turn], loser: m.state.turn, reason: 'timeout' },",
    "      { at: timeoutAt(this.controlOf(m), m.clockMs, m.state.turn, m.turnStartedAt), loser: m.state.turn, reason: 'timeout' },",
)
patch(
    'apps/server/src/matches.ts',
    "      const next = this.games.get(m.gameId).apply(m.state, command.move);\n      m.clockMs[seat] = Math.max(0, m.clockMs[seat] - Math.max(0, now - m.turnStartedAt));\n      m.turnStartedAt = now;\n      m.state = next;",
    "      const previousTurn = m.state.turn,\n        next = this.games.get(m.gameId).apply(m.state, command.move);\n      m.clockMs = chargeClock(this.controlOf(m), m.clockMs, seat, m.turnStartedAt, now);\n      m.turnStartedAt = now;\n      m.state = next;",
)
patch(
    'apps/server/src/matches.ts',
    "      if (next.winner !== null)\n        return this.snapshot(this.finish(m, next.winner, this.games.get(m.gameId).winReason, now));\n      if (next.drawReason) return this.snapshot(this.finish(m, null, next.drawReason, now));",
    "      if (next.winner !== null)\n        return this.snapshot(this.finish(m, next.winner, this.games.get(m.gameId).winReason, now));\n      if (next.drawReason) return this.snapshot(this.finish(m, null, next.drawReason, now));\n      m.clockMs = beginTurn(this.controlOf(m), m.clockMs, previousTurn, next.turn);",
)
patch(
    'apps/server/src/matches.ts',
    "      const next = this.create(m.gameId, users, m.ranked);",
    "      const next = this.create(m.gameId, users, m.ranked, this.controlOf(m));",
)

# Lobby carries timer selection through queue grouping/private rooms and prevents mismatched timer matchmaking.
patch(
    'apps/server/src/lobby.ts',
    "import type { MatchSnapshot } from '../../../packages/core/src/protocol.ts';",
    "import type { MatchSnapshot } from '../../../packages/core/src/protocol.ts';\nimport {\n  DEFAULT_TURN_TIMER_SECONDS,\n  turnTimeControl,\n  type TurnTimerSeconds,\n} from '../../../packages/core/src/timing.ts';",
)
patch(
    'apps/server/src/lobby.ts',
    "  playerCount: PlayerCount;\n  at: number;",
    "  playerCount: PlayerCount;\n  turnSeconds: TurnTimerSeconds | null;\n  at: number;",
)
patch(
    'apps/server/src/lobby.ts',
    "  playerCount: PlayerCount;\n  expiresAt: number;",
    "  playerCount: PlayerCount;\n  turnSeconds: TurnTimerSeconds | null;\n  expiresAt: number;",
)
patch(
    'apps/server/src/lobby.ts',
    "  private eligible(userId: string, gameId: string, ranked = false) {",
    "  private normalizeTurnSeconds(gameId: string, value?: TurnTimerSeconds): TurnTimerSeconds | null {\n    if (gameId !== 'digitalGame') {\n      if (value !== undefined) throw new RuleError('turn-timer-not-supported');\n      return null;\n    }\n    return value ?? DEFAULT_TURN_TIMER_SECONDS;\n  }\n  private eligible(userId: string, gameId: string, ranked = false) {",
)
patch(
    'apps/server/src/lobby.ts',
    "  private group(gameId: string, users: string[], ranked: boolean) {\n    return this.matches.create(gameId, this.shuffled(users), ranked);\n  }",
    "  private group(\n    gameId: string,\n    users: string[],\n    ranked: boolean,\n    turnSeconds: TurnTimerSeconds | null,\n  ) {\n    return this.matches.create(\n      gameId,\n      this.shuffled(users),\n      ranked,\n      turnSeconds === null ? undefined : turnTimeControl(turnSeconds),\n    );\n  }",
)
patch(
    'apps/server/src/lobby.ts',
    "    requestedPlayerCount: PlayerCount = 2,\n  ): MatchSnapshot | null {\n    this.eligible(userId, gameId, ranked);\n    const playerCount = this.normalizePlayerCount(gameId, requestedPlayerCount);",
    "    requestedPlayerCount: PlayerCount = 2,\n    requestedTurnSeconds?: TurnTimerSeconds,\n  ): MatchSnapshot | null {\n    this.eligible(userId, gameId, ranked);\n    const playerCount = this.normalizePlayerCount(gameId, requestedPlayerCount),\n      turnSeconds = this.normalizeTurnSeconds(gameId, requestedTurnSeconds);",
)
patch(
    'apps/server/src/lobby.ts',
    "    const entry: QueueEntry = { userId, gameId, ranked, playerCount, at: this.matches.options.now() };",
    "    const entry: QueueEntry = {\n      userId,\n      gameId,\n      ranked,\n      playerCount,\n      turnSeconds,\n      at: this.matches.options.now(),\n    };",
)
patch(
    'apps/server/src/lobby.ts',
    "          q.playerCount === entry.playerCount &&\n          (!entry.ranked ||",
    "          q.playerCount === entry.playerCount &&\n          q.turnSeconds === entry.turnSeconds &&\n          (!entry.ranked ||",
)
patch(
    'apps/server/src/lobby.ts',
    "    const match = this.group(entry.gameId, selected.map((item) => item.userId), entry.ranked);",
    "    const match = this.group(\n      entry.gameId,\n      selected.map((item) => item.userId),\n      entry.ranked,\n      entry.turnSeconds,\n    );",
)
patch(
    'apps/server/src/lobby.ts',
    "  createRoom(userId: string, gameId: string, requestedPlayerCount: PlayerCount = 2): Room {\n    this.eligible(userId, gameId);\n    const playerCount = this.normalizePlayerCount(gameId, requestedPlayerCount);",
    "  createRoom(\n    userId: string,\n    gameId: string,\n    requestedPlayerCount: PlayerCount = 2,\n    requestedTurnSeconds?: TurnTimerSeconds,\n  ): Room {\n    this.eligible(userId, gameId);\n    const playerCount = this.normalizePlayerCount(gameId, requestedPlayerCount),\n      turnSeconds = this.normalizeTurnSeconds(gameId, requestedTurnSeconds);",
)
patch(
    'apps/server/src/lobby.ts',
    "      playerCount,\n      code,",
    "      playerCount,\n      turnSeconds,\n      code,",
)
patch(
    'apps/server/src/lobby.ts',
    "    const match = this.group(room.gameId, room.members, false);",
    "    const match = this.group(room.gameId, room.members, false, room.turnSeconds);",
)

# WebSocket messages now forward and expose the selected timer.
patch(
    'apps/server/src/server.ts',
    "        playerCount: room.playerCount,\n        joined: room.members.length,",
    "        playerCount: room.playerCount,\n        turnSeconds: room.turnSeconds,\n        joined: room.members.length,",
)
patch(
    'apps/server/src/server.ts',
    "          const match = lobby.enqueue(userId, message.gameId, message.ranked, message.playerCount);",
    "          const match = lobby.enqueue(\n            userId,\n            message.gameId,\n            message.ranked,\n            message.playerCount,\n            message.turnSeconds,\n          );",
)
patch(
    'apps/server/src/server.ts',
    "              playerCount: message.playerCount,\n            });",
    "              playerCount: message.playerCount,\n              turnSeconds:\n                message.gameId === 'digitalGame' ? (message.turnSeconds ?? 60) : null,\n            });",
)
patch(
    'apps/server/src/server.ts',
    "          const room = lobby.createRoom(userId, message.gameId, message.playerCount);",
    "          const room = lobby.createRoom(\n            userId,\n            message.gameId,\n            message.playerCount,\n            message.turnSeconds,\n          );",
)

# Digital Game mode selector exposes 30/45/60/90 second turn clocks.
patch(
    'apps/mobile/src/pages.tsx',
    "import type { Difficulty, PlayerCount, Seat } from '../../../packages/core/src/game.ts';",
    "import type { Difficulty, PlayerCount, Seat } from '../../../packages/core/src/game.ts';\nimport type { TurnTimerSeconds } from '../../../packages/core/src/timing.ts';",
)
patch(
    'apps/mobile/src/pages.tsx',
    "  onStart: (mode: PlayMode, difficulty: Difficulty, ranked: boolean, playerCount: PlayerCount, code?: string) => void;",
    "  onStart: (\n    mode: PlayMode,\n    difficulty: Difficulty,\n    ranked: boolean,\n    playerCount: PlayerCount,\n    turnSeconds: TurnTimerSeconds,\n    code?: string,\n  ) => void;",
)
patch(
    'apps/mobile/src/pages.tsx',
    "    [playerCount, setPlayerCount] = useState<PlayerCount>(2),\n    [code, setCode] = useState('');",
    "    [playerCount, setPlayerCount] = useState<PlayerCount>(2),\n    [turnSeconds, setTurnSeconds] = useState<TurnTimerSeconds>(60),\n    [code, setCode] = useState('');",
)
player_block = """      {gameId === 'digitalGame' && mode !== 'ai' && (\n        <fieldset>\n          <legend>{t('playerCountLabel')}</legend>\n          <div className=\"segmented\">\n            {([2, 3, 4] as PlayerCount[]).map((count) => (\n              <button key={count} aria-pressed={playerCount === count} onClick={() => setPlayerCount(count)}>\n                {count}\n              </button>\n            ))}\n          </div>\n        </fieldset>\n      )}\n"""
if player_block not in Path('apps/mobile/src/pages.tsx').read_text(encoding='utf-8'):
    raise RuntimeError('Digital player selector block not found')
patch(
    'apps/mobile/src/pages.tsx',
    player_block,
    player_block + """      {gameId === 'digitalGame' && (\n        <fieldset>\n          <legend>{t('turn')} ⏱</legend>\n          <div className=\"segmented\">\n            {([30, 45, 60, 90] as TurnTimerSeconds[]).map((seconds) => (\n              <button\n                key={seconds}\n                aria-pressed={turnSeconds === seconds}\n                onClick={() => setTurnSeconds(seconds)}\n              >\n                {seconds}s\n              </button>\n            ))}\n          </div>\n        </fieldset>\n      )}\n""",
)
patch(
    'apps/mobile/src/pages.tsx',
    "onClick={() => onStart(mode, difficulty, false, playerCount)}",
    "onClick={() => onStart(mode, difficulty, false, playerCount, turnSeconds)}",
)
patch(
    'apps/mobile/src/pages.tsx',
    "onStart(mode, difficulty, false, playerCount, code);",
    "onStart(mode, difficulty, false, playerCount, turnSeconds, code);",
)
patch(
    'apps/mobile/src/pages.tsx',
    "onClick={() => onStart(mode, difficulty, ranked, mode === 'ai' ? 2 : playerCount)}",
    "onClick={() =>\n            onStart(mode, difficulty, ranked, mode === 'ai' ? 2 : playerCount, turnSeconds)\n          }",
)
patch(
    'apps/mobile/src/pages.tsx',
    "    | { type: 'room'; code: string; gameId: string; expiresAt: number; playerCount: PlayerCount; joined: number }\n    | { type: 'queued'; gameId: string; ranked: boolean; playerCount: PlayerCount };",
    "    | {\n        type: 'room';\n        code: string;\n        gameId: string;\n        expiresAt: number;\n        playerCount: PlayerCount;\n        turnSeconds: TurnTimerSeconds | null;\n        joined: number;\n      }\n    | {\n        type: 'queued';\n        gameId: string;\n        ranked: boolean;\n        playerCount: PlayerCount;\n        turnSeconds: TurnTimerSeconds | null;\n      };",
)
patch(
    'apps/mobile/src/pages.tsx',
    "        <p className=\"small-muted\">\n          {t('playerCountLabel')}: {room.type === 'room' ? `${room.joined}/${room.playerCount}` : room.playerCount}\n        </p>",
    "        <p className=\"small-muted\">\n          {t('playerCountLabel')}: {room.type === 'room' ? `${room.joined}/${room.playerCount}` : room.playerCount}\n        </p>\n        {room.turnSeconds !== null && (\n          <p className=\"small-muted\">\n            {t('turn')}: {room.turnSeconds}s\n          </p>\n        )}",
)

# App wires selected timing into local matches, queue/private-room commands, restore, restart and rematch.
patch(
    'apps/mobile/src/App.tsx',
    "import { OfflineMatch, type OfflineSnapshot } from '../../../packages/core/src/offline.ts';",
    "import { OfflineMatch, type OfflineSnapshot } from '../../../packages/core/src/offline.ts';\nimport {\n  bankTimeControl,\n  turnTimeControl,\n  type TimeControl,\n  type TurnTimerSeconds,\n} from '../../../packages/core/src/timing.ts';",
)
patch(
    'apps/mobile/src/App.tsx',
    "            (saved.current.state.playerCount ?? 2) as PlayerCount,\n          );",
    "            (saved.current.state.playerCount ?? 2) as PlayerCount,\n            saved.current.timeControl ?? bankTimeControl(600000),\n          );",
)
patch(
    'apps/mobile/src/App.tsx',
    "    playerCount: PlayerCount = 2,\n  ) => {",
    "    playerCount: PlayerCount = 2,\n    timeControl: TimeControl = bankTimeControl(600000),\n  ) => {",
)
patch(
    'apps/mobile/src/App.tsx',
    "      controller: new OfflineMatch(games.get(gameId), mode, Date.now, mode === 'ai' ? 2 : playerCount),",
    "      controller: new OfflineMatch(\n        games.get(gameId),\n        mode,\n        Date.now,\n        mode === 'ai' ? 2 : playerCount,\n        timeControl,\n      ),",
)
patch(
    'apps/mobile/src/App.tsx',
    "    playerCount: PlayerCount,\n    code?: string,",
    "    playerCount: PlayerCount,\n    turnSeconds: TurnTimerSeconds,\n    code?: string,",
)
patch(
    'apps/mobile/src/App.tsx',
    "        startOffline(choice.gameId, mode, difficulty, playerCount);",
    "        startOffline(\n          choice.gameId,\n          mode,\n          difficulty,\n          playerCount,\n          choice.gameId === 'digitalGame'\n            ? turnTimeControl(turnSeconds)\n            : bankTimeControl(600000),\n        );",
)
patch(
    'apps/mobile/src/App.tsx',
    "          code\n            ? { type: 'join-room', code }\n            : { type: 'create-room', gameId: choice.gameId, playerCount },\n        );\n      else connection.send({ type: 'queue', gameId: choice.gameId, ranked, playerCount });",
    "          code\n            ? { type: 'join-room', code }\n            : {\n                type: 'create-room',\n                gameId: choice.gameId,\n                playerCount,\n                ...(choice.gameId === 'digitalGame' ? { turnSeconds } : {}),\n              },\n        );\n      else\n        connection.send({\n          type: 'queue',\n          gameId: choice.gameId,\n          ranked,\n          playerCount,\n          ...(choice.gameId === 'digitalGame' ? { turnSeconds } : {}),\n        });",
)
patch(
    'apps/mobile/src/App.tsx',
    "                clocks={online?.clockMs ?? local!.clocks}\n                turnStartedAt={online?.turnStartedAt ?? local!.turnStartedAt}",
    "                clocks={online?.clockMs ?? local!.clocks}\n                timeControl={\n                  online?.timeControl ?? local!.timeControl ?? bankTimeControl(600000)\n                }\n                turnStartedAt={online?.turnStartedAt ?? local!.turnStartedAt}",
)
patch(
    'apps/mobile/src/App.tsx',
    "                    (offline!.controller.current.state.playerCount ?? 2) as PlayerCount,\n                  )",
    "                    (offline!.controller.current.state.playerCount ?? 2) as PlayerCount,\n                    offline!.controller.current.timeControl ?? bankTimeControl(600000),\n                  )",
    2,
)

# Match UI calculates remaining time through the shared timing module and uses a sensible low-time threshold for short turn clocks.
patch(
    'apps/mobile/src/MatchPage.tsx',
    "import type { MatchResult, PublicPlayer } from '../../../packages/core/src/protocol.ts';",
    "import type { MatchResult, PublicPlayer } from '../../../packages/core/src/protocol.ts';\nimport {\n  bankTimeControl,\n  remainingTimeMs,\n  type TimeControl,\n} from '../../../packages/core/src/timing.ts';",
)
patch(
    'apps/mobile/src/MatchPage.tsx',
    "  clocks: number[];\n  turnStartedAt: number;",
    "  clocks: number[];\n  timeControl?: TimeControl;\n  turnStartedAt: number;",
)
patch(
    'apps/mobile/src/MatchPage.tsx',
    "  const view = gameViews[p.state.gameId],",
    "  const timeControl = p.timeControl ?? bankTimeControl(600000),\n    view = gameViews[p.state.gameId],",
)
patch(
    'apps/mobile/src/MatchPage.tsx',
    "      clock = Math.max(\n        0,\n        p.clocks[player] - (!p.result && p.state.turn === player ? p.now - p.turnStartedAt : 0),\n      );",
    "      clock = p.result\n        ? Math.max(0, p.clocks[player] ?? 0)\n        : remainingTimeMs(\n            timeControl,\n            p.clocks,\n            p.state.turn,\n            player,\n            p.turnStartedAt,\n            p.now,\n          ),\n      lowThreshold = timeControl.mode === 'turn' ? Math.min(10000, timeControl.turnMs / 3) : 60000;",
)
patch(
    'apps/mobile/src/MatchPage.tsx',
    "              t(player === 0 ? 'player1' : 'player2')",
    "              t(`player${player + 1}`)",
)
patch(
    'apps/mobile/src/MatchPage.tsx',
    "        <div className={`match-clock ${clock < 60000 ? 'low' : ''}`} dir=\"ltr\">",
    "        <div\n          className={`match-clock ${!p.result && p.state.turn === player && clock <= lowThreshold ? 'low' : ''}`}\n          dir=\"ltr\"\n        >",
)
patch(
    'apps/mobile/src/MatchPage.tsx',
    "            {p.mode === 'online' ? ` · ${t(p.ranked ? 'ranked' : 'casual')}` : ''}\n          </small>",
    "            {p.mode === 'online' ? ` · ${t(p.ranked ? 'ranked' : 'casual')}` : ''}\n            {timeControl.mode === 'turn' ? ` · ${timeControl.turnMs / 1000}s` : ''}\n          </small>",
)

write('tests/digital-turn-timer.test.ts', r'''import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { OfflineMatch } from '../packages/core/src/offline.ts';
import { clientMessageSchema, type MatchCommand } from '../packages/core/src/protocol.ts';
import {
  beginTurn,
  createClocks,
  remainingTimeMs,
  turnTimeControl,
} from '../packages/core/src/timing.ts';
import { games } from '../packages/games/registry.ts';
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

test('Digital local play supports a 30-second resetting turn timer', () => {
  let now = 0;
  const match = new OfflineMatch(games.get('digitalGame'), 'local', () => now, 3, turnTimeControl(30));
  now = 29000;
  match.move({ type: 'draw' });
  assert.equal(match.current.state.turn, 1);
  assert.deepEqual(match.current.clocks, [30000, 30000, 30000]);
  assert.equal(match.current.turnStartedAt, 29000);
  now = 58999;
  assert.equal(match.tick().result, null);
  now = 59000;
  assert.equal(match.tick().result?.reason, 'timeout');
  assert.notEqual(match.current.result?.winner, 1);
});

test('authoritative Digital matches reset a selected 45-second timer after each move', () => {
  let now = 0;
  const store = new Store(),
    service = new MatchService(store, games, { now: () => now }),
    a = user(store, 'A'),
    b = user(store, 'B'),
    c = user(store, 'C');
  try {
    let match = service.create('digitalGame', [a.id, b.id, c.id], false, turnTimeControl(45));
    assert.deepEqual(match.timeControl, turnTimeControl(45));
    now = 20000;
    match = service.command(a.id, {
      type: 'move',
      matchId: match.id,
      commandId: randomUUID(),
      expectedRevision: match.revision,
      move: { type: 'draw' },
    } as MatchCommand);
    assert.equal(match.state.turn, 1);
    assert.deepEqual(match.clockMs, [45000, 45000, 45000]);
    now = 64999;
    assert.equal(service.get(match.id, b.id).result, null);
    now = 65000;
    const finished = service.get(match.id, b.id);
    assert.equal(finished.result?.reason, 'timeout');
    assert.notEqual(finished.result?.winner, 1);
  } finally {
    store.close();
  }
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
  assert.equal(
    clientMessageSchema.parse({
      type: 'queue',
      gameId: 'digitalGame',
      ranked: false,
      playerCount: 4,
      turnSeconds: 60,
    }).turnSeconds,
    60,
  );
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
