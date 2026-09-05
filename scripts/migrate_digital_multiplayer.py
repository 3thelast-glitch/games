from pathlib import Path
import re

ROOT = Path('.')

def write(path: str, content: str):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content.rstrip() + '\n', encoding='utf-8')

def replace(path: str, old: str, new: str):
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise RuntimeError(f'missing replacement in {path}: {old[:120]!r}')
    text = text.replace(old, new, 1)
    p.write_text(text, encoding='utf-8')

def regex_replace(path: str, pattern: str, replacement: str, flags=0):
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    text2, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'regex replacement count {count} in {path}: {pattern[:120]}')
    p.write_text(text2, encoding='utf-8')

write('packages/core/src/game.ts', r'''export type Player = 0 | 1;
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
''')

# Keep every classic game strongly typed as two-player while the shared base state now supports four seats.
for path in [
    'packages/games/abalone/state.ts',
    'packages/games/quoridor/state.ts',
    'packages/games/checkers/state.ts',
    'packages/games/gomoku/state.ts',
    'packages/games/connect-four/state.ts',
    'packages/games/nine-mens-morris/state.ts',
]:
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    text = text.replace('BaseState', 'TwoPlayerState')
    p.write_text(text, encoding='utf-8')

write('packages/core/src/protocol.ts', r'''import { z } from 'zod';
import type { BaseState, PlayerCount, Seat } from './game.ts';
export const PROTOCOL_VERSION = 2;
const id = z.string().min(1).max(80);
const playerCount = z.union([z.literal(2), z.literal(3), z.literal(4)]);
const matchCommand = {
  matchId: id,
  commandId: z.string().min(8).max(80),
  expectedRevision: z.number().int().nonnegative(),
};
export const clientMessageSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('auth'),
      token: z.string().min(20).max(256),
      // v1 remains accepted during the migration window; new clients send v2.
      version: z.union([z.literal(1), z.literal(PROTOCOL_VERSION)]),
    })
    .strict(),
  z.object({ type: z.literal('ping') }).strict(),
  z
    .object({
      type: z.literal('queue'),
      gameId: id,
      ranked: z.boolean(),
      playerCount: playerCount.default(2),
    })
    .strict(),
  z.object({ type: z.literal('cancel') }).strict(),
  z
    .object({
      type: z.literal('create-room'),
      gameId: id,
      playerCount: playerCount.default(2),
    })
    .strict(),
  z
    .object({
      type: z.literal('join-room'),
      code: z.string().regex(/^[A-Z2-9]{6}$/),
    })
    .strict(),
  z.object({ type: z.literal('resume'), matchId: id }).strict(),
  z.object({ type: z.literal('move'), ...matchCommand, move: z.unknown() }).strict(),
  z.object({ type: z.literal('resign'), ...matchCommand }).strict(),
  z.object({ type: z.literal('draw-offer'), ...matchCommand }).strict(),
  z
    .object({
      type: z.literal('draw-answer'),
      ...matchCommand,
      accept: z.boolean(),
    })
    .strict(),
  z.object({ type: z.literal('rematch'), matchId: id }).strict(),
  z
    .object({
      type: z.literal('emote'),
      matchId: id,
      emote: z.enum(['👋', '👏', '🤔', '🔥', '🤝', '🎯']),
    })
    .strict(),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type MatchCommand = Extract<ClientMessage, { commandId: string }>;
export interface PublicPlayer {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  rank: string;
}
export type ResultReason = string;
export interface MatchResult {
  winner: Seat | null;
  reason: ResultReason;
  ratingDelta: number[];
}
export interface MatchSnapshot {
  id: string;
  gameId: string;
  players: PublicPlayer[];
  state: BaseState;
  ranked: boolean;
  revision: number;
  clockMs: number[];
  turnStartedAt: number;
  createdAt: number;
  endedAt: number | null;
  result: MatchResult | null;
  serverNow: number;
  disconnectedAt: (number | null)[];
  graceMs: number;
  drawOffer: Seat | null;
  drawAccepts: Seat[];
  rematchVotes: Seat[];
  rematchId: string | null;
}
export interface HistoryEntry {
  matchId: string;
  gameId: string;
  opponent: string;
  opponents: string[];
  playerCount: number;
  result: 'win' | 'loss' | 'draw';
  reason: ResultReason;
  durationMs: number;
  ratingDelta: number;
  ranked: boolean;
  endedAt: number;
}
export interface Profile {
  id: string;
  name: string;
  avatar: string;
  guest: boolean;
  level: number;
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  favorites: string[];
  ratings: Record<string, { rating: number; rank: string; position: number | null }>;
  history: HistoryEntry[];
  friendCode: string;
  friends: PublicPlayer[];
}
export type ServerMessage =
  | { type: 'ready'; userId: string; serverNow: number }
  | { type: 'pong'; serverNow: number }
  | { type: 'queued'; gameId: string; ranked: boolean; playerCount: PlayerCount }
  | {
      type: 'room';
      code: string;
      expiresAt: number;
      gameId: string;
      playerCount: PlayerCount;
      joined: number;
    }
  | { type: 'cancelled' }
  | { type: 'match'; match: MatchSnapshot; ack?: string }
  | { type: 'error'; code: string; commandId?: string }
  | { type: 'emote'; matchId: string; player: Seat; emote: string };
''')

write('packages/core/src/offline.ts', r'''import {
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
''')

write('packages/games/digital-game/state.ts', r'''import type { BaseState, PlayerCount, Seat } from '../../core/src/game.ts';

export type DigitalColor = 'red' | 'blue' | 'orange' | 'black';
export type MeldType = 'group' | 'run';

export interface DigitalTile {
  id: string;
  value: number | null;
  color: DigitalColor | null;
  copyIndex: 0 | 1 | null;
  isJoker: boolean;
}

export interface DigitalMeld {
  id: string;
  tiles: string[];
  type: MeldType;
}

export interface DigitalGameState extends BaseState {
  gameId: 'digitalGame';
  playerCount: PlayerCount;
  /** Complete catalog on authoritative/local states; projected online states only include visible tiles. */
  tiles: Record<string, DigitalTile>;
  /** One rack per seat. Online projections replace non-viewer IDs with opaque placeholders. */
  racks: string[][];
  rackCounts: number[];
  /** Authoritative/local draw order. Online projections contain count-only placeholders. */
  drawPool: string[];
  table: DigitalMeld[];
  hasCompletedInitialMeld: boolean[];
  scores: number[];
  /** Authoritative shuffle seed. Online projections deliberately replace it with 0. */
  seed: number;
  /** Present only in a projected online state so the UI knows which private rack is visible. */
  viewerSeat?: Seat;
  lastAction: 'commit' | 'draw' | null;
  emptyPoolPasses: number;
}

export interface CommitMeldIntent {
  id?: string;
  tiles: string[];
}

export type DigitalGameMove =
  | { type: 'draw' }
  | {
      type: 'commit';
      table: CommitMeldIntent[];
    };

export const DIGITAL_COLORS: readonly DigitalColor[] = ['red', 'blue', 'orange', 'black'];
export const INITIAL_MELD_POINTS = 30;
export const JOKER_PENALTY = 30;
export const TILES_PER_PLAYER = 14;
export const TOTAL_TILES = 106;

function randomSeed(): number {
  const bytes = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return bytes[0] || 1;
  }
  return (Date.now() ^ 0x9e3779b9) >>> 0 || 1;
}

export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createTileSet(): DigitalTile[] {
  const tiles: DigitalTile[] = [];
  let serial = 0;
  for (const color of DIGITAL_COLORS)
    for (let value = 1; value <= 13; value++)
      for (const copyIndex of [0, 1] as const)
        tiles.push({
          id: `t${String(serial++).padStart(3, '0')}`,
          value,
          color,
          copyIndex,
          isJoker: false,
        });
  tiles.push({ id: `t${String(serial++).padStart(3, '0')}`, value: null, color: null, copyIndex: null, isJoker: true });
  tiles.push({ id: `t${String(serial++).padStart(3, '0')}`, value: null, color: null, copyIndex: null, isJoker: true });
  return tiles;
}

export function shuffleTileIds(ids: string[], seed: number): string[] {
  const out = [...ids];
  const random = seededRandom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createDigitalGame(seed = randomSeed(), playerCount: PlayerCount = 2): DigitalGameState {
  const list = createTileSet();
  const tiles = Object.fromEntries(list.map((tile) => [tile.id, tile]));
  const pool = shuffleTileIds(list.map((tile) => tile.id), seed);
  const racks = Array.from({ length: playerCount }, () => pool.splice(0, TILES_PER_PLAYER));
  return {
    gameId: 'digitalGame',
    playerCount,
    tiles,
    racks,
    rackCounts: racks.map((rack) => rack.length),
    drawPool: pool,
    table: [],
    hasCompletedInitialMeld: Array.from({ length: playerCount }, () => false),
    scores: Array.from({ length: playerCount }, () => 0),
    seed,
    lastAction: null,
    emptyPoolPasses: 0,
    turn: 0,
    ply: 0,
    winner: null,
    drawReason: null,
  };
}

export function createDigitalGameForPlayers(playerCount: PlayerCount = 2): DigitalGameState {
  return createDigitalGame(randomSeed(), playerCount);
}

export const nextPlayer = (player: Seat, playerCount: number = 2): Seat =>
  (((player + 1) % playerCount) as Seat);
''')

