import {
  RuleError,
  isGameOver,
  opponent,
  type Player,
  type RulesEngine,
  type Validation,
} from '../../core/src/game.ts';
import {
  NAVAL_ABILITIES,
  NAVAL_LOADOUT_SIZE,
  isNavalAbilityId,
  uniqueNavalAbilities,
  type NavalAbilityId,
} from './abilities.ts';
import {
  NAVAL_BOARD_SIZE,
  NAVAL_SHIPS,
  createNavalBattle,
  navalShip,
  type NavalBattleMove,
  type NavalBattleState,
  type NavalCoordinate,
  type NavalPlacement,
  type NavalPrivateIntel,
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

const parseCoordinate = (value: unknown): NavalCoordinate => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RuleError('invalid-coordinate');
  const coordinate = value as Record<string, unknown>;
  if (!ownKeys(coordinate, ['row', 'col']) || !integerCoordinate(coordinate.row) || !integerCoordinate(coordinate.col))
    throw new RuleError('invalid-coordinate');
  return { row: Number(coordinate.row), col: Number(coordinate.col) };
};

export function parseNavalMove(input: unknown): NavalBattleMove {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RuleError('invalid-move');
  const move = input as Record<string, unknown>;

  if (move.type === 'selectAbilities') {
    if (!ownKeys(move, ['type', 'abilities']) || !Array.isArray(move.abilities))
      throw new RuleError('invalid-loadout');
    if (!move.abilities.every(isNavalAbilityId)) throw new RuleError('invalid-loadout');
    return { type: 'selectAbilities', abilities: [...move.abilities] as NavalAbilityId[] };
  }
  if (move.type === 'ready' || move.type === 'declineHunter') {
    if (!ownKeys(move, ['type'])) throw new RuleError('invalid-move');
    return { type: move.type };
  }
  if (
    move.type === 'fire' ||
    move.type === 'hunterFire' ||
    move.type === 'sonarPulse' ||
    move.type === 'emergencyRepair' ||
    move.type === 'signalJammer'
  ) {
    if (!ownKeys(move, ['type', 'row', 'col']) || !integerCoordinate(move.row) || !integerCoordinate(move.col))
      throw new RuleError('invalid-coordinate');
    return { type: move.type, row: Number(move.row), col: Number(move.col) } as NavalBattleMove;
  }
  if (move.type === 'twinSalvo') {
    if (!ownKeys(move, ['type', 'targets']) || !Array.isArray(move.targets) || move.targets.length !== 2)
      throw new RuleError('invalid-targets');
    return {
      type: 'twinSalvo',
      targets: [parseCoordinate(move.targets[0]), parseCoordinate(move.targets[1])],
    };
  }
  if (move.type === 'place' || move.type === 'silentReposition') {
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
      type: move.type,
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
  if (!NAVAL_SHIPS.every((ship) => fleet.some((placement) => placement.shipId === ship.id))) return false;
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

const authoritative = (state: NavalBattleState) => state.viewerSeat === undefined;

export function navalAbilityAvailable(
  state: NavalBattleState,
  player: Player,
  abilityId: NavalAbilityId,
): boolean {
  return state.loadouts[player].includes(abilityId) && !state.usedAbilities[player].includes(abilityId);
}

function activeShotAt(state: NavalBattleState, shooter: Player, row: number, col: number) {
  for (let index = state.shots.length - 1; index >= 0; index--) {
    const shot = state.shots[index];
    if (shot.shooter === shooter && shot.row === row && shot.col === col && !shot.repaired) return shot;
  }
  return undefined;
}

function hasActiveShot(state: NavalBattleState, shooter: Player, row: number, col: number) {
  return !!activeShotAt(state, shooter, row, col);
}

function shipAt(fleet: readonly NavalPlacement[], row: number, col: number): NavalPlacement | undefined {
  return fleet.find((placement) =>
    navalPlacementCells(placement).some((cell) => cell.row === row && cell.col === col),
  );
}

function previousActiveHitsOnShip(
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
          !shot.repaired &&
          (shot.outcome === 'hit' || shot.outcome === 'sunk') &&
          cells.has(navalCellKey(shot)),
      )
      .map(navalCellKey),
  );
}

