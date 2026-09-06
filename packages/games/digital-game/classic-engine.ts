import {
  RuleError,
  type RulesEngine,
  type Seat,
  type Validation,
} from '../../core/src/game.ts';
import {
  applyDigital,
  digitalLegalMoves,
  evaluateDigital,
  parseDigitalMove,
  projectDigitalState,
  validateDigital,
} from './rules.ts';
import {
  createDigitalGameForPlayers,
  type CommitMeldIntent,
  type DigitalGameState,
} from './state.ts';

export type ClassicDigitalGameMove =
  | { type: 'draw' }
  | { type: 'pass' }
  | { type: 'manipulation-start'; ply: number }
  | { type: 'manipulation-reset'; ply: number }
  | { type: 'commit'; table: CommitMeldIntent[] };

const timeoutMarker = Symbol('digital-classic-timeout');
type TimeoutMove = { type: '__classic-timeout__'; [timeoutMarker]: true };
type InternalClassicMove = ClassicDigitalGameMove | TimeoutMove;

const timeoutMove: TimeoutMove = Object.freeze({
  type: '__classic-timeout__' as const,
  [timeoutMarker]: true as const,
});

function isTimeoutMove(value: unknown): value is TimeoutMove {
  return !!value && typeof value === 'object' && (value as TimeoutMove)[timeoutMarker] === true;
}

function isManipulationMetadataMove(
  move: InternalClassicMove,
): move is Extract<ClassicDigitalGameMove, { type: 'manipulation-start' | 'manipulation-reset' }> {
  return move.type === 'manipulation-start' || move.type === 'manipulation-reset';
}

const meldSignature = (tiles: string[]) => [...tiles].sort().join('|');

/**
 * Enforces the Rummikub Classic joker-retrieval constraints that are not
 * expressible by whole-table validity alone.
 */
function assertClassicJokerCommit(
  state: DigitalGameState,
  move: Extract<ClassicDigitalGameMove, { type: 'commit' }>,
): void {
  const oldTableIds = new Set(state.table.flatMap((meld) => meld.tiles));
  const newTableIds = new Set(move.table.flatMap((meld) => meld.tiles));
  const rack = new Set(state.racks[state.turn] ?? []);
  const playedRackTiles = [...newTableIds].filter((id) => !oldTableIds.has(id) && rack.has(id));
  const oldMeldSignatures = new Set(state.table.map((meld) => meldSignature(meld.tiles)));

  for (const source of state.table) {
    const tableJokers = source.tiles.filter((id) => state.tiles[id]?.isJoker);
    if (!tableJokers.length) continue;
    const sourceSignature = meldSignature(source.tiles);

    for (const jokerId of tableJokers) {
      const destinations = move.table.filter((meld) => meld.tiles.includes(jokerId));
      if (destinations.length > 1) continue;

      const destination = destinations[0];
      const untouched = destination && meldSignature(destination.tiles) === sourceSignature;
      if (untouched) continue;

      if (!state.hasCompletedInitialMeld[state.turn]) throw new RuleError('joker-before-initial-meld');
      if (!destination) throw new RuleError('joker-must-be-reused');
      if (!playedRackTiles.length) throw new RuleError('joker-rack-tile-required');

      const destinationSignature = meldSignature(destination.tiles);
      if (oldMeldSignatures.has(destinationSignature)) throw new RuleError('joker-new-set-required');

      const destinationIds = new Set(destination.tiles);
      const merelyExtendsExistingSet = state.table.some(
        (oldMeld) =>
          !oldMeld.tiles.includes(jokerId) &&
          oldMeld.tiles.length < destination.tiles.length &&
          oldMeld.tiles.every((id) => destinationIds.has(id)),
      );
      if (merelyExtendsExistingSet) throw new RuleError('joker-new-set-required');
    }
  }
}

/**
 * Applies the Classic one-minute timeout to the last authoritative turn state.
 *
 * workingTable/workingRack remain client-local until Commit, so the state passed
 * here is already the complete pre-turn authoritative snapshot. A dirty draft
 * therefore rolls back by simply discarding that draft and applying the Classic
 * penalty to this canonical state.
 *
 * Clean timeout: existing one-tile draw/pass behavior.
 * Incomplete manipulation: draw three tiles from the pool when available (or
 * every remaining tile when fewer than three remain), then advance the turn
 * once. The table and all pre-turn rack tiles are preserved exactly before the
 * penalty tiles are appended.
 */
