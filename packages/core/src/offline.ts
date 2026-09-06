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
  classicDigitalTurnTimeControl,
  createClocks,
  timeoutAt,
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
  readonly timeControl: TimeControl;
  constructor(
    readonly game: GamePlugin,
    readonly mode: 'local' | 'ai',
    readonly now: () => number = Date.now,
    readonly playerCount: PlayerCount = 2,
    requestedTimeControl: TimeControl = bankTimeControl(600000),
  ) {
    this.timeControl = game.id === 'digitalGame' ? classicDigitalTurnTimeControl() : requestedTimeControl;
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
  private charge(at = this.now()) {
    const c = this.current;
    c.clocks = chargeClock(this.control(), c.clocks, c.state.turn, c.turnStartedAt, at);
    c.turnStartedAt = at;
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
    const previousState = this.current.state,
      previousTurn = previousState.turn,
      metadata = this.game.isTurnMetadataMove?.(input) ?? false,
      next = this.game.apply(previousState, input);
    if (metadata) {
      if (next.turn !== previousTurn || next.ply !== previousState.ply)
        throw new RuleError('invalid-turn-metadata');
      this.current = { ...this.current, state: next };
      return this.current;
    }
    this.history.push(structuredClone(this.current));
    this.charge();
    this.current = { ...this.current, state: next };
    if (next.winner !== null) this.finish(next.winner, this.game.winReason);
    else if (next.drawReason) this.finish(null, next.drawReason);
    else this.current.clocks = beginTurn(this.control(), this.current.clocks, previousTurn, next.turn);
    return this.current;
  }
  private applyTimeoutMove(at: number): boolean {
    const automatic = this.game.timeoutMove;
    if (automatic === undefined) return false;
    const previousTurn = this.current.state.turn;
    this.history.push(structuredClone(this.current));
    this.charge(at);
    const next = this.game.apply(this.current.state, automatic);
    this.current = { ...this.current, state: next };
    if (next.winner !== null) this.finish(next.winner, this.game.winReason, at);
    else if (next.drawReason) this.finish(null, next.drawReason, at);
    else this.current.clocks = beginTurn(this.control(), this.current.clocks, previousTurn, next.turn);
    return true;
  }
  tick() {
    const now = this.now();
    for (let safety = 0; safety < 256 && !this.current.result; safety++) {
      const c = this.current,
        deadline = timeoutAt(this.control(), c.clocks, c.state.turn, c.turnStartedAt);
      if (deadline > now) break;
      if (this.applyTimeoutMove(deadline)) continue;
      this.finish(this.bestRemaining(c.state.turn), 'timeout', deadline);
      break;
    }
    return this.current;
  }
  finish(winner: Seat | null, reason: MatchResult['reason'], at = this.now()) {
    if (this.current.result) return;
    this.charge(at);
    this.current = {
      ...this.current,
      endedAt: at,
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