function region(center: NavalCoordinate): NavalCoordinate[] {
  const result: NavalCoordinate[] = [];
  for (let row = Math.max(0, center.row - 1); row <= Math.min(NAVAL_BOARD_SIZE - 1, center.row + 1); row++)
    for (let col = Math.max(0, center.col - 1); col <= Math.min(NAVAL_BOARD_SIZE - 1, center.col + 1); col++)
      result.push({ row, col });
  return result;
}

const regionsOverlap = (a: NavalCoordinate, b: NavalCoordinate) => {
  const right = new Set(region(b).map(navalCellKey));
  return region(a).some((cell) => right.has(navalCellKey(cell)));
};

function isShipSunk(state: NavalBattleState, defender: Player, placement: NavalPlacement) {
  const shooter = opponent(defender);
  return state.shots.some(
    (shot) => shot.shooter === shooter && shot.outcome === 'sunk' && shot.sunkShipId === placement.shipId,
  );
}

function eligibleRepairShot(state: NavalBattleState, player: Player, row: number, col: number) {
  const attacker = opponent(player);
  const shot = activeShotAt(state, attacker, row, col);
  if (!shot || shot.outcome !== 'hit') return undefined;
  const placement = shipAt(state.fleets[player], row, col);
  if (!placement || isShipSunk(state, player, placement)) return undefined;
  return shot;
}

function canRepositionShip(state: NavalBattleState, player: Player, shipId: NavalShipId) {
  const placement = state.fleets[player].find((ship) => ship.shipId === shipId);
  if (!placement || isShipSunk(state, player, placement)) return false;
  const cells = new Set(navalPlacementCells(placement).map(navalCellKey));
  const attacker = opponent(player);
  return !state.shots.some(
    (shot) =>
      shot.shooter === attacker &&
      (shot.outcome === 'hit' || shot.outcome === 'sunk') &&
      cells.has(navalCellKey(shot)),
  );
}

function validReposition(
  state: NavalBattleState,
  player: Player,
  placement: NavalPlacement,
): boolean {
  if (!canRepositionShip(state, player, placement.shipId)) return false;
  const current = state.fleets[player].find((ship) => ship.shipId === placement.shipId);
  if (
    current &&
    current.row === placement.row &&
    current.col === placement.col &&
    current.orientation === placement.orientation
  )
    return false;
  if (!isNavalPlacementValid(state.fleets[player], placement)) return false;
  const previouslyTargeted = new Set(
    state.shots.filter((shot) => shot.shooter === opponent(player)).map(navalCellKey),
  );
  return navalPlacementCells(placement).every((cell) => !previouslyTargeted.has(navalCellKey(cell)));
}

function assertAbility(state: NavalBattleState, player: Player, abilityId: NavalAbilityId) {
  if (!navalAbilityAvailable(state, player, abilityId)) throw new RuleError('naval-ability-unavailable');
}

