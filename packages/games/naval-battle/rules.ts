import {
  RuleError,
  isGameOver,
  opponent,
  type Player,
  type RulesEngine,
  type Validation,
} from '../../core/src/game.ts';
import {
  NAVAL_BOARD_SIZE,
  NAVAL_SHIPS,
  createNavalBattle,
  navalShip,
  type NavalBattleMove,
  type NavalBattleState,
  type NavalCoordinate,
  type NavalPlacement,
  type NavalPublicAction,
  type NavalShipId,
  type NavalShot,
} from './state.ts';

const shipIds = new Set<NavalShipId>(NAVAL_SHIPS.map((ship) => ship.id));

const ownKeys = (value: Record<string, unknown>, keys: string[]) => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const integerCoordinate = (value: unknown) =>
  Number.isInteger(value) && Number(value) >= 0 && Number(value) < NAVAL_BOARD_SIZE;

export function parseNavalMove(input: unknown): NavalBattleMove {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RuleError('invalid-move');
  const move = input as Record<string, unknown>;
  if (move.type === 'ready') {
    if (!ownKeys(move, ['type'])) throw new RuleError('invalid-move');
    return { type: 'ready' };
  }
  if (move.type === 'fire') {
    if (
      !ownKeys(move, ['type', 'row', 'col']) ||
      !integerCoordinate(move.row) ||
      !integerCoordinate(move.col)
    )
      throw new RuleError('invalid-coordinate');
    return { type: 'fire', row: Number(move.row), col: Number(move.col) };
  }
  if (move.type === 'place') {
    if (
      !ownKeys(move, ['type', 'shipId', 'row', 'col', 'orientation']) ||
      typeof move.shipId !== 'string' ||
      !shipIds.has(move.shipId as NavalShipId) ||
      !integerCoordinate(move.row) ||
      !integerCoordinate(move.col) ||
      (move.orientation !== 'horizontal' && move.orientation !== 'vertical')
    )
      throw new RuleError('invalid-placement');
    return {
      type: 'place',
      shipId: move.shipId as NavalShipId,
      row: Number(move.row),
      col: Number(move.col),
      orientation: move.orientation,
    };
  }
  throw new RuleError('invalid-move');
}

export const navalCellKey = ({ row, col }: NavalCoordinate) => `${row}:${col}`;

export function navalPlacementCells(placement: NavalPlacement): NavalCoordinate[] {
  const length = navalShip(placement.shipId).length;
  return Array.from({ length }, (_, index) => ({
    row: placement.row + (placement.orientation === 'vertical' ? index : 0),
    col: placement.col + (placement.orientation === 'horizontal' ? index : 0),
  }));
}

export function navalPlacementInBounds(placement: NavalPlacement): boolean {
  return navalPlacementCells(placement).every(
    ({ row, col }) => row >= 0 && row < NAVAL_BOARD_SIZE && col >= 0 && col < NAVAL_BOARD_SIZE,
  );
}

export function isNavalPlacementValid(
  fleet: readonly NavalPlacement[],
  placement: NavalPlacement,
): boolean {
  if (!navalPlacementInBounds(placement)) return false;
  const occupied = new Set(
    fleet
      .filter((ship) => ship.shipId !== placement.shipId)
      .flatMap(navalPlacementCells)
      .map(navalCellKey),
  );
  return navalPlacementCells(placement).every((cell) => !occupied.has(navalCellKey(cell)));
}

export function isCompleteNavalFleet(fleet: readonly NavalPlacement[]): boolean {
  if (fleet.length !== NAVAL_SHIPS.length) return false;
  if (new Set(fleet.map((placement) => placement.shipId)).size !== NAVAL_SHIPS.length) return false;
  if (!NAVAL_SHIPS.every((ship) => fleet.some((placement) => placement.shipId === ship.id)))
    return false;
  const occupied = new Set<string>();
  for (const placement of fleet) {
    if (!isNavalPlacementValid(fleet, placement)) return false;
    for (const cell of navalPlacementCells(placement)) {
      const key = navalCellKey(cell);
      if (occupied.has(key)) return false;
      occupied.add(key);
    }
  }
  return occupied.size === NAVAL_SHIPS.reduce((sum, ship) => sum + ship.length, 0);
}

function authoritative(state: NavalBattleState) {
  return state.viewerSeat === undefined;
}

function hasShot(state: NavalBattleState, shooter: Player, row: number, col: number) {
  return state.shots.some((shot) => shot.shooter === shooter && shot.row === row && shot.col === col);
}

