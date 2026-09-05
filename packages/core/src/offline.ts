import {
  RuleError,
  seats,
  type BaseState,
  type GamePlugin,
  type PlayerCount,
  type Seat,
} from './game.ts';
import type { MatchResult } from './protocol.ts';
export interface OfflineSnapshot {
  state: BaseState;
  clocks: number[];
  turnStartedAt: number;
  createdAt: number;
  endedAt: number | null;
  result: MatchResult | null;
}
export class OfflineMatch {
  current: OfflineSnapshot;
  history: OfflineSnapshot[] = [];
  constructor(
    readonly game: GamePlugin,
    readonly mode: 'local' | 'ai',
    readonly now: () => number = Date.now,
    readonly playerCount: PlayerCount = 2,
  ) {
    const nowValue = now();
    this.current = {
      state: game.create(playerCount),
      clocks: Array.from({ length: playerCount }, () => 600000),
      turnStartedAt: nowValue,
      createdAt: nowValue,
      endedAt: null,
      result: null,
    };
  }
  private charge() {
    const c = this.current;
    c.clocks = [...c.clocks];
    c.clocks[c.state.turn] = Math.max(0, c.clocks[c.state.turn] - (this.now() - c.turnStartedAt));
    c.turnStartedAt = this.now();
  }
  private bestRemaining(loser: Seat): Seat {
    const candidates = seats(this.current.clocks.length).filter((seat) => seat !== loser);
    return candidates.sort(
      (a, b) => this.game.evaluate(this.current.state, b) - this.game.evaluate(this.current.state, a),
    )[0];
  }
  move(input: unknown) {
    this.tick();
    if (this.current.result) throw new RuleError('game-over');
    const next = this.game.apply(this.current.state, input);
    this.history.push(structuredClone(this.current));
    this.charge();
    this.current = { ...this.current, state: next };
    if (next.winner !== null) this.finish(next.winner, this.game.winReason);
    else if (next.drawReason) this.finish(null, next.drawReason);
    return this.current;
  }
  tick() {
    const c = this.current;
    if (!c.result && c.clocks[c.state.turn] - (this.now() - c.turnStartedAt) <= 0)
      this.finish(this.bestRemaining(c.state.turn), 'timeout');
    return this.current;
  }
  finish(winner: Seat | null, reason: MatchResult['reason']) {
    if (this.current.result) return;
    this.charge();
    this.current = {
      ...this.current,
      endedAt: this.now(),
      result: { winner, reason, ratingDelta: this.current.clocks.map(() => 0) },
    };
  }
  undo() {
    if (this.mode !== 'local') throw new RuleError('undo-local-only');
    const previous = this.history.pop();
    if (previous) this.current = { ...previous, turnStartedAt: this.now() };
    return this.current;
  }
}
