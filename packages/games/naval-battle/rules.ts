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
  NAVAL_BOARD_SIZE,
  NAVAL_SHIPS,
  createNavalBattle,
  navalShip,
  type NavalAbilityId,
  type NavalBattleMove,
  type NavalBattleState,
  type NavalCoordinate,
  type NavalJammer,
  type NavalPlacement,
  type NavalPublicAction,
  type NavalShipId,
  type NavalShot,
} from './state.ts';

const shipIds = new Set<NavalShipId>(NAVAL_SHIPS.map((ship) => ship.id));
const abilityIds = new Set<NavalAbilityId>(NAVAL_ABILITIES);

const ownKeys = (value: Record<string, unknown>, keys: string[]) => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const integerCoordinate = (value: unknown) =>
  Number.isInteger(value) && Number(value) >= 0 && Number(value) < NAVAL_BOARD_SIZE;

const abilityCenter = (value: unknown) =>
  Number.isInteger(value) && Number(value) >= 1 && Number(value) <= NAVAL_BOARD_SIZE - 2;

const parseTarget = (value: unknown): NavalCoordinate => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new RuleError('invalid-coordinate');
  const target = value as Record<string, unknown>;
  if (!ownKeys(target, ['row', 'col']) || !integerCoordinate(target.row) || !integerCoordinate(target.col))
    throw new RuleError('invalid-coordinate');
  return { row: Number(target.row), col: Number(target.col) };
};