write('packages/games/digital-game/rules.ts', r'''import {
  RuleError,
  seats,
  type PlayerCount,
  type RulesEngine,
  type Seat,
  type Validation,
} from '../../core/src/game.ts';
import {
  INITIAL_MELD_POINTS,
  JOKER_PENALTY,
  createDigitalGameForPlayers,
  nextPlayer,
  type CommitMeldIntent,
  type DigitalGameMove,
  type DigitalGameState,
  type DigitalMeld,
  type DigitalTile,
  type MeldType,
} from './state.ts';

export interface ResolvedMeld {
  ok: true;
  type: MeldType;
  score: number;
  representedValues: number[];
}
export interface InvalidMeld {
  ok: false;
  code: string;
}
export type MeldValidation = ResolvedMeld | InvalidMeld;

function invalid(code: string): InvalidMeld {
  return { ok: false, code };
}
function countOf(state: DigitalGameState): PlayerCount {
  return (state.playerCount ?? state.racks.length ?? 2) as PlayerCount;
}
function assertTileIds(state: DigitalGameState, ids: string[]): DigitalTile[] {
  return ids.map((id) => {
    const tile = state.tiles[id];
    if (!tile) throw new RuleError('unknown-tile');
    return tile;
  });
}

export function validateGroup(tiles: DigitalTile[]): MeldValidation {
  if (tiles.length < 3 || tiles.length > 4) return invalid('group-size');
  const numbered = tiles.filter((tile) => !tile.isJoker);
  if (!numbered.length) return invalid('unresolved-joker');
  const value = numbered[0].value!;
  if (numbered.some((tile) => tile.value !== value)) return invalid('group-value');
  const colors = numbered.map((tile) => tile.color!);
  if (new Set(colors).size !== colors.length) return invalid('group-duplicate-color');
  return {
    ok: true,
    type: 'group',
    score: value * tiles.length,
    representedValues: tiles.map(() => value),
  };
}

export function validateRun(tiles: DigitalTile[]): MeldValidation {
  if (tiles.length < 3 || tiles.length > 13) return invalid('run-size');
  const numbered = tiles.filter((tile) => !tile.isJoker);
  if (!numbered.length) return invalid('unresolved-joker');
  const color = numbered[0].color;
  if (numbered.some((tile) => tile.color !== color)) return invalid('run-color');
  const numberedValues = numbered.map((tile) => tile.value!);
  if (new Set(numberedValues).size !== numberedValues.length) return invalid('run-duplicate-number');
  for (let start = 1; start + tiles.length - 1 <= 13; start++) {
    let valid = true;
    const values: number[] = [];
    for (let index = 0; index < tiles.length; index++) {
      const expected = start + index;
      const tile = tiles[index];
      if (!tile.isJoker && tile.value !== expected) {
        valid = false;
        break;
      }
      values.push(expected);
    }
    if (valid)
      return {
        ok: true,
        type: 'run',
        score: values.reduce((sum, value) => sum + value, 0),
        representedValues: values,
      };
  }
  return invalid('run-sequence');
}

export function validateMeld(tiles: DigitalTile[]): MeldValidation {
  const group = validateGroup(tiles);
  if (group.ok) return group;
  const run = validateRun(tiles);
  if (run.ok) return run;
  if (group.code === 'group-value' && run.code === 'run-color') return run;
  return invalid(group.code === 'group-size' ? run.code : group.code);
}

export function validateTable(
  state: Pick<DigitalGameState, 'tiles'>,
  table: CommitMeldIntent[] | DigitalMeld[],
): { ok: true; melds: DigitalMeld[]; score: number } | InvalidMeld {
  const melds: DigitalMeld[] = [];
  let score = 0;
  const ids = new Set<string>();
  const meldIds = new Set<string>();
  for (let index = 0; index < table.length; index++) {
    const input = table[index];
    if (!input.tiles.length) return invalid('empty-meld');
    for (const id of input.tiles) {
      if (ids.has(id)) return invalid('duplicate-tile');
      ids.add(id);
    }
    let tiles: DigitalTile[];
    try {
      tiles = input.tiles.map((id) => {
        const tile = state.tiles[id];
        if (!tile) throw new RuleError('unknown-tile');
        return tile;
      });
    } catch (error) {
      if (error instanceof RuleError) return invalid(error.code);
      throw error;
    }
    const result = validateMeld(tiles);
    if (!result.ok) return result;
    const id = input.id ?? `meld-${index}`;
    if (meldIds.has(id)) return invalid('duplicate-meld-id');
    meldIds.add(id);
    melds.push({ id, tiles: [...input.tiles], type: result.type });
    score += result.score;
  }
  return { ok: true, melds, score };
}

export function tilePenalty(tile: DigitalTile): number {
  return tile.isJoker ? JOKER_PENALTY : tile.value ?? 0;
}
export function rackPenalty(state: DigitalGameState, player: Seat): number {
  return (state.racks[player] ?? []).reduce((sum, id) => sum + tilePenalty(state.tiles[id]), 0);
}
export function calculateRoundScores(
  state: DigitalGameState,
  winner: Seat,
  racks: string[][] = state.racks,
): number[] {
  const scores = racks.map(() => 0);
  let won = 0;
  for (const seat of seats(racks.length)) {
    if (seat === winner) continue;
    const penalty = (racks[seat] ?? []).reduce((sum, id) => sum + tilePenalty(state.tiles[id]), 0);
    scores[seat] = -penalty;
    won += penalty;
  }
  scores[winner] = won;
  return scores;
}

function parseMeld(value: unknown): CommitMeldIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RuleError('invalid-move');
  const meld = value as Record<string, unknown>;
  if (Object.keys(meld).some((key) => !['id', 'tiles'].includes(key))) throw new RuleError('invalid-move');
  if (meld.id !== undefined && (typeof meld.id !== 'string' || !meld.id || meld.id.length > 80))
    throw new RuleError('invalid-move');
  if (
    !Array.isArray(meld.tiles) ||
    meld.tiles.length < 1 ||
    meld.tiles.length > 13 ||
    !meld.tiles.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 80)
  )
    throw new RuleError('invalid-move');
  return { id: meld.id as string | undefined, tiles: [...(meld.tiles as string[])] };
}
export function parseDigitalMove(input: unknown): DigitalGameMove {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RuleError('invalid-move');
  const move = input as Record<string, unknown>;
  if (move.type === 'draw') {
    if (Object.keys(move).some((key) => key !== 'type')) throw new RuleError('invalid-move');
    return { type: 'draw' };
  }
  if (move.type === 'commit') {
    if (Object.keys(move).some((key) => !['type', 'table'].includes(key))) throw new RuleError('invalid-move');
    if (!Array.isArray(move.table) || move.table.length > 80) throw new RuleError('invalid-move');
    return { type: 'commit', table: move.table.map(parseMeld) };
  }
  throw new RuleError('invalid-move');
}

const signature = (tiles: string[]) => [...tiles].sort().join('|');
function initialMeldScore(
  state: DigitalGameState,
  table: CommitMeldIntent[],
  oldTableIds: Set<string>,
): number {
  let score = 0;
  for (const meld of table) {
    if (meld.tiles.some((id) => oldTableIds.has(id))) continue;
    const result = validateMeld(assertTileIds(state, meld.tiles));
    if (!result.ok) throw new RuleError(result.code);
    score += result.score;
  }
  return score;
}
function commitPlan(state: DigitalGameState, move: Extract<DigitalGameMove, { type: 'commit' }>) {
  if (state.winner !== null || state.drawReason) throw new RuleError('game-over');
  const player = state.turn;
  const tableValidation = validateTable(state, move.table);
  if (!tableValidation.ok) throw new RuleError(tableValidation.code);
  const oldTableIds = new Set(state.table.flatMap((meld) => meld.tiles));
  const newTableIds = new Set(move.table.flatMap((meld) => meld.tiles));
  for (const id of oldTableIds) if (!newTableIds.has(id)) throw new RuleError('table-tile-missing');
  const rack = new Set(state.racks[player] ?? []);
  const otherRackTiles = new Set(
    state.racks.flatMap((items, index) => (index === player ? [] : items)),
  );
  const played: string[] = [];
  for (const id of newTableIds) {
    if (oldTableIds.has(id)) continue;
    if (otherRackTiles.has(id)) throw new RuleError('opponent-tile');
    if (!rack.has(id)) throw new RuleError('tile-not-owned');
    played.push(id);
  }
  if (!played.length) throw new RuleError('play-rack-tile');
  if (!state.hasCompletedInitialMeld[player]) {
    const oldSignatures = new Map<string, number>();
    for (const meld of state.table) {
      const key = signature(meld.tiles);
      oldSignatures.set(key, (oldSignatures.get(key) ?? 0) + 1);
    }
    const newSignatures = new Map<string, number>();
    for (const meld of move.table) {
      const key = signature(meld.tiles);
      newSignatures.set(key, (newSignatures.get(key) ?? 0) + 1);
      if (meld.tiles.some((id) => oldTableIds.has(id)) && !oldSignatures.has(key))
        throw new RuleError('initial-table-locked');
    }
    for (const [key, count] of oldSignatures)
      if ((newSignatures.get(key) ?? 0) < count) throw new RuleError('initial-table-locked');
    if (initialMeldScore(state, move.table, oldTableIds) < INITIAL_MELD_POINTS)
      throw new RuleError('initial-meld-30');
  }
  const playedSet = new Set(played);
  const nextRack = (state.racks[player] ?? []).filter((id) => !playedSet.has(id));
  const melds = tableValidation.melds.map((meld, index) => ({
    ...meld,
    id: move.table[index].id ?? `m${state.ply + 1}-${index}`,
  }));
  return { player, played, nextRack, melds };
}
export function validateDigital(state: DigitalGameState, move: DigitalGameMove): Validation {
  try {
    const parsed = parseDigitalMove(move);
    if (parsed.type === 'draw') {
      if (state.winner !== null || state.drawReason) throw new RuleError('game-over');
      return { ok: true };
    }
    commitPlan(state, parsed);
    return { ok: true };
  } catch (error) {
    if (error instanceof RuleError) return { ok: false, code: error.code };
    throw error;
  }
}
function finishBlockedRound(state: DigitalGameState): DigitalGameState {
  const activeSeats = seats(countOf(state));
  const penalties = activeSeats.map((seat) => rackPenalty(state, seat));
  const minimum = Math.min(...penalties);
  const best = activeSeats.filter((seat) => penalties[seat] === minimum);
  if (best.length !== 1) return { ...state, drawReason: 'blocked-round' };
  const winner = best[0];
  return { ...state, winner, scores: calculateRoundScores(state, winner) };
}
export function applyDigital(state: DigitalGameState, input: DigitalGameMove): DigitalGameState {
  const move = parseDigitalMove(input);
  if (state.winner !== null || state.drawReason) throw new RuleError('game-over');
  const player = state.turn;
  const playerCount = countOf(state);
  if (move.type === 'draw') {
    const racks = state.racks.map((rack) => [...rack]);
    const drawPool = [...state.drawPool];
    let emptyPoolPasses = state.emptyPoolPasses;
    if (drawPool.length) {
      const tile = drawPool.pop()!;
      racks[player].push(tile);
      emptyPoolPasses = 0;
    } else emptyPoolPasses++;
    let next: DigitalGameState = {
      ...state,
      playerCount,
      racks,
      rackCounts: racks.map((rack) => rack.length),
      drawPool,
      emptyPoolPasses,
      lastAction: 'draw',
      turn: nextPlayer(player, playerCount),
      ply: state.ply + 1,
    };
    if (!drawPool.length && emptyPoolPasses >= playerCount) next = finishBlockedRound(next);
    return next;
  }
  const plan = commitPlan(state, move);
  const racks = state.racks.map((rack) => [...rack]);
  racks[player] = plan.nextRack;
  const initial = [...state.hasCompletedInitialMeld];
  initial[player] = true;
  const winner = plan.nextRack.length === 0 ? player : null;
  return {
    ...state,
    playerCount,
    table: plan.melds,
    racks,
    rackCounts: racks.map((rack) => rack.length),
    hasCompletedInitialMeld: initial,
    scores: winner === null ? state.scores : calculateRoundScores(state, winner, racks),
    winner,
    turn: winner === null ? nextPlayer(player, playerCount) : player,
    ply: state.ply + 1,
    lastAction: 'commit',
    emptyPoolPasses: 0,
  };
}
function simpleCandidateMelds(state: DigitalGameState, player: Seat): string[][] {
  const rackTiles = (state.racks[player] ?? []).map((id) => state.tiles[id]).filter(Boolean);
  const jokers = rackTiles.filter((tile) => tile.isJoker).map((tile) => tile.id);
  const candidates: string[][] = [];
  for (let value = 1; value <= 13; value++) {
    const byColor = new Map<string, string>();
    for (const tile of rackTiles)
      if (!tile.isJoker && tile.value === value && tile.color && !byColor.has(tile.color))
        byColor.set(tile.color, tile.id);
    const ids = [...byColor.values()];
    if (ids.length >= 3) candidates.push(ids.slice(0, 3));
    if (ids.length === 4) candidates.push(ids);
    if (ids.length === 2 && jokers.length) candidates.push([...ids, jokers[0]]);
  }
  for (const color of ['red', 'blue', 'orange', 'black'] as const) {
    const byValue = new Map<number, string>();
    for (const tile of rackTiles)
      if (!tile.isJoker && tile.color === color && tile.value !== null && !byValue.has(tile.value))
        byValue.set(tile.value, tile.id);
    for (let start = 1; start <= 11; start++) {
      const three = [start, start + 1, start + 2].map((value) => byValue.get(value));
      if (three.every(Boolean)) candidates.push(three as string[]);
      else if (jokers.length && three.filter(Boolean).length === 2) {
        const ids = three.map((id) => id ?? jokers[0]);
        if (new Set(ids).size === 3) candidates.push(ids);
      }
    }
  }
  return candidates;
}
export function digitalLegalMoves(state: DigitalGameState): DigitalGameMove[] {
  if (state.winner !== null || state.drawReason) return [];
  const moves: DigitalGameMove[] = [{ type: 'draw' }];
  const oldTable = state.table.map((meld) => ({ id: meld.id, tiles: [...meld.tiles] }));
  for (const tiles of simpleCandidateMelds(state, state.turn)) {
    const move: DigitalGameMove = { type: 'commit', table: [...oldTable, { tiles }] };
    if (validateDigital(state, move).ok) moves.push(move);
    if (moves.length >= 24) break;
  }
  return moves;
}
export function evaluateDigital(state: DigitalGameState, player: Seat): number {
  if (state.winner === player) return 100000;
  if (state.winner !== null) return -100000;
  const others = seats(countOf(state)).filter((seat) => seat !== player);
  const averagePenalty = others.reduce((sum, seat) => sum + rackPenalty(state, seat), 0) / others.length;
  const averageCount = others.reduce((sum, seat) => sum + state.rackCounts[seat], 0) / others.length;
  const initialLead =
    (state.hasCompletedInitialMeld[player] ? 40 : 0) -
    others.reduce((sum, seat) => sum + (state.hasCompletedInitialMeld[seat] ? 40 : 0), 0) / others.length;
  return (averagePenalty - rackPenalty(state, player)) * 4 + (averageCount - state.rackCounts[player]) * 20 + initialLead;
}
export function projectDigitalState(state: DigitalGameState, viewer: Seat): DigitalGameState {
  const playerCount = countOf(state);
  const visible = new Set<string>([
    ...(state.racks[viewer] ?? []),
    ...state.table.flatMap((meld) => meld.tiles),
  ]);
  const tiles = Object.fromEntries(Object.entries(state.tiles).filter(([id]) => visible.has(id)));
  const racks = state.racks.map((rack, index) =>
    index === viewer
      ? [...rack]
      : Array.from({ length: state.rackCounts[index] }, (_, item) => `hidden-rack-${index}-${item}`),
  );
  return {
    ...state,
    playerCount,
    viewerSeat: viewer,
    seed: 0,
    tiles,
    racks,
    drawPool: Array.from({ length: state.drawPool.length }, (_, index) => `hidden-draw-${index}`),
  };
}
export const digitalGameEngine: RulesEngine<DigitalGameState, DigitalGameMove, Seat> = {
  id: 'digitalGame',
  minPlayers: 2,
  maxPlayers: 4,
  winReason: 'digital-win',
  create: (playerCount = 2) => createDigitalGameForPlayers(playerCount),
  parseMove: parseDigitalMove,
  validate: validateDigital,
  apply: applyDigital,
  legalMoves: digitalLegalMoves,
  evaluate: evaluateDigital,
  view: projectDigitalState,
};
''')

