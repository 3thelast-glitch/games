export type Player = 0 | 1;
export type Difficulty = 'easy' | 'medium' | 'hard';
export const opponent = (player: Player): Player => (player === 0 ? 1 : 0);
export interface BaseState {
  gameId: string;
  turn: Player;
  ply: number;
  winner: Player | null;
  /** Automatic board draw, absent for legacy snapshots and ongoing games. */
  drawReason?: string | null;
}
export const isGameOver = (state: BaseState) => state.winner !== null || !!state.drawReason;
export class RuleError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = 'RuleError';
  }
}
export type Validation = { ok: true } | { ok: false; code: string };
export interface RulesEngine<S extends BaseState, M> {
  id: string;
  /** Translation key supplied by the game, not a core-owned list of victory conditions. */
  winReason: string;
  create(): S;
  parseMove(input: unknown): M;
  validate(state: S, move: M): Validation;
  apply(state: S, move: M): S;
  legalMoves(state: S): M[];
  evaluate(state: S, player: Player): number;
  /** Optional online projection used to hide private information from the other seat. */
  view?(state: S, player: Player): S;
}
// The only type-erasure boundary. Core services consume this interface and never import a game.
export interface GamePlugin {
  id: string;
  winReason: string;
  create(): BaseState;
  parseMove(input: unknown): unknown;
  apply(state: BaseState, move: unknown): BaseState;
  legalMoves(state: BaseState): unknown[];
  evaluate(state: BaseState, player: Player): number;
  view?(state: BaseState, player: Player): BaseState;
}
export function asPlugin<S extends BaseState, M>(engine: RulesEngine<S, M>): GamePlugin {
  return {
    id: engine.id,
    winReason: engine.winReason,
    create: engine.create,
    parseMove: engine.parseMove,
    apply: (state, move) => engine.apply(state as S, engine.parseMove(move)),
    legalMoves: (state) => engine.legalMoves(state as S),
    evaluate: (state, player) => engine.evaluate(state as S, player),
    view: engine.view ? (state, player) => engine.view!(state as S, player) : undefined,
  };
}
export class GameRegistry {
  private games = new Map<string, GamePlugin>();
  register(game: GamePlugin) {
    if (this.games.has(game.id)) throw new Error(`Duplicate game: ${game.id}`);
    this.games.set(game.id, game);
    return this;
  }
  get(id: string): GamePlugin {
    const game = this.games.get(id);
    if (!game) throw new RuleError('unknown-game');
    return game;
  }
  ids() {
    return [...this.games.keys()];
  }
}
export class LocalGameController {
  state: BaseState;
  private history: BaseState[] = [];
  constructor(public readonly game: GamePlugin) {
    this.state = game.create();
  }
  move(input: unknown) {
    const next = this.game.apply(this.state, input);
    this.history.push(this.state);
    this.state = next;
    return next;
  }
  undo() {
    const previous = this.history.pop();
    if (previous) this.state = previous;
    return this.state;
  }
  get canUndo() {
    return this.history.length > 0;
  }
  restart() {
    this.history = [];
    this.state = this.game.create();
    return this.state;
  }
}
