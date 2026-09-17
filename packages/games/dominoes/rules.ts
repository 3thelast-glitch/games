import {
  RuleError,
  isGameOver,
  opponent,
  type Player,
  type RulesEngine,
  type Validation,
} from '../../core/src/game.ts';
import {
  createDominoes,
  dominoTile,
  type DominoChainTile,
  type DominoesMove,
  type DominoesState,
  type DominoPublicAction,
  type DominoSide,
  type DominoTileId,
} from './state.ts';

export function parseDominoMove(input: unknown): DominoesMove {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RuleError('invalid-move');
  const move = input as Record<string, unknown>;
  if (move.type === 'draw' || move.type === 'pass') {
    if (Object.keys(move).length !== 1) throw new RuleError('invalid-move');
    return { type: move.type };
  }
  if (move.type === 'play') {
    if (
      Object.keys(move).length !== 3 ||
      typeof move.tileId !== 'string' ||
      (move.side !== 'left' && move.side !== 'right')
    )
      throw new RuleError('invalid-move');
    try {
      dominoTile(move.tileId);
    } catch {
      throw new RuleError('invalid-domino-tile');
    }
    return { type: 'play', tileId: move.tileId, side: move.side };
  }
  throw new RuleError('invalid-move');
}

export const dominoPipSum = (tileId: DominoTileId) => {
  const tile = dominoTile(tileId);
  return tile.a + tile.b;
};

export function dominoHandPips(hand: readonly DominoTileId[]): number {
  return hand.reduce((sum, tileId) => sum + dominoPipSum(tileId), 0);
}

export function dominoOpenEnds(state: DominoesState): [number, number] | null {
  if (!state.chain.length) return null;
  return [state.chain[0].leftValue, state.chain[state.chain.length - 1].rightValue];
}

function orientationFor(
  state: DominoesState,
  tileId: DominoTileId,
  side: DominoSide,
): { leftValue: number; rightValue: number } | null {
  const tile = dominoTile(tileId);
  if (!state.chain.length) return { leftValue: tile.a, rightValue: tile.b };
  const ends = dominoOpenEnds(state)!;
  if (side === 'left') {
    if (tile.b === ends[0]) return { leftValue: tile.a, rightValue: tile.b };
    if (tile.a === ends[0]) return { leftValue: tile.b, rightValue: tile.a };
    return null;
  }
  if (tile.a === ends[1]) return { leftValue: tile.a, rightValue: tile.b };
  if (tile.b === ends[1]) return { leftValue: tile.b, rightValue: tile.a };
  return null;
}

export function playableDominoSides(
  state: DominoesState,
  tileId: DominoTileId,
): DominoSide[] {
  if (state.openingPending) {
    return state.turn === state.openingStarter && tileId === state.openingTileId ? ['right'] : [];
  }
  return (['left', 'right'] as const).filter((side) => orientationFor(state, tileId, side));
}

export function dominoHandHasPlay(state: DominoesState, player: Player): boolean {
  if (state.openingPending)
    return player === state.openingStarter && !!state.openingTileId && state.hands[player].includes(state.openingTileId);
  return state.hands[player].some((tileId) => playableDominoSides(state, tileId).length > 0);
}

function authoritative(state: DominoesState) {
  return state.viewerSeat === undefined;
}

function isBlocked(state: DominoesState): boolean {
  return (
    state.boneyardCount === 0 &&
    !state.openingPending &&
    !dominoHandHasPlay(state, 0) &&
    !dominoHandHasPlay(state, 1)
  );
}

function finishBlocked(state: DominoesState): DominoesState {
  const pips: [number, number] = [dominoHandPips(state.hands[0]), dominoHandPips(state.hands[1])];
  if (pips[0] === pips[1])
    return { ...state, blockedPips: pips, winner: null, drawReason: 'domino-blocked-tie', resultReason: 'domino-blocked' };
  return {
    ...state,
    blockedPips: pips,
    winner: pips[0] < pips[1] ? 0 : 1,
    drawReason: null,
    resultReason: 'domino-blocked',
  };
}

export function validateDominoMove(state: DominoesState, input: DominoesMove): Validation {
  try {
    const move = parseDominoMove(input);
    if (isGameOver(state)) throw new RuleError('game-over');
    if (!authoritative(state)) throw new RuleError('projected-state-read-only');
    if (state.openingPending) {
      if (move.type !== 'play') throw new RuleError('opening-play-required');
      if (state.turn !== state.openingStarter || move.tileId !== state.openingTileId)
        throw new RuleError('opening-tile-required');
    }
    const hand = state.hands[state.turn];
    const hasPlay = dominoHandHasPlay(state, state.turn);
    if (move.type === 'play') {
      if (!hand.includes(move.tileId)) throw new RuleError('tile-not-owned');
      if (!playableDominoSides(state, move.tileId).includes(move.side))
        throw new RuleError('domino-side-mismatch');
      return { ok: true };
    }
    if (hasPlay) throw new RuleError(move.type === 'draw' ? 'draw-while-playable' : 'pass-while-playable');
    if (move.type === 'draw') {
      if (!state.boneyardCount || !state.boneyard.length) throw new RuleError('boneyard-empty');
      return { ok: true };
    }
    if (state.boneyardCount > 0) throw new RuleError('draw-required');
    if (isBlocked(state)) throw new RuleError('game-over');
    return { ok: true };
  } catch (error) {
    if (error instanceof RuleError) return { ok: false, code: error.code };
    throw error;
  }
}

function assertValid(state: DominoesState, move: DominoesMove) {
  const validation = validateDominoMove(state, move);
  if (!validation.ok) throw new RuleError(validation.code);
}

