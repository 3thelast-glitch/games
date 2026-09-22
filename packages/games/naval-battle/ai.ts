import type { Difficulty, Player } from '../../core/src/game.ts';
import type { NavalAbilityId } from './abilities.ts';
import {
  NAVAL_BOARD_SIZE,
  NAVAL_SHIPS,
  type NavalBattleMove,
  type NavalBattleState,
  type NavalCoordinate,
  type NavalPlacement,
  type NavalShipId,
} from './state.ts';
import {
  isNavalPlacementValid,
  legalNavalMoves,
  navalAbilityAvailable,
  navalCellKey,
  navalPlacementCells,
} from './rules.ts';

export interface NavalAiOptions {
  random?: () => number;
}

const choose = <T>(values: readonly T[], random: () => number): T =>
  values[Math.min(values.length - 1, Math.floor(random() * values.length))];

function ownShots(state: NavalBattleState, player: Player) {
  return state.shots.filter((shot) => shot.shooter === player && !shot.repaired);
}

function unresolvedHits(state: NavalBattleState, player: Player): NavalCoordinate[] {
  const shots = ownShots(state, player);
  const sunk = new Set(shots.flatMap((shot) => shot.sunkCells ?? []).map(navalCellKey));
  return shots
    .filter((shot) => shot.outcome === 'hit' && !sunk.has(navalCellKey(shot)))
    .map(({ row, col }) => ({ row, col }));
}

function untargeted(state: NavalBattleState, player: Player): NavalCoordinate[] {
  const fired = new Set(ownShots(state, player).map(navalCellKey));
  const result: NavalCoordinate[] = [];
  for (let row = 0; row < NAVAL_BOARD_SIZE; row++)
    for (let col = 0; col < NAVAL_BOARD_SIZE; col++)
      if (!fired.has(navalCellKey({ row, col }))) result.push({ row, col });
  return result;
}

function neighbors(cell: NavalCoordinate): NavalCoordinate[] {
  return [
    { row: cell.row - 1, col: cell.col },
    { row: cell.row + 1, col: cell.col },
    { row: cell.row, col: cell.col - 1 },
    { row: cell.row, col: cell.col + 1 },
  ].filter(
    ({ row, col }) => row >= 0 && row < NAVAL_BOARD_SIZE && col >= 0 && col < NAVAL_BOARD_SIZE,
  );
}

function mediumTarget(state: NavalBattleState, player: Player, random: () => number): NavalCoordinate {
  const available = untargeted(state, player);
  const availableKeys = new Set(available.map(navalCellKey));
  const aroundHits = unresolvedHits(state, player)
    .flatMap(neighbors)
    .filter((cell) => availableKeys.has(navalCellKey(cell)));
  if (aroundHits.length) return choose(aroundHits, random);
  const checkerboard = available.filter(({ row, col }) => (row + col) % 2 === 0);
  return choose(checkerboard.length ? checkerboard : available, random);
}

function hardTarget(state: NavalBattleState, player: Player, random: () => number): NavalCoordinate {
  const available = untargeted(state, player);
  const availableKeys = new Set(available.map(navalCellKey));
  const misses = new Set(
    ownShots(state, player)
      .filter((shot) => shot.outcome === 'miss')
      .map(navalCellKey),
  );
  const sunkCells = new Set(
    ownShots(state, player)
      .flatMap((shot) => shot.sunkCells ?? [])
      .map(navalCellKey),
  );
  const unresolved = unresolvedHits(state, player);
  const unresolvedKeys = new Set(unresolved.map(navalCellKey));
  const sunkShips = new Set<NavalShipId>(
    ownShots(state, player)
      .map((shot) => shot.sunkShipId)
      .filter((ship): ship is NavalShipId => !!ship),
  );

  const score = new Map<string, number>();
  for (const cell of available) score.set(navalCellKey(cell), 0);

  for (const ship of NAVAL_SHIPS) {
    if (sunkShips.has(ship.id)) continue;
    for (const orientation of ['horizontal', 'vertical'] as const)
      for (let row = 0; row < NAVAL_BOARD_SIZE; row++)
        for (let col = 0; col < NAVAL_BOARD_SIZE; col++) {
          const placement: NavalPlacement = { shipId: ship.id, row, col, orientation };
          const cells = navalPlacementCells(placement);
          if (
            cells.some(
              (cell) =>
                cell.row < 0 ||
                cell.row >= NAVAL_BOARD_SIZE ||
                cell.col < 0 ||
                cell.col >= NAVAL_BOARD_SIZE ||
                misses.has(navalCellKey(cell)) ||
                sunkCells.has(navalCellKey(cell)),
            )
          )
            continue;

          const hitCount = cells.filter((cell) => unresolvedKeys.has(navalCellKey(cell))).length;
          if (unresolved.length && hitCount === 0) continue;
          const weight = 1 + hitCount * 8;
          for (const cell of cells) {
            const key = navalCellKey(cell);
            if (availableKeys.has(key)) score.set(key, (score.get(key) ?? 0) + weight);
          }
        }
  }

  let best = -1;
  let candidates: NavalCoordinate[] = [];
  for (const cell of available) {
    const value = score.get(navalCellKey(cell)) ?? 0;
    if (value > best) {
      best = value;
      candidates = [cell];
    } else if (value === best) candidates.push(cell);
  }
  return choose(candidates.length ? candidates : available, random);
}