export function validateNavalMove(state: NavalBattleState, input: NavalBattleMove): Validation {
  try {
    const move = parseNavalMove(input);
    if (isGameOver(state)) throw new RuleError('game-over');
    if (!authoritative(state)) throw new RuleError('projected-state-read-only');
    const player = state.turn;

    if (state.phase === 'loadout') {
      if (move.type !== 'selectAbilities') throw new RuleError('naval-loadout-phase');
      if (state.loadoutLocked[player]) throw new RuleError('naval-loadout-locked');
      const unique = uniqueNavalAbilities(move.abilities);
      if (move.abilities.length !== NAVAL_LOADOUT_SIZE || unique.length !== NAVAL_LOADOUT_SIZE)
        throw new RuleError('naval-loadout-size');
      if (!unique.every(isNavalAbilityId)) throw new RuleError('invalid-loadout');
      return { ok: true };
    }

    if (state.phase === 'placement') {
      if (move.type !== 'place' && move.type !== 'ready') throw new RuleError('naval-placement-phase');
      if (state.ready[player]) throw new RuleError('naval-fleet-locked');
      if (move.type === 'ready') {
        if (!isCompleteNavalFleet(state.fleets[player])) throw new RuleError('naval-fleet-incomplete');
        return { ok: true };
      }
      const placement: NavalPlacement = { shipId: move.shipId, row: move.row, col: move.col, orientation: move.orientation };
      if (!navalPlacementInBounds(placement)) throw new RuleError('naval-out-of-bounds');
      if (!isNavalPlacementValid(state.fleets[player], placement)) throw new RuleError('naval-overlap');
      return { ok: true };
    }

    if (!state.ready[0] || !state.ready[1]) throw new RuleError('naval-not-ready');

    if (state.hunterWindow) {
      if (state.hunterWindow.player !== player) throw new RuleError('naval-hunter-window');
      if (move.type === 'declineHunter') return { ok: true };
      if (move.type !== 'hunterFire') throw new RuleError('naval-hunter-response-required');
      assertAbility(state, player, 'hunterProtocol');
      const distance =
        Math.abs(move.row - state.hunterWindow.origin.row) + Math.abs(move.col - state.hunterWindow.origin.col);
      if (distance !== 1) throw new RuleError('naval-hunter-adjacent');
      if (hasActiveShot(state, player, move.row, move.col)) throw new RuleError('naval-duplicate-shot');
      return { ok: true };
    }

    if (move.type === 'fire') {
      if (hasActiveShot(state, player, move.row, move.col)) throw new RuleError('naval-duplicate-shot');
      return { ok: true };
    }
    if (move.type === 'sonarPulse') {
      assertAbility(state, player, 'sonarPulse');
      return { ok: true };
    }
    if (move.type === 'twinSalvo') {
      assertAbility(state, player, 'twinSalvo');
      const [first, second] = move.targets;
      if (navalCellKey(first) === navalCellKey(second)) throw new RuleError('naval-twin-distinct');
      if (
        hasActiveShot(state, player, first.row, first.col) ||
        hasActiveShot(state, player, second.row, second.col)
      )
        throw new RuleError('naval-duplicate-shot');
      return { ok: true };
    }
    if (move.type === 'emergencyRepair') {
      assertAbility(state, player, 'emergencyRepair');
      if (!eligibleRepairShot(state, player, move.row, move.col)) throw new RuleError('naval-repair-invalid');
      return { ok: true };
    }
    if (move.type === 'signalJammer') {
      assertAbility(state, player, 'signalJammer');
      return { ok: true };
    }
    if (move.type === 'silentReposition') {
      assertAbility(state, player, 'silentReposition');
      const placement: NavalPlacement = {
        shipId: move.shipId,
        row: move.row,
        col: move.col,
        orientation: move.orientation,
      };
      if (!validReposition(state, player, placement)) throw new RuleError('naval-reposition-invalid');
      return { ok: true };
    }
    throw new RuleError('naval-battle-phase');
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
    loadouts: [[...state.loadouts[0]], [...state.loadouts[1]]],
    loadoutLocked: [...state.loadoutLocked] as [boolean, boolean],
    usedAbilities: [[...state.usedAbilities[0]], [...state.usedAbilities[1]]],
    privateIntel: [
      state.privateIntel[0].map((intel) => ({ ...intel, center: { ...intel.center } })),
      state.privateIntel[1].map((intel) => ({ ...intel, center: { ...intel.center } })),
    ],
    jammers: [
      state.jammers[0] ? { ...state.jammers[0], center: state.jammers[0]!.center ? { ...state.jammers[0]!.center! } : undefined } : null,
      state.jammers[1] ? { ...state.jammers[1], center: state.jammers[1]!.center ? { ...state.jammers[1]!.center! } : undefined } : null,
    ],
    hunterWindow: state.hunterWindow ? { ...state.hunterWindow, origin: { ...state.hunterWindow.origin } } : null,
    shots: state.shots.map((shot) => ({
      ...shot,
      sunkCells: shot.sunkCells?.map((cell) => ({ ...cell })),
    })),
    remainingShips: [...state.remainingShips] as [number, number],
    lastAction: state.lastAction ? ({ ...state.lastAction } as NavalPublicAction) : null,
  };
}

function markAbilityUsed(state: NavalBattleState, player: Player, abilityId: NavalAbilityId) {
  if (!state.usedAbilities[player].includes(abilityId)) state.usedAbilities[player].push(abilityId);
  state.lastAction = { type: 'ability', player, abilityId };
}

function finishTurn(state: NavalBattleState, player: Player) {
  const defender = opponent(player);
  const jammer = state.jammers[defender];
  if (jammer) {
    jammer.opponentTurnsRemaining -= 1;
    if (jammer.opponentTurnsRemaining <= 0) state.jammers[defender] = null;
  }
  state.turn = defender;
  state.hunterWindow = null;
}