function cloneState(state: DominoesState): DominoesState {
  return {
    ...state,
    hands: [[...state.hands[0]], [...state.hands[1]]],
    handCounts: [...state.handCounts] as [number, number],
    boneyard: [...state.boneyard],
    chain: state.chain.map((tile) => ({ ...tile })),
    blockedPips: state.blockedPips ? ([...state.blockedPips] as [number, number]) : null,
    lastAction: state.lastAction ? ({ ...state.lastAction } as DominoPublicAction) : null,
  };
}

export function applyDominoMove(state: DominoesState, input: DominoesMove): DominoesState {
  const move = parseDominoMove(input);
  assertValid(state, move);
  let next = cloneState(state);
  const player = state.turn;
  next.ply = state.ply + 1;
  next.resultReason = undefined;

  if (move.type === 'draw') {
    const tileId = next.boneyard.shift();
    if (!tileId) throw new RuleError('boneyard-empty');
    next.hands[player].push(tileId);
    next.handCounts[player] = next.hands[player].length;
    next.boneyardCount = next.boneyard.length;
    next.lastAction = { type: 'draw', player, handCount: next.handCounts[player], tileId };
    if (isBlocked(next)) next = finishBlocked(next);
    return next;
  }

  if (move.type === 'pass') {
    next.lastAction = { type: 'pass', player };
    next.turn = opponent(player);
    return next;
  }

  const orientation = orientationFor(state, move.tileId, move.side);
  if (!orientation) throw new RuleError('domino-side-mismatch');
  const handIndex = next.hands[player].indexOf(move.tileId);
  if (handIndex < 0) throw new RuleError('tile-not-owned');
  next.hands[player].splice(handIndex, 1);
  next.handCounts[player] = next.hands[player].length;
  const placed: DominoChainTile = { tileId: move.tileId, ...orientation };
  if (!next.chain.length || move.side === 'right') next.chain.push(placed);
  else next.chain.unshift(placed);
  next.openingPending = false;
  next.openingTileId = null;
  next.lastAction = { type: 'play', player, tileId: move.tileId, side: move.side, ...orientation };

  if (next.hands[player].length === 0) {
    next.winner = player;
    next.resultReason = 'domino-out';
    return next;
  }
  next.turn = opponent(player);
  if (isBlocked(next)) next = finishBlocked(next);
  return next;
}

export function legalDominoMoves(state: DominoesState): DominoesMove[] {
  if (isGameOver(state)) return [];
  if (state.viewerSeat !== undefined && state.viewerSeat !== state.turn) return [];
  const hand = state.hands[state.turn];
  if (state.openingPending) {
    if (state.turn !== state.openingStarter || !state.openingTileId || !hand.includes(state.openingTileId)) return [];
    return [{ type: 'play', tileId: state.openingTileId, side: 'right' }];
  }
  const plays = hand.flatMap((tileId) =>
    playableDominoSides(state, tileId).map((side) => ({ type: 'play' as const, tileId, side })),
  );
  if (plays.length) return plays;
  if (state.boneyardCount > 0) return [{ type: 'draw' }];
  return [{ type: 'pass' }];
}

export function evaluateDominoes(state: DominoesState, player: Player): number {
  if (state.winner !== null) return state.winner === player ? 100000 : -100000;
  if (state.drawReason) return 0;
  const rival = opponent(player),
    ownPips = dominoHandPips(state.hands[player]),
    rivalPips = dominoHandPips(state.hands[rival]);
  let value = (rivalPips - ownPips) * 12 + (state.handCounts[rival] - state.handCounts[player]) * 18;
  if (state.turn === player) value += legalDominoMoves(state).filter((move) => move.type === 'play').length * 4;
  return value;
}

function sanitizeLastAction(action: DominoPublicAction | null, viewer: Player | null): DominoPublicAction | null {
  if (!action) return null;
  if (action.type !== 'draw' || action.player === viewer) return { ...action };
  const { tileId: _hidden, ...publicAction } = action;
  return publicAction;
}

/** Explicit allowlist projection. Never spread the authoritative state. */
export function projectDominoState(state: DominoesState, viewer: Player | null): DominoesState {
  const hands: [DominoTileId[], DominoTileId[]] = [[], []];
  if (viewer !== null) hands[viewer] = [...state.hands[viewer]];
  return {
    gameId: 'dominoes',
    playerCount: 2,
    hands,
    handCounts: [...state.handCounts] as [number, number],
    boneyard: [],
    boneyardCount: state.boneyardCount,
    chain: state.chain.map((tile) => ({ ...tile })),
    openingStarter: state.openingStarter,
    openingTileId:
      state.openingPending && viewer === state.openingStarter ? state.openingTileId : null,
    openingPending: state.openingPending,
    seed: 0,
    lastAction: sanitizeLastAction(state.lastAction, viewer),
    blockedPips: state.blockedPips ? ([...state.blockedPips] as [number, number]) : null,
    viewerSeat: viewer,
    turn: state.turn,
    ply: state.ply,
    winner: state.winner,
    drawReason: state.drawReason ?? null,
    resultReason: state.resultReason,
  };
}

export const dominoesEngine: RulesEngine<DominoesState, DominoesMove, Player> = {
  id: 'dominoes',
  winReason: 'domino-out',
  create: () => createDominoes(),
  parseMove: parseDominoMove,
  validate: validateDominoMove,
  apply: applyDominoMove,
  legalMoves: legalDominoMoves,
  evaluate: evaluateDominoes,
  view: projectDominoState,
};