write('apps/server/src/lobby.ts', r'''import { randomInt } from 'node:crypto';
import { RuleError, type PlayerCount } from '../../../packages/core/src/game.ts';
import type { MatchSnapshot } from '../../../packages/core/src/protocol.ts';
import { MatchService } from './matches.ts';
interface QueueEntry {
  userId: string;
  gameId: string;
  ranked: boolean;
  playerCount: PlayerCount;
  at: number;
}
export interface Room {
  owner: string;
  members: string[];
  code: string;
  gameId: string;
  playerCount: PlayerCount;
  expiresAt: number;
}
export interface RoomJoinResult {
  room: Room;
  match: MatchSnapshot | null;
}
export class Lobby {
  queue: QueueEntry[] = [];
  rooms = new Map<string, Room>();
  constructor(readonly matches: MatchService) {}
  cancel(userId: string): Room[] {
    this.queue = this.queue.filter((q) => q.userId !== userId);
    const changed: Room[] = [];
    for (const [code, room] of [...this.rooms]) {
      if (room.owner === userId) this.rooms.delete(code);
      else if (room.members.includes(userId)) {
        room.members = room.members.filter((id) => id !== userId);
        changed.push(room);
      }
    }
    return changed;
  }
  private normalizePlayerCount(gameId: string, value: number): PlayerCount {
    const game = this.matches.games.get(gameId);
    if (!Number.isInteger(value) || value < game.minPlayers || value > game.maxPlayers)
      throw new RuleError('player-count-not-supported');
    return value as PlayerCount;
  }
  private eligible(userId: string, gameId: string, ranked = false) {
    this.matches.games.get(gameId);
    if (this.matches.activeFor(userId) && !this.matches.activeFor(userId)!.result)
      throw new RuleError('already-in-match');
    if (ranked && this.matches.store.user(userId).guest)
      throw new RuleError('ranked-requires-account');
  }
  private shuffled(users: string[]): string[] {
    const out = [...users];
    for (let i = out.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  private group(gameId: string, users: string[], ranked: boolean) {
    return this.matches.create(gameId, this.shuffled(users), ranked);
  }
  enqueue(
    userId: string,
    gameId: string,
    ranked: boolean,
    requestedPlayerCount: PlayerCount = 2,
  ): MatchSnapshot | null {
    this.eligible(userId, gameId, ranked);
    const playerCount = this.normalizePlayerCount(gameId, requestedPlayerCount);
    this.cancel(userId);
    const entry: QueueEntry = { userId, gameId, ranked, playerCount, at: this.matches.options.now() };
    this.queue.push(entry);
    return this.tryGroup(entry);
  }
  private tryGroup(entry: QueueEntry): MatchSnapshot | null {
    if (!this.queue.includes(entry)) return null;
    const now = this.matches.options.now(),
      rating = this.matches.store.rating(entry.userId, entry.gameId);
    const compatible = this.queue
      .filter(
        (q) =>
          q.gameId === entry.gameId &&
          q.ranked === entry.ranked &&
          q.playerCount === entry.playerCount &&
          (!entry.ranked ||
            Math.abs(this.matches.store.rating(q.userId, q.gameId) - rating) <=
              150 + Math.floor((now - Math.min(q.at, entry.at)) / 10000) * 50),
      )
      .sort((a, b) => a.at - b.at);
    if (compatible.length < entry.playerCount) return null;
    const selected = compatible.slice(0, entry.playerCount);
    const match = this.group(entry.gameId, selected.map((item) => item.userId), entry.ranked);
    for (const item of selected) this.cancel(item.userId);
    return match;
  }
  tick(): MatchSnapshot[] {
    const result: MatchSnapshot[] = [];
    for (const entry of [...this.queue]) {
      const match = this.tryGroup(entry);
      if (match) result.push(match);
    }
    for (const [code, room] of this.rooms)
      if (room.expiresAt < this.matches.options.now()) this.rooms.delete(code);
    return result;
  }
  createRoom(userId: string, gameId: string, requestedPlayerCount: PlayerCount = 2): Room {
    this.eligible(userId, gameId);
    const playerCount = this.normalizePlayerCount(gameId, requestedPlayerCount);
    this.cancel(userId);
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    do {
      code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
    } while (this.rooms.has(code));
    const room: Room = {
      owner: userId,
      members: [userId],
      gameId,
      playerCount,
      code,
      expiresAt: this.matches.options.now() + 600000,
    };
    this.rooms.set(code, room);
    return room;
  }
  joinRoomResult(userId: string, code: string): RoomJoinResult {
    const room = this.rooms.get(code);
    if (!room || room.expiresAt <= this.matches.options.now()) throw new RuleError('room-not-found');
    if (room.owner === userId) throw new RuleError('cannot-play-yourself');
    this.eligible(userId, room.gameId);
    if (!room.members.includes(userId)) room.members.push(userId);
    this.queue = this.queue.filter((q) => q.userId !== userId);
    if (room.members.length < room.playerCount) return { room, match: null };
    if (room.members.length > room.playerCount) throw new RuleError('room-full');
    const match = this.group(room.gameId, room.members, false);
    this.rooms.delete(code);
    return { room, match };
  }
  /** Backward-compatible helper for existing two-player callers and tests. */
  joinRoom(userId: string, code: string): MatchSnapshot {
    const result = this.joinRoomResult(userId, code);
    if (!result.match) throw new RuleError('room-waiting');
    return result.match;
  }
}
''')

