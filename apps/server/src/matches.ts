import { randomUUID } from 'node:crypto';
import { GameRegistry, RuleError, opponent, type Player } from '../../../packages/core/src/game.ts';
import type {
  MatchSnapshot,
  MatchCommand,
  ResultReason,
} from '../../../packages/core/src/protocol.ts';
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
  constructor(
    readonly store: Store,
    readonly games: GameRegistry,
    options: Partial<MatchOptions> = {},
  ) {
    this.options = {
      clockMs: 600000,
      graceMs: 60000,
      now: Date.now,
      ...options,
    };
  }
  create(gameId: string, users: [string, string], ranked = false): MatchSnapshot {
    const game = this.games.get(gameId);
    if (users[0] === users[1]) throw new RuleError('cannot-play-yourself');
    if (this.store.activeMatches().some((m) => m.players.some((p) => users.includes(p.id))))
      throw new RuleError('already-in-match');
    if (ranked && users.some((u) => this.store.user(u).guest))
      throw new RuleError('ranked-requires-account');
    const now = this.options.now();
    const m: StoredMatch = {
      id: randomUUID(),
      gameId,
      players: [
        this.store.publicPlayer(users[0], gameId),
        this.store.publicPlayer(users[1], gameId),
      ],
      state: game.create(),
      ranked,
      revision: 0,
      clockMs: [this.options.clockMs, this.options.clockMs],
      turnStartedAt: now,
      createdAt: now,
      endedAt: null,
      result: null,
      disconnectedAt: [null, null],
      graceMs: this.options.graceMs,
      drawOffer: null,
      commands: {},
      rematchVotes: [],
      rematchId: null,
    };
    this.store.saveMatch(m);
    return this.snapshot(m);
  }
  seat(match: StoredMatch, userId: string): Player {
    const i = match.players.findIndex((p) => p.id === userId);
    if (i !== 0 && i !== 1) throw new RuleError('not-in-match');
    return i;
  }
  snapshot(match: StoredMatch): MatchSnapshot {
    const { commands, ...publicMatch } = match;
    return { ...publicMatch, serverNow: this.options.now() };
  }
  get(id: string, userId: string): MatchSnapshot {
    let m = this.store.loadMatch(id);
    this.seat(m, userId);
    m = this.expire(m);
    return this.snapshot(m);
  }
  activeFor(userId: string): MatchSnapshot | null {
    const m = this.store.activeMatches().find((m) => m.players.some((p) => p.id === userId));
    return m ? this.get(m.id, userId) : null;
  }
  private finish(
    m: StoredMatch,
    winner: Player | null,
    reason: ResultReason,
    at = this.options.now(),
  ) {
    if (m.result) return m;
    m.clockMs[m.state.turn] = Math.max(
      0,
      m.clockMs[m.state.turn] - Math.max(0, at - m.turnStartedAt),
    );
    m.turnStartedAt = at;
    m.endedAt = at;
    m.state = { ...m.state, winner };
    m.result = { winner, reason, ratingDelta: [0, 0] };
    m.drawOffer = null;
    m.revision++;
    this.store.settle(m);
    return m;
  }
  expire(m: StoredMatch): StoredMatch {
    if (m.result) return m;
    const now = this.options.now();
    const deadlines: {
      at: number;
      loser: Player;
      reason: 'timeout' | 'disconnect';
    }[] = [
      {
        at: m.turnStartedAt + m.clockMs[m.state.turn],
        loser: m.state.turn,
        reason: 'timeout',
      },
    ];
    for (const p of [0, 1] as const)
      if (m.disconnectedAt[p] !== null)
        deadlines.push({
          at: m.disconnectedAt[p]! + m.graceMs,
          loser: p,
          reason: 'disconnect',
        });
    deadlines.sort((a, b) => a.at - b.at);
    const first = deadlines[0];
    if (first.at > now) return m;
    const both =
      first.reason === 'disconnect' &&
      deadlines.some((d) => d !== first && d.reason === 'disconnect' && d.at === first.at);
    return this.finish(
      m,
      both ? null : opponent(first.loser),
      both ? 'abandoned' : first.reason,
      first.at,
    );
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
      const next = this.games.get(m.gameId).apply(m.state, command.move);
      m.clockMs[seat] = Math.max(0, m.clockMs[seat] - Math.max(0, now - m.turnStartedAt));
      m.turnStartedAt = now;
      m.state = next;
      m.revision++;
      m.drawOffer = null;
      m.commands[key] = { fingerprint, revision: m.revision };
      if (next.winner !== null)
        return this.snapshot(this.finish(m, next.winner, this.games.get(m.gameId).winReason, now));
<<<<<<< HEAD
=======
      if (next.drawReason) return this.snapshot(this.finish(m, null, next.drawReason, now));
>>>>>>> 86095ba4b22459c5703fc305861ae0c76432fe97
    } else if (command.type === 'resign') {
      m.commands[key] = { fingerprint, revision: m.revision + 1 };
      return this.snapshot(this.finish(m, opponent(seat), 'resignation', now));
    } else if (command.type === 'draw-offer') {
      if (m.drawOffer !== null) throw new RuleError('draw-already-offered');
      m.drawOffer = seat;
      m.revision++;
    } else {
      if (m.drawOffer === null || m.drawOffer === seat)
        throw new RuleError('no-opponent-draw-offer');
      if (command.accept) {
        m.commands[key] = { fingerprint, revision: m.revision + 1 };
        return this.snapshot(this.finish(m, null, 'agreement', now));
      }
      m.drawOffer = null;
      m.revision++;
    }
    m.commands[key] = { fingerprint, revision: m.revision };
    this.store.saveMatch(m);
    return this.snapshot(m);
  }
  connection(userId: string, connected: boolean): MatchSnapshot[] {
    const result: MatchSnapshot[] = [];
    for (let m of this.store
      .activeMatches()
      .filter((m) => m.players.some((p) => p.id === userId))) {
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
      m.disconnectedAt = m.disconnectedAt.map((at) => at ?? now) as [number, number];
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
    if (m.rematchVotes.length === 2) {
      const next = this.create(m.gameId, [m.players[1].id, m.players[0].id], m.ranked);
      m.rematchId = next.id;
      this.store.saveMatch(m);
      return next;
    }
    this.store.saveMatch(m);
    return this.snapshot(m);
  }
}
