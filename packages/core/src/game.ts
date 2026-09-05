export type Player = 0 | 1;
export type Seat = 0 | 1 | 2 | 3;
export type PlayerCount = 2 | 3 | 4;
export type Difficulty = 'easy' | 'medium' | 'hard';
export const opponent = (player: Player): Player => (player === 0 ? 1 : 0);
export const seats = (count: number): Seat[] =>
  Array.from({ length: Math.max(0, Math.min(4, count)) }, (_, index) => index as Seat);
export const nextSeat = (seat: Seat, count: number): Seat =>
  (((seat + 1) % Math.max(2, Math.min(4, count))) as Seat);
export interface BaseState {
  gameId: string;
  turn: Seat;
  ply: number;
  winner: Seat | null;
  /** Number of seats for variable-player games. Legacy two-player states may omit it. */
  playerCount?: PlayerCount;
  /** Automatic board draw, absent for legacy snapshots and ongoing games. */
  drawReason?: string | null;
}
export interface TwoPlayerState extends BaseState {
  turn: Player;
  winner: Player | null;
  playerCount?: 2;
}
export const isGameOver = (state: BaseState) => state.winner !== null || !!state.drawReason;
export class RuleError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = 'RuleError';
  }
}
export type Validation = { ok: true } | { ok: false; code: string };
export interface RulesEngine<S extends BaseState, M, P extends Seat = Player> {
  id: string;
  /** Supported seat range. Games that omit these values remain strictly two-player. */
  minPlayers?: PlayerCount;
  maxPlayers?: PlayerCount;
  /** Translation key supplied by the game, not a core-owned list of victory conditions. */
  winReason: string;
  create(playerCount?: PlayerCount): S;
  parseMove(input: unknown): M;
  validate(state: S, move: M): Validation;
  apply(state: S, move: M): S;
  legalMoves(state: S): M[];
  evaluate(state: S, player: P): number;
  /** Optional online projection used to hide private information from other seats. */
  view?(state: S, player: P): S;
}
// The only type-erasure boundary. Core services consume this interface and never import a game.
export interface GamePlugin {
  id: string;
  minPlayers: PlayerCount;
  maxPlayers: PlayerCount;
  winReason: string;
  create(playerCount?: PlayerCount): BaseState;
  parseMove(input: unknown): unknown;
  apply(state: BaseState, move: unknown): BaseState;
  legalMoves(state: BaseState): unknown[];
  evaluate(state: BaseState, player: Seat): number;
  view?(state: BaseState, player: Seat): BaseState;
}
export function asPlugin<S extends BaseState, M, P extends Seat = Player>(
  engine: RulesEngine<S, M, P>,
): GamePlugin {
  return {
    id: engine.id,
    minPlayers: engine.minPlayers ?? 2,
    maxPlayers: engine.maxPlayers ?? 2,
    winReason: engine.winReason,
    create: (playerCount) => engine.create(playerCount),
    parseMove: engine.parseMove,
    apply: (state, move) => engine.apply(state as S, engine.parseMove(move)),
    legalMoves: (state) => engine.legalMoves(state as S),
    evaluate: (state, player) => engine.evaluate(state as S, player as P),
    view: engine.view ? (state, player) => engine.view!(state as S, player as P) : undefined,
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
    this.state = game.create(game.minPlayers);
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
    this.state = this.game.create(this.game.minPlayers);
    return this.state;
  }
}