write('apps/server/src/matches.ts', r'''import { randomUUID } from 'node:crypto';
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
  create(gameId: string, users: string[], ranked = false): MatchSnapshot {
    const game = this.games.get(gameId);
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
      clockMs: users.map(() => this.options.clockMs),
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
    return { ...publicMatch, serverNow: this.options.now() };
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
    m.clockMs[m.state.turn] = Math.max(0, m.clockMs[m.state.turn] - Math.max(0, at - m.turnStartedAt));
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
  expire(m: StoredMatch): StoredMatch {
    if (m.result) return m;
    const now = this.options.now();
    const deadlines: { at: number; loser: Seat; reason: 'timeout' | 'disconnect' }[] = [
      { at: m.turnStartedAt + m.clockMs[m.state.turn], loser: m.state.turn, reason: 'timeout' },
    ];
    for (const seat of seats(m.players.length))
      if (m.disconnectedAt[seat] !== null)
        deadlines.push({ at: m.disconnectedAt[seat]! + m.graceMs, loser: seat, reason: 'disconnect' });
    deadlines.sort((a, b) => a.at - b.at);
    const first = deadlines[0];
    if (first.at > now) return m;
    if (first.reason === 'timeout')
      return this.finish(m, this.bestRemaining(m, [first.loser]), 'timeout', first.at);
    const simultaneous = deadlines
      .filter((deadline) => deadline.reason === 'disconnect' && deadline.at === first.at)
      .map((deadline) => deadline.loser);
    if (simultaneous.length === m.players.length) return this.finish(m, null, 'abandoned', first.at);
    return this.finish(m, this.bestRemaining(m, simultaneous), 'disconnect', first.at);
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
      m.drawAccepts = [];
      m.commands[key] = { fingerprint, revision: m.revision };
      if (next.winner !== null)
        return this.snapshot(this.finish(m, next.winner, this.games.get(m.gameId).winReason, now));
      if (next.drawReason) return this.snapshot(this.finish(m, null, next.drawReason, now));
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
      const next = this.create(m.gameId, users, m.ranked);
      m.rematchId = next.id;
      this.store.saveMatch(m);
      return next;
    }
    this.store.saveMatch(m);
    return this.snapshot(m);
  }
}
''')

