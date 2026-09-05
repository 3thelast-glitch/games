import {
  RuleError,
  seats,
  type BaseState,
  type GamePlugin,
  type PlayerCount,
  type Seat,
} from './game.ts';
import type { MatchResult } from './protocol.ts';
import {
  bankTimeControl,
  beginTurn,
  chargeClock,
  createClocks,
  remainingTimeMs,
  type TimeControl,
} from './timing.ts';
export interface OfflineSnapshot {
  state: BaseState;
  clocks: number[];
  timeControl?: TimeControl;
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
    readonly timeControl: TimeControl = bankTimeControl(600000),
  ) {
    const nowValue = now();
    this.current = {
      state: game.create(playerCount),
      clocks: createClocks(this.timeControl, playerCount),
      timeControl: this.timeControl,
      turnStartedAt: nowValue,
      createdAt: nowValue,
      endedAt: null,
      result: null,
    };
  }
  private control(): TimeControl {
    return this.current.timeControl ?? this.timeControl;
  }
  private charge() {
    const c = this.current,
      now = this.now();
    c.clocks = chargeClock(this.control(), c.clocks, c.state.turn, c.turnStartedAt, now);
    c.turnStartedAt = now;
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
    const previousTurn = this.current.state.turn,
      next = this.game.apply(this.current.state, input);
    this.history.push(structuredClone(this.current));
    this.charge();
    this.current = { ...this.current, state: next };
    if (next.winner !== null) this.finish(next.winner, this.game.winReason);
    else if (next.drawReason) this.finish(null, next.drawReason);
    else this.current.clocks = beginTurn(this.control(), this.current.clocks, previousTurn, next.turn);
    return this.current;
  }
  tick() {
    const c = this.current;
    if (
      !c.result &&
      remainingTimeMs(this.control(), c.clocks, c.state.turn, c.state.turn, c.turnStartedAt, this.now()) <= 0
    )
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
