import type { Difficulty, Player } from '../../core/src/game.ts';
import {
  NAVAL_BOARD_SIZE,
  NAVAL_SHIPS,
  type NavalAbilityId,
  type NavalBattleMove,
  type NavalBattleState,
  type NavalCoordinate,
  type NavalPlacement,
  type NavalShipId,
} from './state.ts';
import {
  isNavalPlacementValid,
  legalNavalMoves,
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
  const sunk = new Set(
    shots.flatMap((shot) => shot.sunkCells ?? []).map((cell) => navalCellKey(cell)),
  );
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
  if (move.type !== 'place') return 0;
  const fleet = state.fleets[player].filter((placement) => placement.shipId !== move.shipId);
  const candidate: NavalPlacement = { ...move };
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

export function chooseNavalMove(
  state: NavalBattleState,
  difficulty: Difficulty,
  options: NavalAiOptions = {},
): NavalBattleMove {
  const random = options.random ?? Math.random;
  const moves = legalNavalMoves(state);
  if (!moves.length) throw new Error('no-legal-moves');

  if (state.phase === 'loadout') {
    if (difficulty === 'easy') return choose(moves, random);
    const preferred: [NavalAbilityId, NavalAbilityId, NavalAbilityId] =
      difficulty === 'hard'
        ? ['sonarPulse', 'emergencyRepair', 'twinSalvo']
        : ['sonarPulse', 'hunterProtocol', 'twinSalvo'];
    return { type: 'selectAbilities', abilities: preferred };
  }

  if (state.phase === 'placement') {
    const ready = moves.find((move) => move.type === 'ready');
    if (ready) return ready;
    if (difficulty === 'easy') return choose(moves, random);
    let best = -Infinity;
    let candidates: NavalBattleMove[] = [];
    for (const move of moves) {
      const value = placementScore(state, state.turn, move);
      if (value > best) {
        best = value;
        candidates = [move];
      } else if (value === best) candidates.push(move);
    }
    return choose(candidates, random);
  }

  if (state.hunterWindow) {
    const hunterMoves = moves.filter(
      (move) => move.type === 'useAbility' && move.ability === 'hunterProtocol',
    );
    if (hunterMoves.length && difficulty !== 'easy') return choose(hunterMoves, random);
    return choose(moves, random);
  }

  if (difficulty === 'easy') return choose(moves, random);

  const repair = moves.find(
    (move) => move.type === 'useAbility' && move.ability === 'emergencyRepair',
  );
  if (repair) return repair;

  const ownFireCount = state.shots.filter((shot) => shot.shooter === state.turn).length;
  const sonarMoves = moves.filter(
    (move) => move.type === 'useAbility' && move.ability === 'sonarPulse',
  );
  if (sonarMoves.length && ownFireCount <= (difficulty === 'hard' ? 4 : 2))
    return choose(sonarMoves, random);

  const twinMoves = moves.filter(
    (move) => move.type === 'useAbility' && move.ability === 'twinSalvo',
  );
  if (twinMoves.length && unresolvedHits(state, state.turn).length)
    return choose(twinMoves, random);

  const target =
    difficulty === 'hard'
      ? hardTarget(state, state.turn, random)
      : mediumTarget(state, state.turn, random);
  return { type: 'fire', row: target.row, col: target.col };
}