# Database migration and multiplayer settlement. Keep the rest of Store intact.
replace('apps/server/src/store.ts',
        "import { RuleError, type Player } from '../../../packages/core/src/game.ts';",
        "import { RuleError } from '../../../packages/core/src/game.ts';")
replace('apps/server/src/store.ts',
        "CREATE TABLE IF NOT EXISTS results(match_id TEXT NOT NULL REFERENCES matches(id),user_id TEXT NOT NULL REFERENCES users(id),game_id TEXT NOT NULL,opponent TEXT NOT NULL,result TEXT NOT NULL,reason TEXT NOT NULL,duration_ms INTEGER NOT NULL,delta INTEGER NOT NULL,ranked INTEGER NOT NULL,ended_at INTEGER NOT NULL,PRIMARY KEY(match_id,user_id));",
        "CREATE TABLE IF NOT EXISTS results(match_id TEXT NOT NULL REFERENCES matches(id),user_id TEXT NOT NULL REFERENCES users(id),game_id TEXT NOT NULL,opponent TEXT NOT NULL,result TEXT NOT NULL,reason TEXT NOT NULL,duration_ms INTEGER NOT NULL,delta INTEGER NOT NULL,ranked INTEGER NOT NULL,ended_at INTEGER NOT NULL,opponents_json TEXT NOT NULL DEFAULT '[]',player_count INTEGER NOT NULL DEFAULT 2,PRIMARY KEY(match_id,user_id));")
replace('apps/server/src/store.ts',
        "      CREATE TABLE IF NOT EXISTS auth_codes(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),challenge TEXT NOT NULL,expires_at INTEGER NOT NULL);`);\n  }",
        "      CREATE TABLE IF NOT EXISTS auth_codes(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),challenge TEXT NOT NULL,expires_at INTEGER NOT NULL);`);\n    const resultColumns = new Set(\n      (this.db.prepare('PRAGMA table_info(results)').all() as { name: string }[]).map((column) => column.name),\n    );\n    if (!resultColumns.has('opponents_json'))\n      this.db.exec(\"ALTER TABLE results ADD COLUMN opponents_json TEXT NOT NULL DEFAULT '[]'\");\n    if (!resultColumns.has('player_count'))\n      this.db.exec('ALTER TABLE results ADD COLUMN player_count INTEGER NOT NULL DEFAULT 2');\n  }")
regex_replace('apps/server/src/store.ts',
              r"  loadMatch\(id: string\): StoredMatch \{.*?\n  \}\n  activeMatches",
              r'''  loadMatch(id: string): StoredMatch {
    const row = this.db.prepare('SELECT body FROM matches WHERE id=?').get(id) as { body: string } | undefined;
    if (!row) throw new RuleError('match-not-found');
    const match = JSON.parse(row.body) as StoredMatch;
    match.drawAccepts ??= match.drawOffer === null ? [] : [match.drawOffer];
    match.state.playerCount ??= match.players.length as 2 | 3 | 4;
    return match;
  }
  activeMatches''', re.S)
regex_replace('apps/server/src/store.ts',
              r"  settle\(match: StoredMatch\) \{.*?\n  \}\n  profile\(",
              r'''  settle(match: StoredMatch) {
    if (!match.result || match.endedAt === null) throw new Error('Cannot settle active match');
    this.transaction(() => {
      const existing = this.db.prepare('SELECT match_id FROM results WHERE match_id=? LIMIT 1').get(match.id);
      if (existing) return;
      const result = match.result!;
      if (match.ranked && result.reason !== 'abandoned') {
        const ratings = match.players.map((player) => this.rating(player.id, match.gameId));
        const raw = ratings.map(() => 0);
        for (let left = 0; left < ratings.length; left++)
          for (let right = left + 1; right < ratings.length; right++) {
            const score =
              result.winner === null ? 0.5 : result.winner === left ? 1 : result.winner === right ? 0 : 0.5;
            const change = eloChange(ratings[left], ratings[right], score);
            raw[left] += change;
            raw[right] -= change;
          }
        const divisor = Math.max(1, ratings.length - 1);
        result.ratingDelta = raw.map((delta) => Math.round(delta / divisor));
        const drift = result.ratingDelta.reduce((sum, delta) => sum + delta, 0);
        if (drift) result.ratingDelta[result.winner ?? 0] -= drift;
        for (let seat = 0; seat < match.players.length; seat++)
          this.db
            .prepare(
              'INSERT INTO ratings(user_id,game_id,rating,played) VALUES(?,?,?,1) ON CONFLICT(user_id,game_id) DO UPDATE SET rating=excluded.rating,played=ratings.played+1',
            )
            .run(match.players[seat].id, match.gameId, ratings[seat] + result.ratingDelta[seat]);
      }
      this.saveMatch(match);
      for (let seat = 0; seat < match.players.length; seat++) {
        const opponents = match.players.filter((_, index) => index !== seat).map((player) => player.name);
        this.db
          .prepare(
            'INSERT INTO results(match_id,user_id,game_id,opponent,result,reason,duration_ms,delta,ranked,ended_at,opponents_json,player_count) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
          )
          .run(
            match.id,
            match.players[seat].id,
            match.gameId,
            opponents.join(', '),
            result.winner === null ? 'draw' : result.winner === seat ? 'win' : 'loss',
            result.reason,
            match.endedAt! - match.createdAt,
            result.ratingDelta[seat] ?? 0,
            match.ranked ? 1 : 0,
            match.endedAt!,
            JSON.stringify(opponents),
            match.players.length,
          );
      }
    });
  }
  profile(''', re.S)
replace('apps/server/src/store.ts',
        "      opponent: row.opponent,\n      result: row.result,",
        "      opponent: row.opponent,\n      opponents: JSON.parse(String(row.opponents_json ?? '[]')),\n      playerCount: Number(row.player_count ?? 2),\n      result: row.result,")