function placementScore(state: NavalBattleState, player: Player, move: NavalBattleMove): number {
  if (move.type !== 'place' && move.type !== 'silentReposition') return 0;
  const fleet = state.fleets[player].filter((placement) => placement.shipId !== move.shipId);
  const candidate: NavalPlacement = {
    shipId: move.shipId,
    row: move.row,
    col: move.col,
    orientation: move.orientation,
  };
  if (!isNavalPlacementValid(fleet, candidate)) return -Infinity;
  const cells = navalPlacementCells(candidate);
  let minimum = 20;
  for (const other of fleet)
    for (const a of cells)
      for (const b of navalPlacementCells(other))
        minimum = Math.min(minimum, Math.abs(a.row - b.row) + Math.abs(a.col - b.col));
  const edgeDistance = Math.min(
    ...cells.map(({ row, col }) =>
      Math.min(row, col, NAVAL_BOARD_SIZE - 1 - row, NAVAL_BOARD_SIZE - 1 - col),
    ),
  );
  return minimum * 4 + edgeDistance;
}

function defaultLoadout(difficulty: Difficulty, random: () => number): NavalAbilityId[] {
  if (difficulty === 'hard') return ['sonarPulse', 'twinSalvo', 'emergencyRepair'];
  if (difficulty === 'medium') return ['sonarPulse', 'hunterProtocol', 'signalJammer'];
  const pools: NavalAbilityId[][] = [
    ['sonarPulse', 'twinSalvo', 'silentReposition'],
    ['hunterProtocol', 'emergencyRepair', 'signalJammer'],
    ['twinSalvo', 'hunterProtocol', 'sonarPulse'],
  ];
  return [...choose(pools, random)];
}

function legalOfType<T extends NavalBattleMove['type']>(
  moves: NavalBattleMove[],
  type: T,
): Extract<NavalBattleMove, { type: T }>[] {
  return moves.filter((move): move is Extract<NavalBattleMove, { type: T }> => move.type === type);
}

function secondTarget(
  state: NavalBattleState,
  player: Player,
  first: NavalCoordinate,
  difficulty: Difficulty,
  random: () => number,
) {
  const clone: NavalBattleState = {
    ...state,
    shots: [...state.shots, { shooter: player, ...first, outcome: 'miss' as const }],
  };
  return difficulty === 'hard'
    ? hardTarget(clone, player, random)
    : mediumTarget(clone, player, random);
}

