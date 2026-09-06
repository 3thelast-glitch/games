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
 * Digital table/rack manipulation is intentionally transactional in the UI:
 * workingTable/workingRack are never authoritative before Commit. Therefore a
 * timeout must never attempt to serialize an incomplete draft. Applying the
 * existing automatic draw/pass transition to the canonical state preserves the
 * complete pre-turn table and all pre-turn rack tiles, then advances ply/turn.
 * That ply/turn change causes every client to rebuild its local draft from this
 * authoritative snapshot, producing a full rollback of unfinished manipulation.
 *
 * The existing one-tile timeout consequence is retained when the pool has a
 * tile; an empty pool behaves as a pass. The separate three-tile incomplete
 * manipulation penalty remains a later Classic migration phase.
 */
export function applyClassicTimeoutRollback(state: DigitalGameState): DigitalGameState {
  const next = applyDigital(state, { type: 'draw' });
  return { ...next, lastAction: 'timeout' };
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
  if (move.type === 'pass') {
    if (state.winner !== null || state.drawReason) throw new RuleError('game-over');
    if (state.drawPool.length) throw new RuleError('pass-pool-not-empty');
    const next = applyDigital(state, { type: 'draw' });
    return { ...next, lastAction: 'pass' };
  }
  if (move.type === 'draw' && !state.drawPool.length) {
    const next = applyDigital(state, move);
    return { ...next, lastAction: 'pass' };
  }
  if (move.type === 'commit') assertClassicJokerCommit(state, move);
  return applyDigital(state, move);
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
  timeoutMove,
  view: projectDigitalState,
};