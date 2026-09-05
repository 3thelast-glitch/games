import {
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
  const penalties = activeSeats.map((seat) => rackPenalty(state, seat as Seat));
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
  const averagePenalty = others.reduce<number>((sum, seat) => sum + rackPenalty(state, seat as Seat), 0) / others.length;
  const averageCount = others.reduce<number>((sum, seat) => sum + state.rackCounts[seat], 0) / others.length;
  const initialLead =
    (state.hasCompletedInitialMeld[player] ? 40 : 0) -
    others.reduce<number>((sum, seat) => sum + (state.hasCompletedInitialMeld[seat as Seat] ? 40 : 0), 0) / others.length;
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