export function chooseNavalMove(
  state: NavalBattleState,
  difficulty: Difficulty,
  options: NavalAiOptions = {},
): NavalBattleMove {
  const random = options.random ?? Math.random;
  const moves = legalNavalMoves(state);
  if (!moves.length) throw new Error('no-legal-moves');
  const player = state.turn;

  if (state.phase === 'loadout') {
    const preferred = defaultLoadout(difficulty, random);
    const exact = legalOfType(moves, 'selectAbilities').find(
      (move) =>
        move.abilities.length === preferred.length &&
        preferred.every((ability) => move.abilities.includes(ability)),
    );
    return exact ?? choose(legalOfType(moves, 'selectAbilities'), random);
  }

  if (state.phase === 'placement') {
    const ready = moves.find((move) => move.type === 'ready');
    if (ready) return ready;
    if (difficulty === 'easy') return choose(moves, random);
    let best = -Infinity;
    let candidates: NavalBattleMove[] = [];
    for (const move of moves) {
      const value = placementScore(state, player, move);
      if (value > best) {
        best = value;
        candidates = [move];
      } else if (value === best) candidates.push(move);
    }
    return choose(candidates, random);
  }

  if (state.hunterWindow) {
    const hunter = legalOfType(moves, 'hunterFire');
    if (!hunter.length) return { type: 'declineHunter' };
    if (difficulty === 'easy' && random() < 0.45) return { type: 'declineHunter' };
    return choose(hunter, random);
  }

  const repairs = legalOfType(moves, 'emergencyRepair');
  if (
    repairs.length &&
    navalAbilityAvailable(state, player, 'emergencyRepair') &&
    (difficulty === 'hard' || (difficulty === 'medium' && random() < 0.7))
  )
    return choose(repairs, random);

  const unresolved = unresolvedHits(state, player);
  const twin = legalOfType(moves, 'twinSalvo');
  if (
    twin.length &&
    navalAbilityAvailable(state, player, 'twinSalvo') &&
    (unresolved.length > 0 || state.remainingShips[opponentSeat(player)] <= 2) &&
    difficulty !== 'easy'
  ) {
    const first =
      difficulty === 'hard' ? hardTarget(state, player, random) : mediumTarget(state, player, random);
    const second = secondTarget(state, player, first, difficulty, random);
    const exact = twin.find(
      (move) =>
        (navalCellKey(move.targets[0]) === navalCellKey(first) &&
          navalCellKey(move.targets[1]) === navalCellKey(second)) ||
        (navalCellKey(move.targets[1]) === navalCellKey(first) &&
          navalCellKey(move.targets[0]) === navalCellKey(second)),
    );
    if (exact) return exact;
  }

  const sonar = legalOfType(moves, 'sonarPulse');
  if (
    sonar.length &&
    navalAbilityAvailable(state, player, 'sonarPulse') &&
    unresolved.length === 0 &&
    ownShots(state, player).length < 8 &&
    (difficulty === 'hard' || random() < 0.4)
  ) {
    const centers = sonar.filter((move) => move.row >= 2 && move.row <= 7 && move.col >= 2 && move.col <= 7);
    return choose(centers.length ? centers : sonar, random);
  }

  const jammer = legalOfType(moves, 'signalJammer');
  if (
    jammer.length &&
    navalAbilityAvailable(state, player, 'signalJammer') &&
    state.usedAbilities[opponentSeat(player)].includes('sonarPulse') === false &&
    ownShots(state, opponentSeat(player)).length < 10 &&
    difficulty !== 'easy' &&
    random() < 0.28
  ) {
    const carrier = state.fleets[player].find((ship) => ship.shipId === 'carrier');
    const center = carrier ? navalPlacementCells(carrier)[Math.floor(navalPlacementCells(carrier).length / 2)] : null;
    const exact = center ? jammer.find((move) => move.row === center.row && move.col === center.col) : undefined;
    return exact ?? choose(jammer, random);
  }

  const reposition = legalOfType(moves, 'silentReposition');
  if (
    reposition.length &&
    navalAbilityAvailable(state, player, 'silentReposition') &&
    ownShots(state, opponentSeat(player)).length >= 12 &&
    difficulty === 'hard' &&
    random() < 0.22
  ) {
    let best = -Infinity;
    let candidates: typeof reposition = [];
    for (const move of reposition) {
      const score = placementScore(state, player, move);
      if (score > best) {
        best = score;
        candidates = [move];
      } else if (score === best) candidates.push(move);
    }
    return choose(candidates, random);
  }

  if (difficulty === 'easy') {
    const normal = legalOfType(moves, 'fire');
    return choose(normal.length ? normal : moves, random);
  }
  const target =
    difficulty === 'hard'
      ? hardTarget(state, player, random)
      : mediumTarget(state, player, random);
  return { type: 'fire', row: target.row, col: target.col };
}

const opponentSeat = (player: Player): Player => (player === 0 ? 1 : 0);
