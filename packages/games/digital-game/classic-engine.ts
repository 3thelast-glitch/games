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
    if (move.type === 'draw' && !state.drawPool.length) {
      // Kept valid during the v1 -> Classic protocol migration. New clients emit `pass`.
      return { ok: true };
    }
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
  if (isTimeoutMove(move)) {
    // Existing timeout semantics remain compatible until the dedicated Classic
    // 60-second / incomplete-turn penalty phase lands.
    return applyDigital(state, { type: 'draw' });
  }
  if (move.type === 'pass') {
    if (state.winner !== null || state.drawReason) throw new RuleError('game-over');
    if (state.drawPool.length) throw new RuleError('pass-pool-not-empty');
    const next = applyDigital(state, { type: 'draw' });
    return { ...next, lastAction: 'pass' };
  }
  if (move.type === 'draw' && !state.drawPool.length) {
    // Legacy compatibility: old clients used `draw` as an empty-pool pass.
    // Treat it exactly as `pass` but mark the state with the new semantic action.
    const next = applyDigital(state, move);
    return { ...next, lastAction: 'pass' };
  }
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