export function applyClassicTimeoutRollback(state: DigitalGameState): DigitalGameState {
  const requestedDraws = state.manipulationInProgress ? 3 : 1;
  const availableDraws = Math.min(requestedDraws, state.drawPool.length);
  let staged = state;

  // applyDigital draws one tile and advances the turn. Pre-stage all but the
  // final penalty tile so every penalty tile goes to the timed-out seat while
  // the turn still advances exactly once.
  if (availableDraws > 1) {
    const racks = state.racks.map((rack) => [...rack]);
    const drawPool = [...state.drawPool];
    for (let index = 0; index < availableDraws - 1; index++) {
      const tile = drawPool.pop();
      if (tile) racks[state.turn].push(tile);
    }
    staged = {
      ...state,
      racks,
      rackCounts: racks.map((rack) => rack.length),
      drawPool,
    };
  }

  const next = applyDigital(staged, { type: 'draw' });
  return { ...next, lastAction: 'timeout', manipulationInProgress: false };
}

/**
 * Transitional Classic protocol adapter.
 *
 * New clients use an explicit `pass` when the pool is empty. Legacy clients may
 * still send `draw` in that state until the protocol migration is complete.
 * The internal timeout sentinel cannot be forged through JSON because its
 * authority marker is a private Symbol.
 */
export function parseClassicDigitalMove(input: unknown): InternalClassicMove {
  if (isTimeoutMove(input)) return input;
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const move = input as Record<string, unknown>;
    if (move.type === 'pass') {
      if (Object.keys(move).some((key) => key !== 'type')) throw new RuleError('invalid-move');
      return { type: 'pass' };
    }
    if (move.type === 'manipulation-start' || move.type === 'manipulation-reset') {
      if (Object.keys(move).some((key) => !['type', 'ply'].includes(key)))
        throw new RuleError('invalid-move');
      if (!Number.isInteger(move.ply) || (move.ply as number) < 0)
        throw new RuleError('invalid-move');
      return { type: move.type, ply: move.ply as number };
    }
  }
  return parseDigitalMove(input) as ClassicDigitalGameMove;
}

export function validateClassicDigital(
  state: DigitalGameState,
  input: ClassicDigitalGameMove,
): Validation {
  try {
    const move = parseClassicDigitalMove(input);
    if (isTimeoutMove(move)) return { ok: true };
    if (state.winner !== null || state.drawReason) throw new RuleError('game-over');
    if (isManipulationMetadataMove(move)) {
      if (move.ply !== state.ply) throw new RuleError('stale-turn-draft');
      return { ok: true };
    }
    if (move.type === 'pass') {
      if (state.drawPool.length) throw new RuleError('pass-pool-not-empty');
      return { ok: true };
    }
    if (move.type === 'draw' && !state.drawPool.length) return { ok: true };
    if (move.type === 'commit') assertClassicJokerCommit(state, move);
    return validateDigital(state, move);
  } catch (error) {
    if (error instanceof RuleError) return { ok: false, code: error.code };
    throw error;
  }
}

export function applyClassicDigital(
  state: DigitalGameState,
  input: InternalClassicMove,
): DigitalGameState {
  const move = parseClassicDigitalMove(input);
  if (isTimeoutMove(move)) return applyClassicTimeoutRollback(state);
  if (state.winner !== null || state.drawReason) throw new RuleError('game-over');
  if (isManipulationMetadataMove(move)) {
    if (move.ply !== state.ply) throw new RuleError('stale-turn-draft');
    return {
      ...state,
      manipulationInProgress: move.type === 'manipulation-start',
    };
  }
  if (move.type === 'pass') {
    if (state.drawPool.length) throw new RuleError('pass-pool-not-empty');
    const next = applyDigital(state, { type: 'draw' });
    return { ...next, lastAction: 'pass', manipulationInProgress: false };
  }
  if (move.type === 'draw' && !state.drawPool.length) {
    const next = applyDigital(state, move);
    return { ...next, lastAction: 'pass', manipulationInProgress: false };
  }
  if (move.type === 'commit') assertClassicJokerCommit(state, move);
  return { ...applyDigital(state, move), manipulationInProgress: false };
}

export function classicDigitalLegalMoves(state: DigitalGameState): ClassicDigitalGameMove[] {
  if (state.winner !== null || state.drawReason) return [];
  const commits = digitalLegalMoves(state).filter(
    (move): move is Extract<ClassicDigitalGameMove, { type: 'commit' }> => move.type === 'commit',
  );
  return [state.drawPool.length ? { type: 'draw' } : { type: 'pass' }, ...commits];
}

export const classicDigitalGameEngine: RulesEngine<DigitalGameState, InternalClassicMove, Seat> = {
  id: 'digitalGame',
  minPlayers: 2,
  maxPlayers: 4,
  winReason: 'digital-win',
  create: (playerCount = 2) => createDigitalGameForPlayers(playerCount),
  parseMove: parseClassicDigitalMove,
  validate: (state, move) =>
    isTimeoutMove(move) ? { ok: true } : validateClassicDigital(state, move),
  apply: applyClassicDigital,
  legalMoves: classicDigitalLegalMoves,
  evaluate: evaluateDigital,
  isTurnMetadataMove: isManipulationMetadataMove,
  timeoutMove,
  view: projectDigitalState,
};