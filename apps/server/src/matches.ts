import { randomUUID } from 'node:crypto';
import {
  GameRegistry,
  RuleError,
  opponent,
  seats,
  type Player,
  type PlayerCount,
  type Seat,
} from '../../../packages/core/src/game.ts';
import type { MatchSnapshot, MatchCommand, ResultReason } from '../../../packages/core/src/protocol.ts';
import {
  bankTimeControl,
  beginTurn,
  chargeClock,
  createClocks,
  isTurnTimerMs,
  timeoutAt,
  type TimeControl,
} from '../../../packages/core/src/timing.ts';
import { compareAndSwapMatch } from './match-cas.ts';
import { Store, digest } from './store.ts';
export interface StoredMatch extends Omit<MatchSnapshot, 'serverNow'> {
  commands: Record<string, { fingerprint: string; revision: number }>;
}
export interface MatchOptions {
  clockMs: number;
  graceMs: number;
  now: () => number;
}
export class MatchService {
  readonly options: MatchOptions;
  constructor(readonly store: Store, readonly games: GameRegistry, options: Partial<MatchOptions> = {}) {
    this.options = { clockMs: 600000, graceMs: 60000, now: Date.now, ...options };
  }
  private control(gameId: string, requested?: TimeControl): TimeControl {
    const control = requested ?? bankTimeControl(this.options.clockMs);
    if (control.mode === 'bank') {
      if (!Number.isFinite(control.initialMs) || control.initialMs < 1000)
        throw new RuleError('invalid-time-control');
      return control;
    }
    if (gameId !== 'digitalGame' || !isTurnTimerMs(control.turnMs))
      throw new RuleError('turn-timer-not-supported');
    return control;
  }
  private controlOf(match: Pick<StoredMatch, 'gameId' | 'timeControl'>): TimeControl {
    return this.control(match.gameId, match.timeControl);
  }
  create(gameId: string, users: string[], ranked = false, requestedTimeControl?: TimeControl): MatchSnapshot {
    const game = this.games.get(gameId),
      timeControl = this.control(gameId, requestedTimeControl);
    if (users.length < game.minPlayers || users.length > game.maxPlayers)
      throw new RuleError('player-count-not-supported');
    if (new Set(users).size !== users.length) throw new RuleError('cannot-play-yourself');
    if (this.store.activeMatches().some((m) => m.players.some((p) => users.includes(p.id))))
      throw new RuleError('already-in-match');
    if (ranked && users.some((u) => this.store.user(u).guest)) throw new RuleError('ranked-requires-account');
    const now = this.options.now(),
      playerCount = users.length as PlayerCount;
    const m: StoredMatch = {
      id: randomUUID(),
      gameId,
      players: users.map((user) => this.store.publicPlayer(user, gameId)),
      state: game.create(playerCount),
      ranked,
      revision: 0,
      clockMs: createClocks(timeControl, users.length),
      timeControl,
      turnStartedAt: now,
      createdAt: now,
      endedAt: null,
      result: null,
      disconnectedAt: users.map(() => null),
      graceMs: this.options.graceMs,
      drawOffer: null,
      drawAccepts: [],
      commands: {},
      rematchVotes: [],
      rematchId: null,
    };
    this.store.saveMatch(m);
    return this.snapshot(m);
  }
  seat(match: StoredMatch, userId: string): Seat {
    const index = match.players.findIndex((p) => p.id === userId);
    if (index < 0 || index > 3) throw new RuleError('not-in-match');
    return index as Seat;
  }
  snapshot(match: StoredMatch): MatchSnapshot {
    const { commands, ...publicMatch } = match;
    return { ...publicMatch, timeControl: this.controlOf(match), serverNow: this.options.now() };
  }
  forUser(match: MatchSnapshot, userId: string): MatchSnapshot {
    const index = match.players.findIndex((player) => player.id === userId);
    if (index < 0 || index > 3) throw new RuleError('not-in-match');
    const game = this.games.get(match.gameId);
    return game.view ? { ...match, state: game.view(match.state, index as Seat) } : match;
  }
  get(id: string, userId: string): MatchSnapshot {
    let m = this.store.loadMatch(id);
    this.seat(m, userId);
    m = this.expire(m);
    return this.snapshot(m);
  }
  activeFor(userId: string): MatchSnapshot | null {
    const m = this.store.activeMatches().find((match) => match.players.some((p) => p.id === userId));
    return m ? this.get(m.id, userId) : null;
  }
  private bestRemaining(m: StoredMatch, excluded: Seat[]): Seat {
    const available = seats(m.players.length).filter((seat) => !excluded.includes(seat));
    if (!available.length) throw new RuleError('no-remaining-player');
    return available.sort(
      (a, b) => this.games.get(m.gameId).evaluate(m.state, b) - this.games.get(m.gameId).evaluate(m.state, a),
    )[0];
  }
  private finish(m: StoredMatch, winner: Seat | null, reason: ResultReason, at = this.options.now()) {
    if (m.result) return m;
    m.clockMs = chargeClock(this.controlOf(m), m.clockMs, m.state.turn, m.turnStartedAt, at);
    m.turnStartedAt = at;
    m.endedAt = at;
    m.state = { ...m.state, winner };
    m.result = { winner, reason, ratingDelta: m.players.map(() => 0) };
    m.drawOffer = null;
    m.drawAccepts = [];
    m.revision++;
    this.store.settle(m);
    return m;
  }
  private applyTimeoutMove(m: StoredMatch, at: number): StoredMatch | null {
    const game = this.games.get(m.gameId),
      automatic = game.timeoutMove;
    if (automatic === undefined) return null;
    const expectedRevision = m.revision,
      previousTurn = m.state.turn;
    m.clockMs = chargeClock(this.controlOf(m), m.clockMs, previousTurn, m.turnStartedAt, at);
    m.turnStartedAt = at;
    const next = game.apply(m.state, automatic);
    m.state = next;
    m.revision++;
    m.drawOffer = null;
    m.drawAccepts = [];
    if (next.winner !== null) return this.finish(m, next.winner, game.winReason, at);
    if (next.drawReason) return this.finish(m, null, next.drawReason, at);
    m.clockMs = beginTurn(this.controlOf(m), m.clockMs, previousTurn, next.turn);
    if (!compareAndSwapMatch(this.store, m, expectedRevision)) return this.store.loadMatch(m.id);
    return m;
  }
  expire(m: StoredMatch): StoredMatch {
    if (m.result) return m;
    const now = this.options.now();
    for (let safety = 0; safety < 256 && !m.result; safety++) {
      const deadlines: { at: number; loser: Seat; reason: 'timeout' | 'disconnect' }[] = [
        { at: timeoutAt(this.controlOf(m), m.clockMs, m.state.turn, m.turnStartedAt), loser: m.state.turn, reason: 'timeout' },
      ];
      for (const seat of seats(m.players.length))
        if (m.disconnectedAt[seat] !== null)
          deadlines.push({ at: m.disconnectedAt[seat]! + m.graceMs, loser: seat, reason: 'disconnect' });
      deadlines.sort((a, b) => a.at - b.at);
      const first = deadlines[0];
      if (first.at > now) return m;
      if (first.reason === 'timeout') {
        const advanced = this.applyTimeoutMove(m, first.at);
        if (advanced) {
          m = advanced;
          continue;
        }
        return this.finish(m, this.bestRemaining(m, [first.loser]), 'timeout', first.at);
      }
      const simultaneous = deadlines
        .filter((deadline) => deadline.reason === 'disconnect' && deadline.at === first.at)
        .map((deadline) => deadline.loser);
      if (simultaneous.length === m.players.length) return this.finish(m, null, 'abandoned', first.at);
      return this.finish(m, this.bestRemaining(m, simultaneous), 'disconnect', first.at);
    }
    return m;
  }
  command(userId: string, command: MatchCommand): MatchSnapshot {
    let m = this.store.loadMatch(command.matchId);
    const seat = this.seat(m, userId);
    const key = `${userId}:${command.commandId}`,
      fingerprint = digest(JSON.stringify(command)),
      old = m.commands[key];
    if (old) {
      if (old.fingerprint !== fingerprint) throw new RuleError('command-id-reused');
      return this.snapshot(this.expire(m));
    }
    m = this.expire(m);
    if (m.result) throw new RuleError('game-over');
    if (command.expectedRevision !== m.revision) throw new RuleError('stale-revision');
    const now = this.options.now();
    if (command.type === 'move') {
      if (m.state.turn !== seat) throw new RuleError('not-your-turn');
      const game = this.games.get(m.gameId),
        previousState = m.state,
        previousTurn = previousState.turn,
        metadata = game.isTurnMetadataMove?.(command.move) ?? false,
        next = game.apply(previousState, command.move);
      if (metadata) {
        if (next.turn !== previousTurn || next.ply !== previousState.ply)
          throw new RuleError('invalid-turn-metadata');
        m.state = next;
        m.commands[key] = { fingerprint, revision: m.revision };
        this.store.saveMatch(m);
        return this.snapshot(m);
      }
      m.clockMs = chargeClock(this.controlOf(m), m.clockMs, seat, m.turnStartedAt, now);
      m.turnStartedAt = now;
      m.state = next;
      m.revision++;
      m.drawOffer = null;
      m.drawAccepts = [];
      m.commands[key] = { fingerprint, revision: m.revision };
      if (next.winner !== null)
        return this.snapshot(this.finish(m, next.winner, game.winReason, now));
      if (next.drawReason) return this.snapshot(this.finish(m, null, next.drawReason, now));
      m.clockMs = beginTurn(this.controlOf(m), m.clockMs, previousTurn, next.turn);
    } else if (command.type === 'resign') {
      m.commands[key] = { fingerprint, revision: m.revision + 1 };
      const winner =
        m.players.length === 2 ? opponent(seat as Player) : this.bestRemaining(m, [seat]);
      return this.snapshot(this.finish(m, winner, 'resignation', now));
    } else if (command.type === 'draw-offer') {
      if (m.drawOffer !== null) throw new RuleError('draw-already-offered');
      m.drawOffer = seat;
      m.drawAccepts = [seat];
      m.revision++;
    } else {
      if (m.drawOffer === null || m.drawOffer === seat) throw new RuleError('no-opponent-draw-offer');
      if (!command.accept) {
        m.drawOffer = null;
        m.drawAccepts = [];
        m.revision++;
      } else {
        if (!m.drawAccepts.includes(seat)) m.drawAccepts.push(seat);
        if (m.drawAccepts.length === m.players.length) {
          m.commands[key] = { fingerprint, revision: m.revision + 1 };
          return this.snapshot(this.finish(m, null, 'agreement', now));
        }
        m.revision++;
      }
    }
    m.commands[key] = { fingerprint, revision: m.revision };
    this.store.saveMatch(m);
    return this.snapshot(m);
  }
  connection(userId: string, connected: boolean): MatchSnapshot[] {
    const result: MatchSnapshot[] = [];
    for (let m of this.store.activeMatches().filter((match) => match.players.some((p) => p.id === userId))) {
      m = this.expire(m);
      if (!m.result) {
        const seat = this.seat(m, userId);
        m.disconnectedAt[seat] = connected ? null : (m.disconnectedAt[seat] ?? this.options.now());
        this.store.saveMatch(m);
      }
      result.push(this.snapshot(m));
    }
    return result;
  }
  recoverAfterRestart() {
    const now = this.options.now();
    for (const m of this.store.activeMatches()) {
      m.disconnectedAt = m.disconnectedAt.map((at) => at ?? now);
      this.store.saveMatch(m);
    }
  }
  tick(): MatchSnapshot[] {
    return this.store.activeMatches().map((m) => this.snapshot(this.expire(m)));
  }
  rematch(userId: string, id: string): MatchSnapshot {
    const m = this.store.loadMatch(id),
      seat = this.seat(m, userId);
    if (!m.result) throw new RuleError('match-still-active');
    if (m.rematchId) return this.get(m.rematchId, userId);
    if (!m.rematchVotes.includes(seat)) m.rematchVotes.push(seat);
    if (m.rematchVotes.length === m.players.length) {
      const users = [...m.players.slice(1).map((player) => player.id), m.players[0].id];
      const next = this.create(m.gameId, users, m.ranked, this.controlOf(m));
      m.rematchId = next.id;
      this.store.saveMatch(m);
      return next;
    }
    this.store.saveMatch(m);
    return this.snapshot(m);
  }
}