# Server wire-up: protocol v2, grouped queues, staged private rooms, room membership updates.
replace('apps/server/src/server.ts',
        "  clientMessageSchema,\n  type ServerMessage,\n  type MatchSnapshot,",
        "  clientMessageSchema,\n  PROTOCOL_VERSION,\n  type ServerMessage,\n  type MatchSnapshot,")
replace('apps/server/src/server.ts',
        "  const broadcast = (match: MatchSnapshot, ack?: string) => {\n    for (const player of match.players)\n      sendUser(player.id, { type: 'match', match: matches.forUser(match, player.id), ack });\n  };",
        "  const broadcast = (match: MatchSnapshot, ack?: string) => {\n    for (const player of match.players)\n      sendUser(player.id, { type: 'match', match: matches.forUser(match, player.id), ack });\n  };\n  const broadcastRoom = (room: ReturnType<Lobby['createRoom']>) => {\n    for (const userId of room.members)\n      sendUser(userId, {\n        type: 'room',\n        code: room.code,\n        expiresAt: room.expiresAt,\n        gameId: room.gameId,\n        playerCount: room.playerCount,\n        joined: room.members.length,\n      });\n  };")
replace('apps/server/src/server.ts',
        "return json(res, 200, { ok: true, protocol: 1, games: games.ids() });",
        "return json(res, 200, { ok: true, protocol: PROTOCOL_VERSION, games: games.ids() });")
replace('apps/server/src/server.ts',
        "          const match = lobby.enqueue(userId, message.gameId, message.ranked);",
        "          const match = lobby.enqueue(userId, message.gameId, message.ranked, message.playerCount);")
replace('apps/server/src/server.ts',
        "              ranked: message.ranked,\n            });",
        "              ranked: message.ranked,\n              playerCount: message.playerCount,\n            });")
replace('apps/server/src/server.ts',
        "          lobby.cancel(userId);\n          return send(ws, { type: 'cancelled' });",
        "          for (const room of lobby.cancel(userId)) broadcastRoom(room);\n          return send(ws, { type: 'cancelled' });")
replace('apps/server/src/server.ts',
        "          const room = lobby.createRoom(userId, message.gameId);\n          return send(ws, {\n            type: 'room',\n            code: room.code,\n            expiresAt: room.expiresAt,\n            gameId: room.gameId,\n          });\n        }\n        if (message.type === 'join-room') return broadcast(lobby.joinRoom(userId, message.code));",
        "          const room = lobby.createRoom(userId, message.gameId, message.playerCount);\n          broadcastRoom(room);\n          return;\n        }\n        if (message.type === 'join-room') {\n          const joined = lobby.joinRoomResult(userId, message.code);\n          if (joined.match) broadcast(joined.match);\n          else broadcastRoom(joined.room);\n          return;\n        }")
replace('apps/server/src/server.ts',
        "        lobby.cancel(id);\n        for (const match of matches.connection(id, false)) broadcast(match);",
        "        for (const room of lobby.cancel(id)) broadcastRoom(room);\n        for (const match of matches.connection(id, false)) broadcast(match);")

# Network sends v2 while server accepts v1 during migration.
replace('apps/mobile/src/network.ts',
        "import type {\n  ClientMessage,\n  MatchCommand,\n  ServerMessage,\n} from '../../../packages/core/src/protocol.ts';",
        "import {\n  PROTOCOL_VERSION,\n  type ClientMessage,\n  type MatchCommand,\n  type ServerMessage,\n} from '../../../packages/core/src/protocol.ts';")
replace('apps/mobile/src/network.ts',
        "ws.send(JSON.stringify({ type: 'auth', token: this.token, version: 1 }))",
        "ws.send(JSON.stringify({ type: 'auth', token: this.token, version: PROTOCOL_VERSION }))")

# Digital UI uses the server-projected viewer seat instead of assuming exactly one opponent.
replace('packages/games/digital-game/ui.tsx',
        "import { nextPlayer, type DigitalGameMove, type DigitalGameState, type DigitalMeld } from './state.ts';",
        "import type { DigitalGameMove, DigitalGameState, DigitalMeld } from './state.ts';")
replace('packages/games/digital-game/ui.tsx',
        "  const currentRackVisible = state.racks[state.turn].every((id) => !!state.tiles[id]);\n  const visibleSeat = currentRackVisible ? state.turn : nextPlayer(state.turn);",
        "  const visibleSeat = state.viewerSeat ?? state.turn;\n  const currentRackVisible = (state.racks[visibleSeat] ?? []).every((id) => !!state.tiles[id]);")
replace('packages/games/digital-game/ui.tsx',
        "    const rackVisible = state.racks[state.turn].every((id) => !!state.tiles[id]);\n    const seat = rackVisible ? state.turn : nextPlayer(state.turn);\n    setWorkingTable(cloneTable(state.table));\n    setWorkingRack([...state.racks[seat]]);",
        "    const seat = state.viewerSeat ?? state.turn;\n    setWorkingTable(cloneTable(state.table));\n    setWorkingRack([...(state.racks[seat] ?? [])]);")

# Game resource counters now accept any seat.
replace('apps/mobile/src/gameViews.tsx',
        "import type { BaseState } from '../../../packages/core/src/game.ts';",
        "import type { BaseState, Seat } from '../../../packages/core/src/game.ts';")
replace('apps/mobile/src/gameViews.tsx',
        "  (state: BaseState, player: 0 | 1) => { value: string; label: string }",
        "  (state: BaseState, player: Seat) => { value: string; label: string }")
replace('apps/mobile/src/gameViews.tsx',
        "export function gameResource(state: BaseState, player: 0 | 1): { value: string; label: string } {",
        "export function gameResource(state: BaseState, player: Seat): { value: string; label: string } {")

# Mode dialog adds a Digital Game seat selector and reports private-room occupancy.
replace('apps/mobile/src/pages.tsx',
        "import type { Difficulty } from '../../../packages/core/src/game.ts';",
        "import type { Difficulty, PlayerCount } from '../../../packages/core/src/game.ts';")
replace('apps/mobile/src/pages.tsx',
        "  onStart: (mode: PlayMode, difficulty: Difficulty, ranked: boolean, code?: string) => void;",
        "  onStart: (mode: PlayMode, difficulty: Difficulty, ranked: boolean, playerCount: PlayerCount, code?: string) => void;")
replace('apps/mobile/src/pages.tsx',
        "    [ranked, setRanked] = useState(false),\n    [code, setCode] = useState('');",
        "    [ranked, setRanked] = useState(false),\n    [playerCount, setPlayerCount] = useState<PlayerCount>(2),\n    [code, setCode] = useState('');")
replace('apps/mobile/src/pages.tsx',
        "      {mode === 'ai' && (",
        "      {gameId === 'digitalGame' && mode !== 'ai' && (\n        <fieldset>\n          <legend>{t('playerCountLabel')}</legend>\n          <div className=\"segmented\">\n            {([2, 3, 4] as PlayerCount[]).map((count) => (\n              <button key={count} aria-pressed={playerCount === count} onClick={() => setPlayerCount(count)}>\n                {count}\n              </button>\n            ))}\n          </div>\n        </fieldset>\n      )}\n      {mode === 'ai' && (")
replace('apps/mobile/src/pages.tsx',
        "onClick={() => onStart(mode, difficulty, false)}",
        "onClick={() => onStart(mode, difficulty, false, playerCount)}")
replace('apps/mobile/src/pages.tsx',
        "onStart(mode, difficulty, false, code);",
        "onStart(mode, difficulty, false, playerCount, code);")
replace('apps/mobile/src/pages.tsx',
        "onClick={() => onStart(mode, difficulty, ranked)}",
        "onClick={() => onStart(mode, difficulty, ranked, mode === 'ai' ? 2 : playerCount)}")
replace('apps/mobile/src/pages.tsx',
        "    | { type: 'room'; code: string; gameId: string; expiresAt: number }\n    | { type: 'queued'; gameId: string; ranked: boolean };",
        "    | { type: 'room'; code: string; gameId: string; expiresAt: number; playerCount: PlayerCount; joined: number }\n    | { type: 'queued'; gameId: string; ranked: boolean; playerCount: PlayerCount };")