function shipAt(
  fleet: readonly NavalPlacement[],
  row: number,
  col: number,
): NavalPlacement | undefined {
  return fleet.find((placement) =>
    navalPlacementCells(placement).some((cell) => cell.row === row && cell.col === col),
  );
}

function previousHitsOnShip(
  state: NavalBattleState,
  shooter: Player,
  placement: NavalPlacement,
): Set<string> {
  const cells = new Set(navalPlacementCells(placement).map(navalCellKey));
  return new Set(
    state.shots
      .filter(
        (shot) =>
          shot.shooter === shooter &&
          (shot.outcome === 'hit' || shot.outcome === 'sunk') &&
          cells.has(navalCellKey(shot)),
      )
      .map(navalCellKey),
  );
}

export function validateNavalMove(state: NavalBattleState, input: NavalBattleMove): Validation {
  try {
    const move = parseNavalMove(input);
    if (isGameOver(state)) throw new RuleError('game-over');
    if (!authoritative(state)) throw new RuleError('projected-state-read-only');

    const player = state.turn;
    if (state.phase === 'placement') {
      if (move.type === 'fire') throw new RuleError('naval-placement-phase');
      if (state.ready[player]) throw new RuleError('naval-fleet-locked');
      if (move.type === 'ready') {
        if (!isCompleteNavalFleet(state.fleets[player])) throw new RuleError('naval-fleet-incomplete');
        return { ok: true };
      }
      const placement: NavalPlacement = {
        shipId: move.shipId,
        row: move.row,
        col: move.col,
        orientation: move.orientation,
      };
      if (!navalPlacementInBounds(placement)) throw new RuleError('naval-out-of-bounds');
      if (!isNavalPlacementValid(state.fleets[player], placement))
        throw new RuleError('naval-overlap');
      return { ok: true };
    }

    if (move.type !== 'fire') throw new RuleError('naval-battle-phase');
    if (!state.ready[0] || !state.ready[1]) throw new RuleError('naval-not-ready');
    if (hasShot(state, player, move.row, move.col)) throw new RuleError('naval-duplicate-shot');
    return { ok: true };
  } catch (error) {
    if (error instanceof RuleError) return { ok: false, code: error.code };
    throw error;
  }
}

function assertValid(state: NavalBattleState, move: NavalBattleMove) {
  const validation = validateNavalMove(state, move);
  if (!validation.ok) throw new RuleError(validation.code);
}

function cloneState(state: NavalBattleState): NavalBattleState {
  return {
    ...state,
    fleets: [
      state.fleets[0].map((placement) => ({ ...placement })),
      state.fleets[1].map((placement) => ({ ...placement })),
    ],
    ready: [...state.ready] as [boolean, boolean],
    shots: state.shots.map((shot) => ({
      ...shot,
      sunkCells: shot.sunkCells?.map((cell) => ({ ...cell })),
    })),
    remainingShips: [...state.remainingShips] as [number, number],
    lastAction: state.lastAction ? ({ ...state.lastAction } as NavalPublicAction) : null,
  };
}

export function applyNavalMove(state: NavalBattleState, input: NavalBattleMove): NavalBattleState {
  const move = parseNavalMove(input);
  assertValid(state, move);
  const next = cloneState(state);
  const player = state.turn;
  next.ply = state.ply + 1;
  next.resultReason = undefined;

  if (move.type === 'place') {
    const replacement: NavalPlacement = {
      shipId: move.shipId,
      row: move.row,
      col: move.col,
      orientation: move.orientation,
    };
    next.fleets[player] = [
      ...next.fleets[player].filter((placement) => placement.shipId !== move.shipId),
      replacement,
    ];
    next.lastAction = null;
    return next;
  }

  if (move.type === 'ready') {
    next.ready[player] = true;
    next.lastAction = { type: 'ready', player };
    if (next.ready[0] && next.ready[1]) {
      next.phase = 'battle';
      next.turn = next.starter;
    } else {
      next.turn = opponent(player);
    }
    return next;
  }

  const defender = opponent(player);
  const placement = shipAt(next.fleets[defender], move.row, move.col);
  let shot: NavalShot;
  if (!placement) {
    shot = { shooter: player, row: move.row, col: move.col, outcome: 'miss' };
  } else {
    const hitKeys = previousHitsOnShip(state, player, placement);
    hitKeys.add(navalCellKey(move));
    const cells = navalPlacementCells(placement);
    const sunk = cells.every((cell) => hitKeys.has(navalCellKey(cell)));
    if (sunk) {
      shot = {
        shooter: player,
        row: move.row,
        col: move.col,
        outcome: 'sunk',
        sunkShipId: placement.shipId,
        sunkCells: cells.map((cell) => ({ ...cell })),
      };
      next.remainingShips[defender] = Math.max(0, next.remainingShips[defender] - 1);
    } else {
      shot = { shooter: player, row: move.row, col: move.col, outcome: 'hit' };
    }
  }

  next.shots.push(shot);
  next.lastAction = {
    type: 'fire',
    player,
    row: move.row,
    col: move.col,
    outcome: shot.outcome,
    sunkShipId: shot.sunkShipId,
  };

  if (next.remainingShips[defender] === 0) {
    next.winner = player;
    next.resultReason = 'naval-fleet-destroyed';
    return next;
  }

  next.turn = defender;
  return next;
}