function resolveShot(state: NavalBattleState, shooter: Player, coordinate: NavalCoordinate): NavalShot {
  const defender = opponent(shooter);
  const placement = shipAt(state.fleets[defender], coordinate.row, coordinate.col);
  let shot: NavalShot;
  if (!placement) {
    shot = { shooter, ...coordinate, outcome: 'miss' };
  } else {
    const hitKeys = previousActiveHitsOnShip(state, shooter, placement);
    hitKeys.add(navalCellKey(coordinate));
    const cells = navalPlacementCells(placement);
    const sunk = cells.every((cell) => hitKeys.has(navalCellKey(cell)));
    if (sunk) {
      shot = {
        shooter,
        ...coordinate,
        outcome: 'sunk',
        sunkShipId: placement.shipId,
        sunkCells: cells.map((cell) => ({ ...cell })),
      };
      state.remainingShips[defender] = Math.max(0, state.remainingShips[defender] - 1);
    } else {
      shot = { shooter, ...coordinate, outcome: 'hit' };
    }
  }
  state.shots.push(shot);
  if (state.remainingShips[defender] === 0) {
    state.winner = shooter;
    state.resultReason = 'naval-fleet-destroyed';
  }
  return shot;
}

export function applyNavalMove(state: NavalBattleState, input: NavalBattleMove): NavalBattleState {
  const move = parseNavalMove(input);
  assertValid(state, move);
  const next = cloneState(state);
  const player = state.turn;
  next.ply = state.ply + 1;
  next.resultReason = undefined;

  if (move.type === 'selectAbilities') {
    next.loadouts[player] = uniqueNavalAbilities(move.abilities);
    next.loadoutLocked[player] = true;
    next.lastAction = { type: 'loadoutReady', player };
    if (next.loadoutLocked[0] && next.loadoutLocked[1]) {
      next.phase = 'placement';
      next.turn = next.starter;
    } else {
      next.turn = opponent(player);
    }
    return next;
  }

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

  if (move.type === 'declineHunter') {
    finishTurn(next, player);
    return next;
  }

  if (move.type === 'hunterFire') {
    markAbilityUsed(next, player, 'hunterProtocol');
    const shot = resolveShot(next, player, move);
    if (next.winner === null) finishTurn(next, player);
    next.lastAction = { type: 'ability', player, abilityId: 'hunterProtocol' };
    if (shot.outcome === 'sunk') next.resultReason ??= undefined;
    return next;
  }

  if (move.type === 'fire') {
    const shot = resolveShot(next, player, move);
    next.lastAction = {
      type: 'fire',
      player,
      row: move.row,
      col: move.col,
      outcome: shot.outcome,
      sunkShipId: shot.sunkShipId,
    };
    if (next.winner !== null) return next;
    if (shot.outcome === 'hit' && navalAbilityAvailable(next, player, 'hunterProtocol')) {
      next.hunterWindow = { player, origin: { row: move.row, col: move.col } };
      return next;
    }
    finishTurn(next, player);
    return next;
  }

  if (move.type === 'sonarPulse') {
    const defender = opponent(player);
    const jammer = next.jammers[defender];
    const jammed = !!jammer?.center && regionsOverlap(move, jammer.center);
    const sunkShips = new Set(
      next.shots
        .filter((shot) => shot.shooter === player && shot.outcome === 'sunk')
        .map((shot) => shot.sunkShipId)
        .filter((ship): ship is NavalShipId => !!ship),
    );
    const scanKeys = new Set(region(move).map(navalCellKey));
    const count = jammed
      ? null
      : next.fleets[defender]
          .filter((placement) => !sunkShips.has(placement.shipId))
          .flatMap(navalPlacementCells)
          .filter((cell) => scanKeys.has(navalCellKey(cell))).length;
    const intel: NavalPrivateIntel = {
      type: 'sonar',
      center: { row: move.row, col: move.col },
      count,
      jammed,
      atPly: next.ply,
    };
    next.privateIntel[player].push(intel);
    markAbilityUsed(next, player, 'sonarPulse');
    finishTurn(next, player);
    next.lastAction = { type: 'ability', player, abilityId: 'sonarPulse' };
    return next;
  }

  if (move.type === 'twinSalvo') {
    markAbilityUsed(next, player, 'twinSalvo');
    for (const target of move.targets) {
      resolveShot(next, player, target);
      if (next.winner !== null) break;
    }
    if (next.winner === null) finishTurn(next, player);
    next.lastAction = { type: 'ability', player, abilityId: 'twinSalvo' };
    return next;
  }

  if (move.type === 'emergencyRepair') {
    const shot = eligibleRepairShot(next, player, move.row, move.col);
    if (!shot) throw new RuleError('naval-repair-invalid');
    shot.repaired = true;
    markAbilityUsed(next, player, 'emergencyRepair');
    finishTurn(next, player);
    next.lastAction = { type: 'ability', player, abilityId: 'emergencyRepair' };
    return next;
  }

  if (move.type === 'signalJammer') {
    next.jammers[player] = {
      center: { row: move.row, col: move.col },
      opponentTurnsRemaining: 2,
    };
    markAbilityUsed(next, player, 'signalJammer');
    finishTurn(next, player);
    next.lastAction = { type: 'ability', player, abilityId: 'signalJammer' };
    return next;
  }

  if (move.type === 'silentReposition') {
    const placement: NavalPlacement = {
      shipId: move.shipId,
      row: move.row,
      col: move.col,
      orientation: move.orientation,
    };
    next.fleets[player] = [
      ...next.fleets[player].filter((ship) => ship.shipId !== move.shipId),
      placement,
    ];
    markAbilityUsed(next, player, 'silentReposition');
    finishTurn(next, player);
    next.lastAction = { type: 'ability', player, abilityId: 'silentReposition' };
    return next;
  }

  return next;
}