replace('apps/mobile/src/pages.tsx',
        "        <p>{t(room.type === 'room' ? 'shareCode' : 'searchHint')}</p>",
        "        <p>{t(room.type === 'room' ? 'shareCode' : 'searchHint')}</p>\n        <p className=\"small-muted\">\n          {t('playerCountLabel')}: {room.type === 'room' ? `${room.joined}/${room.playerCount}` : room.playerCount}\n        </p>")

# Match UI supports dynamic player arrays while retaining the same compact two-player layout for classic games.
replace('apps/mobile/src/MatchPage.tsx',
        "import type { BaseState, Player } from '../../../packages/core/src/game.ts';",
        "import type { BaseState, Seat } from '../../../packages/core/src/game.ts';")
replace('apps/mobile/src/MatchPage.tsx',
        "  players: [PublicPlayer, PublicPlayer];\n  self: Player;\n  clocks: [number, number];",
        "  players: PublicPlayer[];\n  self: Seat;\n  clocks: number[];")
replace('apps/mobile/src/MatchPage.tsx',
        "  drawOffer: Player | null;",
        "  drawOffer: Seat | null;\n  drawAccepts: Seat[];")
replace('apps/mobile/src/MatchPage.tsx',
        "  emote: { player: Player; value: string } | null;",
        "  emote: { player: Seat; value: string } | null;")
replace('apps/mobile/src/MatchPage.tsx',
        "  const panel = (player: Player) => {",
        "  const panel = (player: Seat) => {")
replace('apps/mobile/src/MatchPage.tsx',
        "  const bottom = p.mode === 'online' ? p.self : 0,\n    top = (bottom === 0 ? 1 : 0) as Player;",
        "  const opponents = p.players\n    .map((_, index) => index as Seat)\n    .filter((seat) => seat !== p.self);")
replace('apps/mobile/src/MatchPage.tsx',
        "          {panel(top)}",
        "          <div className=\"multiplayer-opponents\">{opponents.map((seat) => panel(seat))}</div>")
replace('apps/mobile/src/MatchPage.tsx',
        "          {panel(bottom)}",
        "          {panel(p.self)}")
replace('apps/mobile/src/MatchPage.tsx',
        "              <p>{t(p.drawOffer === p.self ? 'drawSent' : 'drawOffered')}</p>\n              {p.drawOffer !== p.self && (",
        "              <p>{t(p.drawOffer === p.self || p.drawAccepts.includes(p.self) ? 'drawSent' : 'drawOffered')}</p>\n              {p.drawOffer !== p.self && !p.drawAccepts.includes(p.self) && (")

# App passes player counts through local/online creation, renders four local identities, and tracks any disconnected opponent.
replace('apps/mobile/src/App.tsx',
        "import type { Difficulty, Player } from '../../../packages/core/src/game.ts';",
        "import type { Difficulty, PlayerCount, Seat } from '../../../packages/core/src/game.ts';")
replace('apps/mobile/src/App.tsx',
        "    [emote, setEmote] = useState<{ player: Player; value: string } | null>(null);",
        "    [emote, setEmote] = useState<{ player: Seat; value: string } | null>(null);")
replace('apps/mobile/src/App.tsx',
        "          const controller = new OfflineMatch(games.get(saved.gameId), saved.mode);",
        "          const controller = new OfflineMatch(\n            games.get(saved.gameId),\n            saved.mode,\n            Date.now,\n            (saved.current.state.playerCount ?? 2) as PlayerCount,\n          );")
replace('apps/mobile/src/App.tsx',
        "  const startOffline = (gameId: string, mode: 'local' | 'ai', difficulty: Difficulty) => {\n    const session = {\n      id: crypto.randomUUID(),\n      controller: new OfflineMatch(games.get(gameId), mode),",
        "  const startOffline = (\n    gameId: string,\n    mode: 'local' | 'ai',\n    difficulty: Difficulty,\n    playerCount: PlayerCount = 2,\n  ) => {\n    const session = {\n      id: crypto.randomUUID(),\n      controller: new OfflineMatch(games.get(gameId), mode, Date.now, mode === 'ai' ? 2 : playerCount),")
replace('apps/mobile/src/App.tsx',
        "  const start = async (mode: PlayMode, difficulty: Difficulty, ranked: boolean, code?: string) => {",
        "  const start = async (\n    mode: PlayMode,\n    difficulty: Difficulty,\n    ranked: boolean,\n    playerCount: PlayerCount,\n    code?: string,\n  ) => {")
replace('apps/mobile/src/App.tsx',
        "        startOffline(choice.gameId, mode, difficulty);",
        "        startOffline(choice.gameId, mode, difficulty, playerCount);")
replace('apps/mobile/src/App.tsx',
        "code ? { type: 'join-room', code } : { type: 'create-room', gameId: choice.gameId },",
        "code\n            ? { type: 'join-room', code }\n            : { type: 'create-room', gameId: choice.gameId, playerCount },")
replace('apps/mobile/src/App.tsx',
        "else connection.send({ type: 'queue', gameId: choice.gameId, ranked });",
        "else connection.send({ type: 'queue', gameId: choice.gameId, ranked, playerCount });")
replace('apps/mobile/src/App.tsx',
        "  const self = (online ? online.players.findIndex((p) => p.id === profile?.id) : 0) as Player;\n  const localPlayers: [PublicPlayer, PublicPlayer] = [\n    {\n      id: 'local-0',\n      name: profile?.name ?? t('player1'),\n      avatar: profile?.avatar ?? 'orbit',\n      rating: 1000,\n      rank: 'Silver',\n    },\n    {\n      id: 'local-1',\n      name:\n        offline?.controller.mode === 'ai'\n          ? `${t('aiName')} · ${t(offline.difficulty)}`\n          : t('player2'),\n      avatar: offline?.controller.mode === 'ai' ? 'hex' : 'comet',\n      rating: 1000,\n      rank: 'Silver',\n    },\n  ];",
        "  const self = (online ? online.players.findIndex((p) => p.id === profile?.id) : 0) as Seat;\n  const localPlayerCount = (offline?.controller.current.state.playerCount ?? 2) as PlayerCount;\n  const localPlayers: PublicPlayer[] = Array.from({ length: localPlayerCount }, (_, index) => ({\n    id: `local-${index}`,\n    name:\n      index === 0\n        ? profile?.name ?? t('player1')\n        : offline?.controller.mode === 'ai' && index === 1\n          ? `${t('aiName')} · ${t(offline.difficulty)}`\n          : t(`player${index + 1}`),\n    avatar: index === 0 ? profile?.avatar ?? 'orbit' : ['comet', 'hex', 'crown'][index - 1] ?? 'moon',\n    rating: 1000,\n    rank: 'Silver',\n  }));")
replace('apps/mobile/src/App.tsx',
        "                self={self === 1 ? 1 : 0}",
        "                self={self >= 0 ? self : 0}")
replace('apps/mobile/src/App.tsx',
        "                disconnected={!!(online && online.disconnectedAt[self === 0 ? 1 : 0] !== null)}\n                graceSeconds={\n                  online\n                    ? Math.max(\n                        0,\n                        Math.ceil(\n                          (online.graceMs -\n                            (matchNow - (online.disconnectedAt[self === 0 ? 1 : 0] ?? matchNow))) /\n                            1000,\n                        ),\n                      )\n                    : 0\n                }\n                drawOffer={online?.drawOffer ?? null}",
        "                disconnected={\n                  !!online && online.disconnectedAt.some((at, index) => index !== self && at !== null)\n                }\n                graceSeconds={\n                  online\n                    ? Math.max(\n                        0,\n                        Math.ceil(\n                          Math.min(\n                            ...online.disconnectedAt\n                              .map((at, index) => (index === self || at === null ? Infinity : online.graceMs - (matchNow - at)))\n                              .filter(Number.isFinite),\n                            online.graceMs,\n                          ) / 1000,\n                        ),\n                      )\n                    : 0\n                }\n                drawOffer={online?.drawOffer ?? null}\n                drawAccepts={online?.drawAccepts ?? []}")