function placementMovesForFirstMissing(state: NavalBattleState, player: Player): NavalBattleMove[] {
  const fleet = state.fleets[player];
  const missing = NAVAL_SHIPS.find((ship) => !fleet.some((placement) => placement.shipId === ship.id));
  if (!missing) return isCompleteNavalFleet(fleet) ? [{ type: 'ready' }] : [];
  const moves: NavalBattleMove[] = [];
  for (const orientation of ['horizontal', 'vertical'] as const)
    for (let row = 0; row < NAVAL_BOARD_SIZE; row++)
      for (let col = 0; col < NAVAL_BOARD_SIZE; col++) {
        const placement: NavalPlacement = { shipId: missing.id, row, col, orientation };
        if (isNavalPlacementValid(fleet, placement)) moves.push({ type: 'place', ...placement });
      }
  return moves;
}

export function legalNavalMoves(state: NavalBattleState): NavalBattleMove[] {
  if (isGameOver(state)) return [];
  if (state.viewerSeat !== undefined && state.viewerSeat !== null && state.viewerSeat !== state.turn)
    return [];
  if (state.viewerSeat === null) return [];
  if (state.phase === 'placement') {
    if (state.ready[state.turn]) return [];
    return placementMovesForFirstMissing(state, state.turn);
  }

  const moves: NavalBattleMove[] = [];
  for (let row = 0; row < NAVAL_BOARD_SIZE; row++)
    for (let col = 0; col < NAVAL_BOARD_SIZE; col++)
      if (!hasShot(state, state.turn, row, col)) moves.push({ type: 'fire', row, col });
  return moves;
}

export function evaluateNavalBattle(state: NavalBattleState, player: Player): number {
  if (state.winner !== null) return state.winner === player ? 100000 : -100000;
  const rival = opponent(player);
  if (state.phase === 'placement')
    return (state.fleets[player].length - state.fleets[rival].length) * 5 + (state.ready[player] ? 20 : 0);
  const ownHits = state.shots.filter(
    (shot) => shot.shooter === player && (shot.outcome === 'hit' || shot.outcome === 'sunk'),
  ).length;
  const rivalHits = state.shots.filter(
    (shot) => shot.shooter === rival && (shot.outcome === 'hit' || shot.outcome === 'sunk'),
  ).length;
  return (
    (state.remainingShips[player] - state.remainingShips[rival]) * 120 +
    (ownHits - rivalHits) * 10
  );
}

/** Explicit allowlist projection. Enemy unsunk fleet geometry is never copied. */
export function projectNavalState(
  state: NavalBattleState,
  viewer: Player | null,
): NavalBattleState {
  const fleets: [NavalPlacement[], NavalPlacement[]] = [[], []];
  if (viewer !== null) fleets[viewer] = state.fleets[viewer].map((placement) => ({ ...placement }));
  return {
    gameId: 'navalBattle',
    playerCount: 2,
    phase: state.phase,
    fleets,
    ready: [...state.ready] as [boolean, boolean],
    shots: state.shots.map((shot) => ({
      ...shot,
      sunkCells: shot.sunkCells?.map((cell) => ({ ...cell })),
    })),
    remainingShips: [...state.remainingShips] as [number, number],
    starter: state.starter,
    lastAction: state.lastAction ? ({ ...state.lastAction } as NavalPublicAction) : null,
    viewerSeat: viewer,
    turn: state.turn,
    ply: state.ply,
    winner: state.winner,
    drawReason: state.drawReason ?? null,
    resultReason: state.resultReason,
  };
}

export const navalBattleEngine: RulesEngine<NavalBattleState, NavalBattleMove, Player> = {
  id: 'navalBattle',
  winReason: 'naval-fleet-destroyed',
  create: () => createNavalBattle(),
  parseMove: parseNavalMove,
  validate: validateNavalMove,
  apply: applyNavalMove,
  legalMoves: legalNavalMoves,
  evaluate: evaluateNavalBattle,
  view: projectNavalState,
};