function combinations<T>(values: readonly T[], count: number): T[][] {
  if (count === 0) return [[]];
  const result: T[][] = [];
  for (let index = 0; index <= values.length - count; index++)
    for (const tail of combinations(values.slice(index + 1), count - 1))
      result.push([values[index], ...tail]);
  return result;
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

function untargetedCells(state: NavalBattleState, player: Player) {
  const cells: NavalCoordinate[] = [];
  for (let row = 0; row < NAVAL_BOARD_SIZE; row++)
    for (let col = 0; col < NAVAL_BOARD_SIZE; col++)
      if (!hasActiveShot(state, player, row, col)) cells.push({ row, col });
  return cells;
}

export function legalNavalMoves(state: NavalBattleState): NavalBattleMove[] {
  if (isGameOver(state)) return [];
  if (state.viewerSeat !== undefined && state.viewerSeat !== null && state.viewerSeat !== state.turn) return [];
  if (state.viewerSeat === null) return [];
  const player = state.turn;

  if (state.phase === 'loadout') {
    if (state.loadoutLocked[player]) return [];
    return combinations(NAVAL_ABILITIES.map((ability) => ability.id), NAVAL_LOADOUT_SIZE).map(
      (abilities) => ({ type: 'selectAbilities', abilities }),
    );
  }
  if (state.phase === 'placement') {
    if (state.ready[player]) return [];
    return placementMovesForFirstMissing(state, player);
  }
  if (state.hunterWindow) {
    const moves: NavalBattleMove[] = [{ type: 'declineHunter' }];
    for (const { row, col } of [
      { row: state.hunterWindow.origin.row - 1, col: state.hunterWindow.origin.col },
      { row: state.hunterWindow.origin.row + 1, col: state.hunterWindow.origin.col },
      { row: state.hunterWindow.origin.row, col: state.hunterWindow.origin.col - 1 },
      { row: state.hunterWindow.origin.row, col: state.hunterWindow.origin.col + 1 },
    ])
      if (
        row >= 0 &&
        row < NAVAL_BOARD_SIZE &&
        col >= 0 &&
        col < NAVAL_BOARD_SIZE &&
        !hasActiveShot(state, player, row, col)
      )
        moves.push({ type: 'hunterFire', row, col });
    return moves;
  }

  const cells = untargetedCells(state, player);
  const moves: NavalBattleMove[] = cells.map(({ row, col }) => ({ type: 'fire', row, col }));

  if (navalAbilityAvailable(state, player, 'sonarPulse'))
    for (let row = 0; row < NAVAL_BOARD_SIZE; row++)
      for (let col = 0; col < NAVAL_BOARD_SIZE; col++) moves.push({ type: 'sonarPulse', row, col });

  if (navalAbilityAvailable(state, player, 'twinSalvo'))
    for (let first = 0; first < cells.length; first++)
      for (let second = first + 1; second < cells.length; second++)
        moves.push({ type: 'twinSalvo', targets: [cells[first], cells[second]] });

  if (navalAbilityAvailable(state, player, 'emergencyRepair'))
    for (let row = 0; row < NAVAL_BOARD_SIZE; row++)
      for (let col = 0; col < NAVAL_BOARD_SIZE; col++)
        if (eligibleRepairShot(state, player, row, col)) moves.push({ type: 'emergencyRepair', row, col });

  if (navalAbilityAvailable(state, player, 'signalJammer'))
    for (let row = 0; row < NAVAL_BOARD_SIZE; row++)
      for (let col = 0; col < NAVAL_BOARD_SIZE; col++) moves.push({ type: 'signalJammer', row, col });

  if (navalAbilityAvailable(state, player, 'silentReposition'))
    for (const ship of state.fleets[player])
      for (const orientation of ['horizontal', 'vertical'] as const)
        for (let row = 0; row < NAVAL_BOARD_SIZE; row++)
          for (let col = 0; col < NAVAL_BOARD_SIZE; col++) {
            const placement: NavalPlacement = { shipId: ship.shipId, row, col, orientation };
            if (validReposition(state, player, placement)) moves.push({ type: 'silentReposition', ...placement });
          }

  return moves;
}

export function evaluateNavalBattle(state: NavalBattleState, player: Player): number {
  if (state.winner !== null) return state.winner === player ? 100000 : -100000;
  const rival = opponent(player);
  if (state.phase === 'loadout') return state.loadoutLocked[player] ? 10 : 0;
  if (state.phase === 'placement')
    return (state.fleets[player].length - state.fleets[rival].length) * 5 + (state.ready[player] ? 20 : 0);
  const ownHits = state.shots.filter(
    (shot) => shot.shooter === player && !shot.repaired && (shot.outcome === 'hit' || shot.outcome === 'sunk'),
  ).length;
  const rivalHits = state.shots.filter(
    (shot) => shot.shooter === rival && !shot.repaired && (shot.outcome === 'hit' || shot.outcome === 'sunk'),
  ).length;
  return (
    (state.remainingShips[player] - state.remainingShips[rival]) * 120 +
    (ownHits - rivalHits) * 10 +
    (state.usedAbilities[rival].length - state.usedAbilities[player].length) * 3
  );
}

export function projectNavalState(state: NavalBattleState, viewer: Player | null): NavalBattleState {
  const fleets: [NavalPlacement[], NavalPlacement[]] = [[], []];
  if (viewer !== null) fleets[viewer] = state.fleets[viewer].map((placement) => ({ ...placement }));

  const loadouts: [NavalAbilityId[], NavalAbilityId[]] = [
    [...state.usedAbilities[0]],
    [...state.usedAbilities[1]],
  ];
  if (viewer !== null) loadouts[viewer] = [...state.loadouts[viewer]];

  const privateIntel: [NavalPrivateIntel[], NavalPrivateIntel[]] = [[], []];
  if (viewer !== null)
    privateIntel[viewer] = state.privateIntel[viewer].map((intel) => ({
      ...intel,
      center: { ...intel.center },
    }));

  const jammers = state.jammers.map((jammer, seat) => {
    if (!jammer) return null;
    return {
      ...(viewer === seat && jammer.center ? { center: { ...jammer.center } } : {}),
      opponentTurnsRemaining: jammer.opponentTurnsRemaining,
    };
  }) as NavalBattleState['jammers'];

  return {
    gameId: 'navalBattle',
    playerCount: 2,
    phase: state.phase,
    fleets,
    ready: [...state.ready] as [boolean, boolean],
    loadouts,
    loadoutLocked: [...state.loadoutLocked] as [boolean, boolean],
    usedAbilities: [[...state.usedAbilities[0]], [...state.usedAbilities[1]]],
    privateIntel,
    jammers,
    hunterWindow:
      viewer !== null && state.hunterWindow?.player === viewer
        ? { ...state.hunterWindow, origin: { ...state.hunterWindow.origin } }
        : null,
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
