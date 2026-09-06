import {
  RuleError,
  seats,
  type PlayerCount,
  type RulesEngine,
  type Seat,
  type Validation,
} from '../../core/src/game.ts';
import {
  DIGITAL_COLORS,
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

/** Classic blocked-game scoring is relative to the winner's remaining rack. */
export function calculateBlockedScores(state: DigitalGameState, winner: Seat): number[] {
  const scores = state.racks.map(() => 0);
  const winnerPenalty = rackPenalty(state, winner);
  let won = 0;
  for (const seat of seats(state.racks.length)) {
    if (seat === winner) continue;
    const delta = rackPenalty(state, seat) - winnerPenalty;
    scores[seat] = -delta;
    won += delta;
  }
  scores[winner] = won;
  return scores;
}

type SolverMeld = { ids: string[]; score: number };
function combinations<T>(items: T[], count: number): T[][] {
  const out: T[][] = [];
  const pick = (start: number, chosen: T[]) => {
    if (chosen.length === count) {
      out.push([...chosen]);
      return;
    }
    for (let index = start; index <= items.length - (count - chosen.length); index++) {
      chosen.push(items[index]);
      pick(index + 1, chosen);
      chosen.pop();
    }
  };
  pick(0, []);
  return out;
}
function candidateKey(ids: string[]): string {
  return [...ids].sort().join('|');
}
function pushSolverMeld(state: DigitalGameState, found: Map<string, SolverMeld>, ids: string[]): void {
  if (new Set(ids).size !== ids.length) return;
  const result = validateMeld(ids.map((id) => state.tiles[id]));
  if (!result.ok) return;
  const key = candidateKey(ids);
  if (!found.has(key)) found.set(key, { ids: [...ids], score: result.score });
}
function solverCandidatesContaining(state: DigitalGameState, availableIds: string[], requiredId: string): SolverMeld[] {
  const required = state.tiles[requiredId];
  if (!required || !availableIds.includes(requiredId)) return [];
  const jokerIds = availableIds.filter((id) => state.tiles[id]?.isJoker);
  const found = new Map<string, SolverMeld>();
  if (required.isJoker) {
    for (let value = 1; value <= 13; value++) {
      const eligible = availableIds.filter((id) => {
        if (id === requiredId) return false;
        const tile = state.tiles[id];
        return tile?.isJoker || tile?.value === value;
      });
      for (const size of [3, 4])
        for (const rest of combinations(eligible, size - 1)) pushSolverMeld(state, found, [requiredId, ...rest]);
    }
  } else {
    const eligible = availableIds.filter((id) => {
      if (id === requiredId) return false;
      const tile = state.tiles[id];
      return tile?.isJoker || tile?.value === required.value;
    });
    for (const size of [3, 4])
      for (const rest of combinations(eligible, size - 1)) pushSolverMeld(state, found, [requiredId, ...rest]);
  }
  const runChoices = (color: DigitalTile['color'], start: number, end: number, fixedJokerPosition: number | null) => {
    if (!color) return;
    const values = Array.from({ length: end - start + 1 }, (_, index) => start + index);
    const chosen: string[] = [];
    const used = new Set<string>();
    const recurse = (index: number) => {
      if (index === values.length) {
        if (chosen.includes(requiredId)) pushSolverMeld(state, found, chosen);
        return;
      }
      const value = values[index];
      if (!required.isJoker && value === required.value) {
        chosen.push(requiredId);
        used.add(requiredId);
        recurse(index + 1);
        used.delete(requiredId);
        chosen.pop();
        return;
      }
      if (required.isJoker && index === fixedJokerPosition) {
        chosen.push(requiredId);
        used.add(requiredId);
        recurse(index + 1);
        used.delete(requiredId);
        chosen.pop();
        return;
      }
      const numbered = availableIds.filter((id) => {
        if (used.has(id) || id === requiredId) return false;
        const tile = state.tiles[id];
        return !tile?.isJoker && tile?.color === color && tile?.value === value;
      });
      const jokers = jokerIds.filter((id) => id !== requiredId && !used.has(id));
      for (const id of [...numbered, ...jokers]) {
        chosen.push(id);
        used.add(id);
        recurse(index + 1);
        used.delete(id);
        chosen.pop();
      }
    };
    recurse(0);
  };
  if (required.isJoker) {
    for (const color of DIGITAL_COLORS)
      for (let start = 1; start <= 11; start++)
        for (let end = start + 2; end <= 13; end++)
          for (let jokerPosition = 0; jokerPosition <= end - start; jokerPosition++)
            runChoices(color, start, end, jokerPosition);
  } else if (required.color && required.value !== null) {
    for (let start = 1; start <= required.value; start++)
      for (let end = Math.max(start + 2, required.value); end <= 13; end++)
        if (start <= required.value && required.value <= end) runChoices(required.color, start, end, null);
  }
  return [...found.values()];
}
function rackOnlySolverCandidates(state: DigitalGameState, player: Seat): SolverMeld[] {
  const rack = state.racks[player] ?? [];
  const found = new Map<string, SolverMeld>();
  for (const id of rack)
    for (const candidate of solverCandidatesContaining(state, rack, id)) found.set(candidateKey(candidate.ids), candidate);
  return [...found.values()];
}
function hasInitialThirty(state: DigitalGameState, player: Seat): boolean {
  const candidates = rackOnlySolverCandidates(state, player).sort((a, b) => b.score - a.score);
  const used = new Set<string>();
  const memo = new Set<string>();
  const search = (index: number, score: number): boolean => {
    if (score >= INITIAL_MELD_POINTS) return true;
    if (index >= candidates.length) return false;
    const key = `${index}:${score}:${[...used].sort().join(',')}`;
    if (memo.has(key)) return false;
    memo.add(key);
    for (let i = index; i < candidates.length; i++) {
      const candidate = candidates[i];
      if (candidate.ids.some((id) => used.has(id))) continue;
      for (const id of candidate.ids) used.add(id);
      if (search(i + 1, score + candidate.score)) return true;
      for (const id of candidate.ids) used.delete(id);
    }
    return false;
  };
  return search(0, 0);
}

/** Exhaustive Classic rules oracle for blocked-game adjudication; not an AI move list. */
export function hasClassicLegalPlay(state: DigitalGameState, player: Seat): boolean {
  if (state.winner !== null || state.drawReason) return false;
  const rack = state.racks[player] ?? [];
  if (!rack.length) return false;
  if (!state.hasCompletedInitialMeld[player]) return hasInitialThirty(state, player);
  if (rackOnlySolverCandidates(state, player).length) return true;
  const tableIds = state.table.flatMap((meld) => meld.tiles);
  if (!tableIds.length) return false;
  const availableIds = [...tableIds, ...rack];
  const tableSet = new Set(tableIds);
  const rackSet = new Set(rack);
  const candidateCache = new Map<string, SolverMeld[]>();
  const candidatesFor = (requiredId: string) => {
    const cached = candidateCache.get(requiredId);
    if (cached) return cached;
    const candidates = solverCandidatesContaining(state, availableIds, requiredId);
    candidateCache.set(requiredId, candidates);
    return candidates;
  };
  const memo = new Set<string>();
  const search = (remaining: Set<string>, usedRack: Set<string>): boolean => {
    if (!remaining.size) return usedRack.size > 0;
    const memoKey = `${[...remaining].sort().join(',')}|${[...usedRack].sort().join(',')}`;
    if (memo.has(memoKey)) return false;
    memo.add(memoKey);
    let compatible: SolverMeld[] = [];
    let minimum = Infinity;
    for (const id of remaining) {
      const list = candidatesFor(id).filter((candidate) => {
        for (const candidateId of candidate.ids) {
          if (tableSet.has(candidateId) && !remaining.has(candidateId)) return false;
          if (rackSet.has(candidateId) && usedRack.has(candidateId)) return false;
        }
        return true;
      });
      if (!list.length) return false;
      if (list.length < minimum) {
        compatible = list;
        minimum = list.length;
      }
    }
    compatible.sort((a, b) => {
      const aRack = a.ids.some((id) => rackSet.has(id)) ? 1 : 0;
      const bRack = b.ids.some((id) => rackSet.has(id)) ? 1 : 0;
      return bRack - aRack || b.ids.length - a.ids.length;
    });
    for (const candidate of compatible) {
      const nextRemaining = new Set(remaining);
      const nextUsedRack = new Set(usedRack);
      for (const id of candidate.ids) {
        if (tableSet.has(id)) nextRemaining.delete(id);
        else if (rackSet.has(id)) nextUsedRack.add(id);
      }
      if (search(nextRemaining, nextUsedRack)) return true;
    }
    return false;
  };
  return search(new Set(tableIds), new Set());
}
export function isClassicBlocked(state: DigitalGameState): boolean {
  if (state.drawPool.length) return false;
  return seats(countOf(state)).every((seat) => !hasClassicLegalPlay(state, seat));
}

function parseMeld(value: unknown): CommitMeldIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RuleError('invalid-move');
  const meld = value as Record<string, unknown>;
  if (Object.keys(meld).some((key) => !['id', 'tiles'].includes(key))) throw new RuleError('invalid-move');
  if (meld.id !== undefined && (typeof meld.id !== 'string' || !meld.id || meld.id.length > 80))
    throw new RuleError('invalid-move');
  if (!Array.isArray(meld.tiles) || meld.tiles.length < 1 || meld.tiles.length > 13 || !meld.tiles.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 80))
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
function initialMeldScore(state: DigitalGameState, table: CommitMeldIntent[], oldTableIds: Set<string>): number {
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
  const otherRackTiles = new Set(state.racks.flatMap((items, index) => (index === player ? [] : items)));
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
      if (meld.tiles.some((id) => oldTableIds.has(id)) && !oldSignatures.has(key)) throw new RuleError('initial-table-locked');
    }
    for (const [key, count] of oldSignatures)
      if ((newSignatures.get(key) ?? 0) < count) throw new RuleError('initial-table-locked');
    if (initialMeldScore(state, move.table, oldTableIds) < INITIAL_MELD_POINTS) throw new RuleError('initial-meld-30');
  }
  const playedSet = new Set(played);
  const nextRack = (state.racks[player] ?? []).filter((id) => !playedSet.has(id));
  const melds = tableValidation.melds.map((meld, index) => ({ ...meld, id: move.table[index].id ?? `m${state.ply + 1}-${index}` }));
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
  return { ...state, winner, scores: calculateBlockedScores(state, winner) };
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
    if (!drawPool.length && emptyPoolPasses >= playerCount && isClassicBlocked(next)) next = finishBlockedRound(next);
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
      if (!tile.isJoker && tile.value === value && tile.color && !byColor.has(tile.color)) byColor.set(tile.color, tile.id);
    const ids = [...byColor.values()];
    if (ids.length >= 3) candidates.push(ids.slice(0, 3));
    if (ids.length === 4) candidates.push(ids);
    if (ids.length === 2 && jokers.length) candidates.push([...ids, jokers[0]]);
  }
  for (const color of DIGITAL_COLORS) {
    const byValue = new Map<number, string>();
    for (const tile of rackTiles)
      if (!tile.isJoker && tile.color === color && tile.value !== null && !byValue.has(tile.value)) byValue.set(tile.value, tile.id);
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

/** Bounded AI generator; never use this as the Classic blocked-game oracle. */
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
  const averagePenalty = others.reduce<number>((sum, seat) => sum + rackPenalty(state, seat), 0) / others.length;
  const averageCount = others.reduce<number>((sum, seat) => sum + state.rackCounts[seat], 0) / others.length;
  const initialLead = (state.hasCompletedInitialMeld[player] ? 40 : 0) - others.reduce<number>((sum, seat) => sum + (state.hasCompletedInitialMeld[seat] ? 40 : 0), 0) / others.length;
  return (averagePenalty - rackPenalty(state, player)) * 4 + (averageCount - state.rackCounts[player]) * 20 + initialLead;
}
export function projectDigitalState(state: DigitalGameState, viewer: Seat): DigitalGameState {
  const playerCount = countOf(state);
  const visible = new Set<string>([...(state.racks[viewer] ?? []), ...state.table.flatMap((meld) => meld.tiles)]);
  const tiles = Object.fromEntries(Object.entries(state.tiles).filter(([id]) => visible.has(id)));
  const racks = state.racks.map((rack, index) => index === viewer ? [...rack] : Array.from({ length: state.rackCounts[index] }, (_, item) => `hidden-rack-${index}-${item}`));
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
  timeoutMove: { type: 'draw' },
  view: projectDigitalState,
};