export function parseNavalMove(input: unknown): NavalBattleMove {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RuleError('invalid-move');
  const move = input as Record<string, unknown>;

  if (move.type === 'selectAbilities') {
    if (!ownKeys(move, ['type', 'abilities']) || !Array.isArray(move.abilities) || move.abilities.length !== 3)
      throw new RuleError('naval-invalid-loadout');
    const abilities = move.abilities;
    if (
      abilities.some((ability) => typeof ability !== 'string' || !abilityIds.has(ability as NavalAbilityId)) ||
      new Set(abilities).size !== 3
    )
      throw new RuleError('naval-invalid-loadout');
    return {
      type: 'selectAbilities',
      abilities: abilities as [NavalAbilityId, NavalAbilityId, NavalAbilityId],
    };
  }

  if (move.type === 'ready') {
    if (!ownKeys(move, ['type'])) throw new RuleError('invalid-move');
    return { type: 'ready' };
  }

  if (move.type === 'skipHunter') {
    if (!ownKeys(move, ['type'])) throw new RuleError('invalid-move');
    return { type: 'skipHunter' };
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

  if (move.type === 'useAbility') {
    if (typeof move.ability !== 'string' || !abilityIds.has(move.ability as NavalAbilityId))
      throw new RuleError('naval-invalid-ability');

    if (move.ability === 'twinSalvo') {
      if (!ownKeys(move, ['type', 'ability', 'targets']) || !Array.isArray(move.targets) || move.targets.length !== 2)
        throw new RuleError('naval-invalid-ability-target');
      const first = parseTarget(move.targets[0]);
      const second = parseTarget(move.targets[1]);
      return { type: 'useAbility', ability: 'twinSalvo', targets: [first, second] };
    }

    if (move.ability === 'silentReposition') {
      if (
        !ownKeys(move, ['type', 'ability', 'shipId', 'row', 'col', 'orientation']) ||
        typeof move.shipId !== 'string' ||
        !shipIds.has(move.shipId as NavalShipId) ||
        !integerCoordinate(move.row) ||
        !integerCoordinate(move.col) ||
        (move.orientation !== 'horizontal' && move.orientation !== 'vertical')
      )
        throw new RuleError('naval-invalid-ability-target');
      return {
        type: 'useAbility',
        ability: 'silentReposition',
        shipId: move.shipId as NavalShipId,
        row: Number(move.row),
        col: Number(move.col),
        orientation: move.orientation,
      };
    }

    if (
      !ownKeys(move, ['type', 'ability', 'row', 'col']) ||
      !integerCoordinate(move.row) ||
      !integerCoordinate(move.col)
    )
      throw new RuleError('naval-invalid-ability-target');

    return {
      type: 'useAbility',
      ability: move.ability as 'sonarPulse' | 'hunterProtocol' | 'emergencyRepair' | 'signalJammer',
      row: Number(move.row),
      col: Number(move.col),
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
  return state.shots.some(
    (shot) => shot.shooter === shooter && shot.row === row && shot.col === col && !shot.repaired,
  );
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

function activeHitsOnShip(
  state: NavalBattleState,
  owner: Player,
  placement: NavalPlacement,
): NavalShot[] {
  const attacker = opponent(owner);
  const cells = new Set(navalPlacementCells(placement).map(navalCellKey));
  return state.shots.filter(
    (shot) =>
      shot.shooter === attacker &&
      !shot.repaired &&
      (shot.outcome === 'hit' || shot.outcome === 'sunk') &&
      cells.has(navalCellKey(shot)),
  );
}

function shipIsSunk(state: NavalBattleState, owner: Player, placement: NavalPlacement) {
  const hitKeys = new Set(activeHitsOnShip(state, owner, placement).map(navalCellKey));
  return navalPlacementCells(placement).every((cell) => hitKeys.has(navalCellKey(cell)));
}

function abilitySelected(state: NavalBattleState, player: Player, ability: NavalAbilityId) {
  return state.loadouts[player].includes(ability);
}

function abilityUnused(state: NavalBattleState, player: Player, ability: NavalAbilityId) {
  return !state.usedAbilities[player].includes(ability);
}

function validateAbilityAvailable(state: NavalBattleState, player: Player, ability: NavalAbilityId) {
  if (!abilitySelected(state, player, ability)) throw new RuleError('naval-ability-not-selected');
  if (!abilityUnused(state, player, ability)) throw new RuleError('naval-ability-used');
}

function regionCells(row: number, col: number): NavalCoordinate[] {
  const cells: NavalCoordinate[] = [];
  for (let r = row - 1; r <= row + 1; r++)
    for (let c = col - 1; c <= col + 1; c++) cells.push({ row: r, col: c });
  return cells;
}

function regionsOverlap(a: NavalCoordinate, b: NavalCoordinate) {
  return Math.abs(a.row - b.row) <= 2 && Math.abs(a.col - b.col) <= 2;
}

function sonarBlocked(state: NavalBattleState, defender: Player, row: number, col: number) {
  return state.jammers.some(
    (jammer) =>
      jammer.owner === defender &&
      jammer.remainingOpponentTurns > 0 &&
      regionsOverlap({ row, col }, jammer),
  );
}

function sonarCount(state: NavalBattleState, defender: Player, row: number, col: number) {
  const area = new Set(regionCells(row, col).map(navalCellKey));
  let count = 0;
  for (const placement of state.fleets[defender]) {
    if (shipIsSunk(state, defender, placement)) continue;
    count += navalPlacementCells(placement).filter((cell) => area.has(navalCellKey(cell))).length;
  }
  return count;
}

function canRepairCell(state: NavalBattleState, player: Player, row: number, col: number) {
  const placement = shipAt(state.fleets[player], row, col);
  if (!placement || shipIsSunk(state, player, placement)) return false;
  return activeHitsOnShip(state, player, placement).some(
    (shot) => shot.row === row && shot.col === col,
  );
}

function unhitShip(state: NavalBattleState, player: Player, shipId: NavalShipId) {
  const placement = state.fleets[player].find((ship) => ship.shipId === shipId);
  return !!placement && activeHitsOnShip(state, player, placement).length === 0;
}

function repositionValid(
  state: NavalBattleState,
  player: Player,
  placement: NavalPlacement,
) {
  if (!unhitShip(state, player, placement.shipId)) return false;
  if (!isNavalPlacementValid(state.fleets[player], placement)) return false;
  const previouslyTargeted = new Set(
    state.shots.filter((shot) => shot.shooter === opponent(player)).map(navalCellKey),
  );
  return navalPlacementCells(placement).every((cell) => !previouslyTargeted.has(navalCellKey(cell)));
}

function orthogonallyAdjacent(a: NavalCoordinate, b: NavalCoordinate) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

export function validateNavalMove(state: NavalBattleState, input: NavalBattleMove): Validation {
  try {
    const move = parseNavalMove(input);
    if (isGameOver(state)) throw new RuleError('game-over');
    if (!authoritative(state)) throw new RuleError('projected-state-read-only');

    const player = state.turn;

    if (state.phase === 'loadout') {
      if (move.type !== 'selectAbilities') throw new RuleError('naval-loadout-phase');
      if (state.loadouts[player].length) throw new RuleError('naval-loadout-locked');
      return { ok: true };
    }

    if (state.phase === 'placement') {
      if (move.type === 'fire' || move.type === 'useAbility' || move.type === 'skipHunter' || move.type === 'selectAbilities')
        throw new RuleError('naval-placement-phase');
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

    if (!state.ready[0] || !state.ready[1]) throw new RuleError('naval-not-ready');

    if (state.hunterWindow) {
      if (state.hunterWindow.player !== player) throw new RuleError('naval-hunter-window');
      if (move.type === 'skipHunter') return { ok: true };
      if (move.type !== 'useAbility' || move.ability !== 'hunterProtocol')
        throw new RuleError('naval-hunter-window');
      validateAbilityAvailable(state, player, 'hunterProtocol');
      if (!orthogonallyAdjacent(state.hunterWindow.origin, move))
        throw new RuleError('naval-hunter-adjacent');
      if (hasShot(state, player, move.row, move.col)) throw new RuleError('naval-duplicate-shot');
      return { ok: true };
    }

    if (move.type === 'fire') {
      if (hasShot(state, player, move.row, move.col)) throw new RuleError('naval-duplicate-shot');
      return { ok: true };
    }

    if (move.type !== 'useAbility') throw new RuleError('naval-battle-phase');
    validateAbilityAvailable(state, player, move.ability);

    if (move.ability === 'hunterProtocol') throw new RuleError('naval-hunter-no-hit');

    if (move.ability === 'sonarPulse' || move.ability === 'signalJammer') {
      if (!abilityCenter(move.row) || !abilityCenter(move.col))
        throw new RuleError('naval-ability-edge');
      return { ok: true };
    }

    if (move.ability === 'twinSalvo') {
      const [first, second] = move.targets;
      if (navalCellKey(first) === navalCellKey(second))
        throw new RuleError('naval-twin-same-target');
      if (
        hasShot(state, player, first.row, first.col) ||
        hasShot(state, player, second.row, second.col)
      )
        throw new RuleError('naval-duplicate-shot');
      return { ok: true };
    }

    if (move.ability === 'emergencyRepair') {
      if (!canRepairCell(state, player, move.row, move.col))
        throw new RuleError('naval-repair-invalid');
      return { ok: true };
    }

    if (move.ability === 'silentReposition') {
      const placement: NavalPlacement = {
        shipId: move.shipId,
        row: move.row,
        col: move.col,
        orientation: move.orientation,
      };
      if (!repositionValid(state, player, placement))
        throw new RuleError('naval-reposition-invalid');
      return { ok: true };
    }

    throw new RuleError('naval-invalid-ability');
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
    loadouts: [
      [...state.loadouts[0]],
      [...state.loadouts[1]],
    ] as [NavalAbilityId[], NavalAbilityId[]],
    usedAbilities: [
      [...state.usedAbilities[0]],
      [...state.usedAbilities[1]],
    ] as [NavalAbilityId[], NavalAbilityId[]],
    fleets: [
      state.fleets[0].map((placement) => ({ ...placement })),
      state.fleets[1].map((placement) => ({ ...placement })),
    ],
    ready: [...state.ready] as [boolean, boolean],
    shots: state.shots.map((shot) => ({
      ...shot,
      sunkCells: shot.sunkCells?.map((cell) => ({ ...cell })),
    })),
    sonarScans: state.sonarScans.map((scan) => ({ ...scan })),
    jammers: state.jammers.map((jammer) => ({ ...jammer })),
    hunterWindow: state.hunterWindow
      ? { player: state.hunterWindow.player, origin: { ...state.hunterWindow.origin } }
      : null,
    remainingShips: [...state.remainingShips] as [number, number],
    lastAction: state.lastAction ? ({ ...state.lastAction } as NavalPublicAction) : null,
  };
}

function markAbilityUsed(state: NavalBattleState, player: Player, ability: NavalAbilityId) {
  state.usedAbilities[player] = [...state.usedAbilities[player], ability];
}

function endTurn(state: NavalBattleState, player: Player) {
  state.hunterWindow = null;
  state.jammers = state.jammers
    .map((jammer) =>
      jammer.owner === player
        ? jammer
        : { ...jammer, remainingOpponentTurns: jammer.remainingOpponentTurns - 1 },
    )
    .filter((jammer) => jammer.remainingOpponentTurns > 0);
  state.turn = opponent(player);
}

function resolveShot(
  state: NavalBattleState,
  player: Player,
  target: NavalCoordinate,
): NavalShot {
  const defender = opponent(player);
  const placement = shipAt(state.fleets[defender], target.row, target.col);
  let shot: NavalShot;

  if (!placement) {
    shot = { shooter: player, ...target, outcome: 'miss' };
  } else {
    const previous = new Set(activeHitsOnShip(state, defender, placement).map(navalCellKey));
    previous.add(navalCellKey(target));
    const cells = navalPlacementCells(placement);
    const sunk = cells.every((cell) => previous.has(navalCellKey(cell)));
    if (sunk) {
      shot = {
        shooter: player,
        ...target,
        outcome: 'sunk',
        sunkShipId: placement.shipId,
        sunkCells: cells.map((cell) => ({ ...cell })),
      };
      state.remainingShips[defender] = Math.max(0, state.remainingShips[defender] - 1);
    } else {
      shot = { shooter: player, ...target, outcome: 'hit' };
    }
  }

  state.shots.push(shot);
  if (state.remainingShips[defender] === 0) {
    state.winner = player;
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
    next.loadouts[player] = [...move.abilities];
    next.lastAction = { type: 'selectAbilities', player };
    if (next.loadouts[0].length === 3 && next.loadouts[1].length === 3) {
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

  if (move.type === 'skipHunter') {
    endTurn(next, player);
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

    if (
      shot.outcome === 'hit' &&
      abilitySelected(next, player, 'hunterProtocol') &&
      abilityUnused(next, player, 'hunterProtocol')
    ) {
      next.hunterWindow = { player, origin: { row: move.row, col: move.col } };
      return next;
    }

    endTurn(next, player);
    return next;
  }

  markAbilityUsed(next, player, move.ability);

  if (move.ability === 'hunterProtocol') {
    const shot = resolveShot(next, player, move);
    next.lastAction = {
      type: 'ability',
      player,
      ability: 'hunterProtocol',
      outcomes: [shot.outcome],
    };
    if (next.winner === null) endTurn(next, player);
    return next;
  }

  if (move.ability === 'sonarPulse') {
    const defender = opponent(player);
    const blocked = sonarBlocked(next, defender, move.row, move.col);
    next.sonarScans.push({
      player,
      row: move.row,
      col: move.col,
      count: blocked ? 0 : sonarCount(next, defender, move.row, move.col),
      blocked,
    });
    next.lastAction = { type: 'ability', player, ability: 'sonarPulse', blocked };
    endTurn(next, player);
    return next;
  }

  if (move.ability === 'twinSalvo') {
    const outcomes: NavalShot['outcome'][] = [];
    for (const target of move.targets) {
      if (next.winner !== null) break;
      outcomes.push(resolveShot(next, player, target).outcome);
    }
    next.lastAction = { type: 'ability', player, ability: 'twinSalvo', outcomes };
    if (next.winner === null) endTurn(next, player);
    return next;
  }

  if (move.ability === 'emergencyRepair') {
    const shot = [...next.shots]
      .reverse()
      .find(
        (candidate) =>
          candidate.shooter === opponent(player) &&
          candidate.row === move.row &&
          candidate.col === move.col &&
          !candidate.repaired &&
          (candidate.outcome === 'hit' || candidate.outcome === 'sunk'),
      );
    if (!shot) throw new RuleError('naval-repair-invalid');
    shot.repaired = true;
    next.lastAction = { type: 'ability', player, ability: 'emergencyRepair' };
    endTurn(next, player);
    return next;
  }

  if (move.ability === 'signalJammer') {
    next.jammers.push({
      owner: player,
      row: move.row,
      col: move.col,
      remainingOpponentTurns: 2,
    });
    next.lastAction = { type: 'ability', player, ability: 'signalJammer' };
    endTurn(next, player);
    return next;
  }

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
  next.lastAction = { type: 'ability', player, ability: 'silentReposition' };
  endTurn(next, player);
  return next;
}

function loadoutMoves(): NavalBattleMove[] {
  const result: NavalBattleMove[] = [];
  for (let a = 0; a < NAVAL_ABILITIES.length - 2; a++)
    for (let b = a + 1; b < NAVAL_ABILITIES.length - 1; b++)
      for (let c = b + 1; c < NAVAL_ABILITIES.length; c++)
        result.push({
          type: 'selectAbilities',
          abilities: [NAVAL_ABILITIES[a], NAVAL_ABILITIES[b], NAVAL_ABILITIES[c]],
        });
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

export function legalNavalMoves(state: NavalBattleState): NavalBattleMove[] {
  if (isGameOver(state)) return [];
  if (state.viewerSeat !== undefined && state.viewerSeat !== null && state.viewerSeat !== state.turn)
    return [];
  if (state.viewerSeat === null) return [];

  if (state.phase === 'loadout') return loadoutMoves();

  if (state.phase === 'placement') {
    if (state.ready[state.turn]) return [];
    return placementMovesForFirstMissing(state, state.turn);
  }

  const player = state.turn;
  const availableTargets: NavalCoordinate[] = [];
  for (let row = 0; row < NAVAL_BOARD_SIZE; row++)
    for (let col = 0; col < NAVAL_BOARD_SIZE; col++)
      if (!hasShot(state, player, row, col)) availableTargets.push({ row, col });

  if (state.hunterWindow) {
    const moves: NavalBattleMove[] = [{ type: 'skipHunter' }];
    if (
      abilitySelected(state, player, 'hunterProtocol') &&
      abilityUnused(state, player, 'hunterProtocol')
    )
      for (const target of availableTargets)
        if (orthogonallyAdjacent(state.hunterWindow.origin, target))
          moves.push({ type: 'useAbility', ability: 'hunterProtocol', ...target });
    return moves;
  }

  const moves: NavalBattleMove[] = availableTargets.map((target) => ({ type: 'fire', ...target }));
  const usable = (ability: NavalAbilityId) =>
    abilitySelected(state, player, ability) && abilityUnused(state, player, ability);

  if (usable('sonarPulse'))
    for (let row = 1; row < NAVAL_BOARD_SIZE - 1; row++)
      for (let col = 1; col < NAVAL_BOARD_SIZE - 1; col++)
        moves.push({ type: 'useAbility', ability: 'sonarPulse', row, col });

  if (usable('signalJammer'))
    for (let row = 1; row < NAVAL_BOARD_SIZE - 1; row++)
      for (let col = 1; col < NAVAL_BOARD_SIZE - 1; col++)
        moves.push({ type: 'useAbility', ability: 'signalJammer', row, col });

  if (usable('twinSalvo'))
    for (let first = 0; first < availableTargets.length - 1; first++)
      for (let second = first + 1; second < availableTargets.length; second++)
        moves.push({
          type: 'useAbility',
          ability: 'twinSalvo',
          targets: [availableTargets[first], availableTargets[second]],
        });

  if (usable('emergencyRepair'))
    for (const placement of state.fleets[player])
      if (!shipIsSunk(state, player, placement))
        for (const shot of activeHitsOnShip(state, player, placement))
          moves.push({ type: 'useAbility', ability: 'emergencyRepair', row: shot.row, col: shot.col });

  if (usable('silentReposition'))
    for (const placement of state.fleets[player])
      if (unhitShip(state, player, placement.shipId))
        for (const orientation of ['horizontal', 'vertical'] as const)
          for (let row = 0; row < NAVAL_BOARD_SIZE; row++)
            for (let col = 0; col < NAVAL_BOARD_SIZE; col++) {
              const candidate: NavalPlacement = { shipId: placement.shipId, row, col, orientation };
              if (repositionValid(state, player, candidate))
                moves.push({ type: 'useAbility', ability: 'silentReposition', ...candidate });
            }

  return moves;
}

export function evaluateNavalBattle(state: NavalBattleState, player: Player): number {
  if (state.winner !== null) return state.winner === player ? 100000 : -100000;
  const rival = opponent(player);
  if (state.phase === 'loadout') return state.loadouts[player].length * 10 - state.loadouts[rival].length * 10;
  if (state.phase === 'placement')
    return (state.fleets[player].length - state.fleets[rival].length) * 5 + (state.ready[player] ? 20 : 0);
  const ownHits = state.shots.filter(
    (shot) =>
      shot.shooter === player &&
      !shot.repaired &&
      (shot.outcome === 'hit' || shot.outcome === 'sunk'),
  ).length;
  const rivalHits = state.shots.filter(
    (shot) =>
      shot.shooter === rival &&
      !shot.repaired &&
      (shot.outcome === 'hit' || shot.outcome === 'sunk'),
  ).length;
  return (
    (state.remainingShips[player] - state.remainingShips[rival]) * 120 +
    (ownHits - rivalHits) * 10 +
    (3 - state.usedAbilities[player].length) * 8 -
    (3 - state.usedAbilities[rival].length) * 8
  );
}

/** Explicit allowlist projection. Enemy fleet/loadout/jammer/scan geometry is never copied. */
export function projectNavalState(
  state: NavalBattleState,
  viewer: Player | null,
): NavalBattleState {
  const fleets: [NavalPlacement[], NavalPlacement[]] = [[], []];
  const loadouts: [NavalAbilityId[], NavalAbilityId[]] = [
    [...state.usedAbilities[0]],
    [...state.usedAbilities[1]],
  ];
  if (viewer !== null) {
    fleets[viewer] = state.fleets[viewer].map((placement) => ({ ...placement }));
    loadouts[viewer] = [...state.loadouts[viewer]];
  }

  return {
    gameId: 'navalBattle',
    playerCount: 2,
    phase: state.phase,
    loadouts,
    usedAbilities: [
      [...state.usedAbilities[0]],
      [...state.usedAbilities[1]],
    ],
    fleets,
    ready: [...state.ready] as [boolean, boolean],
    shots: state.shots.map((shot) => ({
      ...shot,
      sunkCells: shot.sunkCells?.map((cell) => ({ ...cell })),
    })),
    sonarScans:
      viewer === null
        ? []
        : state.sonarScans.filter((scan) => scan.player === viewer).map((scan) => ({ ...scan })),
    jammers:
      viewer === null
        ? []
        : state.jammers.filter((jammer) => jammer.owner === viewer).map((jammer) => ({ ...jammer })),
    hunterWindow:
      viewer !== null && state.hunterWindow?.player === viewer
        ? { player: viewer, origin: { ...state.hunterWindow.origin } }
        : null,
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