replace('apps/mobile/src/App.tsx',
        "                    offline!.difficulty,\n                  )",
        "                    offline!.difficulty,\n                    (offline!.controller.current.state.playerCount ?? 2) as PlayerCount,\n                  )")
# Same restart call appears twice; update the second one too.
text = (ROOT / 'apps/mobile/src/App.tsx').read_text(encoding='utf-8')
text = text.replace(
    "                      offline!.difficulty,\n                    );",
    "                      offline!.difficulty,\n                      (offline!.controller.current.state.playerCount ?? 2) as PlayerCount,\n                    );",
    1,
)
(ROOT / 'apps/mobile/src/App.tsx').write_text(text, encoding='utf-8')
replace('apps/mobile/src/App.tsx',
        "                      offline!.controller.mode === 'ai' ? 1 : current.turn === 0 ? 1 : 0,",
        "                      offline!.controller.mode === 'ai'\n                        ? 1\n                        : (((current.turn + 1) % (current.playerCount ?? 2)) as Seat),")

# Localized labels for 3-4 players and multiplayer room selection.
replace('apps/mobile/src/i18n.tsx',
        "  player2: 'Player two',",
        "  player2: 'Player two',\n  player3: 'Player three',\n  player4: 'Player four',\n  playerCountLabel: 'Players',")
replace('apps/mobile/src/i18n.tsx',
        "  player2: 'اللاعب الثاني',",
        "  player2: 'اللاعب الثاني',\n  player3: 'اللاعب الثالث',\n  player4: 'اللاعب الرابع',\n  playerCountLabel: 'عدد اللاعبين',")
replace('apps/mobile/src/i18n.tsx',
        "  'blocked-round': 'The draw pool is empty and neither player could continue.',",
        "  'blocked-round': 'The draw pool is empty and no player could continue.',")
replace('apps/mobile/src/i18n.tsx',
        "  'blocked-round': 'نفدت بلاطات السحب ولم يستطع أي من اللاعبين الاستمرار.',",
        "  'blocked-round': 'نفدت بلاطات السحب ولم يستطع أي لاعب الاستمرار.',")

# New focused tests cover 3/4-player engine state, privacy, lobby grouping, draw consensus, and DB rows.
write('tests/digital-multiplayer.test.ts', r'''import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDigitalGame } from '../packages/games/digital-game/state.ts';
import {
  applyDigital,
  calculateRoundScores,
  projectDigitalState,
} from '../packages/games/digital-game/rules.ts';
import { Store } from '../apps/server/src/store.ts';
import { MatchService } from '../apps/server/src/matches.ts';
import { Lobby } from '../apps/server/src/lobby.ts';
import { games } from '../packages/games/registry.ts';
import type { MatchCommand } from '../packages/core/src/protocol.ts';

function users(store: Store, count: number, guests = false) {
  return Array.from({ length: count }, (_, index) =>
    store.createUser(`P${index + 1}`, guests ? 'guest' : 'email', `multi-${count}-${index}-${randomUUID()}`),
  );
}

test('Digital Game deals 14 tiles to 3 and 4 seats and rotates every turn', () => {
  for (const count of [3, 4] as const) {
    let state = createDigitalGame(12345, count);
    assert.equal(state.playerCount, count);
    assert.deepEqual(state.rackCounts, Array.from({ length: count }, () => 14));
    assert.equal(state.drawPool.length, 106 - count * 14);
    for (let seat = 1; seat < count; seat++) {
      state = applyDigital(state, { type: 'draw' });
      assert.equal(state.turn, seat);
    }
    state = applyDigital(state, { type: 'draw' });
    assert.equal(state.turn, 0);
  }
});

test('multiplayer projection exposes only the viewer rack and public table', () => {
  const state = createDigitalGame(22, 4),
    view = projectDigitalState(state, 2);
  assert.equal(view.viewerSeat, 2);
  assert.equal(view.seed, 0);
  assert.deepEqual(view.racks[2], state.racks[2]);
  for (const seat of [0, 1, 3]) {
    assert.equal(view.racks[seat].length, 14);
    assert.ok(view.racks[seat].every((id) => id.startsWith(`hidden-rack-${seat}-`)));
    assert.ok(view.racks[seat].every((id) => !view.tiles[id]));
  }
  assert.equal(view.drawPool.length, state.drawPool.length);
});

test('multiplayer round scoring awards the winner every opponent penalty', () => {
  const state = createDigitalGame(7, 3);
  state.racks = [state.racks[0].slice(0, 1), state.racks[1].slice(0, 2), state.racks[2].slice(0, 3)];
  const scores = calculateRoundScores(state, 0);
  assert.equal(scores.length, 3);
  assert.equal(scores.reduce((sum, value) => sum + value, 0), 0);
  assert.ok(scores[0] > 0 && scores[1] < 0 && scores[2] < 0);
});

test('Digital private rooms wait for all four players before creating a match', () => {
  const store = new Store(), service = new MatchService(store, games), lobby = new Lobby(service);
  try {
    const [a, b, c, d] = users(store, 4);
    const room = lobby.createRoom(a.id, 'digitalGame', 4);
    assert.equal(lobby.joinRoomResult(b.id, room.code).match, null);
    assert.equal(lobby.rooms.get(room.code)?.members.length, 2);
    assert.equal(lobby.joinRoomResult(c.id, room.code).match, null);
    const match = lobby.joinRoomResult(d.id, room.code).match;
    assert.ok(match);
    assert.equal(match!.players.length, 4);
    assert.equal(match!.state.playerCount, 4);
    assert.equal(lobby.rooms.has(room.code), false);
    assert.throws(() => lobby.createRoom(a.id, 'quoridor', 3), /player-count-not-supported/);
  } finally {
    store.close();
  }
});

test('quick matchmaking groups exactly three Digital players', () => {
  const store = new Store(), service = new MatchService(store, games), lobby = new Lobby(service);
  try {
    const [a, b, c] = users(store, 3);
    assert.equal(lobby.enqueue(a.id, 'digitalGame', false, 3), null);
    assert.equal(lobby.enqueue(b.id, 'digitalGame', false, 3), null);
    const match = lobby.enqueue(c.id, 'digitalGame', false, 3);
    assert.ok(match);
    assert.equal(match!.players.length, 3);
    assert.equal(lobby.queue.length, 0);
  } finally {
    store.close();
  }
});

test('four-player draw requires unanimous acceptance and persists one result row per seat', () => {
  const store = new Store(), service = new MatchService(store, games);
  try {
    const ps = users(store, 4);
    let match = service.create('digitalGame', ps.map((user) => user.id), true);
    const send = (user: string, type: 'draw-offer' | 'draw-answer', accept?: boolean) => {
      const command = {
        type,
        matchId: match.id,
        commandId: randomUUID(),
        expectedRevision: match.revision,
        ...(type === 'draw-answer' ? { accept } : {}),
      } as MatchCommand;
      match = service.command(user, command);
    };
    send(ps[0].id, 'draw-offer');
    send(ps[1].id, 'draw-answer', true);
    assert.equal(match.result, null);
    send(ps[2].id, 'draw-answer', true);
    assert.equal(match.result, null);
    send(ps[3].id, 'draw-answer', true);
    assert.equal(match.result?.reason, 'agreement');
    assert.equal(match.result?.winner, null);
    assert.equal(match.result?.ratingDelta.length, 4);
    const rows = store.db.prepare('SELECT opponents_json,player_count FROM results WHERE match_id=?').all(match.id) as {
      opponents_json: string;
      player_count: number;
    }[];
    assert.equal(rows.length, 4);
    assert.ok(rows.every((row) => row.player_count === 4 && JSON.parse(row.opponents_json).length === 3));
  } finally {
    store.close();
  }
});
''')
