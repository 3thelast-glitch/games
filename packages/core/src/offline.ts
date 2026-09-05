import { RuleError, opponent, type BaseState, type GamePlugin } from './game.ts';
import type { MatchResult } from './protocol.ts';
export interface OfflineSnapshot {
  state: BaseState;
  clocks: [number, number];
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
  ) {
    const nowValue = now();
    this.current = {
      state: game.create(),
      clocks: [600000, 600000],
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
  move(input: unknown) {
    this.tick();
    if (this.current.result) throw new RuleError('game-over');
    const next = this.game.apply(this.current.state, input);
    this.history.push(structuredClone(this.current));
    this.charge();
    this.current = { ...this.current, state: next };
    if (next.winner !== null) this.finish(next.winner, this.game.winReason);
    return this.current;
  }
  tick() {
    const c = this.current;
    if (!c.result && c.clocks[c.state.turn] - (this.now() - c.turnStartedAt) <= 0)
      this.finish(opponent(c.state.turn), 'timeout');
    return this.current;
  }
  finish(winner: 0 | 1 | null, reason: MatchResult['reason']) {
    if (this.current.result) return;
    this.charge();
    this.current = {
      ...this.current,
      endedAt: this.now(),
      result: { winner, reason, ratingDelta: [0, 0] },
    };
  }
  undo() {
    if (this.mode !== 'local') throw new RuleError('undo-local-only');
    const previous = this.history.pop();
    if (previous) this.current = { ...previous, turnStartedAt: this.now() };
    return this.current;
  }
}
