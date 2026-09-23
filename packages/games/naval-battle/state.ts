import type { Player, TwoPlayerState } from '../../core/src/game.ts';

export const NAVAL_BOARD_SIZE = 10;

export const NAVAL_SHIPS = [
  { id: 'carrier', length: 5 },
  { id: 'battleship', length: 4 },
  { id: 'cruiser', length: 3 },
  { id: 'submarine', length: 3 },
  { id: 'destroyer', length: 2 },
] as const;

export const NAVAL_ABILITIES = [
  'sonarPulse',
  'twinSalvo',
  'hunterProtocol',
  'emergencyRepair',
  'signalJammer',
  'silentReposition',
] as const;

export type NavalShipId = (typeof NAVAL_SHIPS)[number]['id'];
export type NavalAbilityId = (typeof NAVAL_ABILITIES)[number];
export type NavalOrientation = 'horizontal' | 'vertical';
export type NavalPhase = 'loadout' | 'placement' | 'battle';

export interface NavalCoordinate {
  row: number;
  col: number;
}

export interface NavalPlacement extends NavalCoordinate {
  shipId: NavalShipId;
  orientation: NavalOrientation;
}

export type NavalShotOutcome = 'miss' | 'hit' | 'sunk';

export interface NavalShot extends NavalCoordinate {
  shooter: Player;
  outcome: NavalShotOutcome;
  repaired?: boolean;
  /** Public only when the shot sank that ship. */
  sunkShipId?: NavalShipId;
  /** Full hull is disclosed only once sunk. */
  sunkCells?: NavalCoordinate[];
}

export interface NavalSonarScan extends NavalCoordinate {
  player: Player;
  count: number;
  blocked: boolean;
}

export interface NavalJammer extends NavalCoordinate {
  owner: Player;
  remainingOpponentTurns: number;
}

export interface NavalHunterWindow {
  player: Player;
  origin: NavalCoordinate;
}

export type NavalPublicAction =
  | { type: 'selectAbilities'; player: Player }
  | { type: 'ready'; player: Player }
  | {
      type: 'fire';
      player: Player;
      row: number;
      col: number;
      outcome: NavalShotOutcome;
      sunkShipId?: NavalShipId;
    }
  | {
      type: 'ability';
      player: Player;
      ability: NavalAbilityId;
      blocked?: boolean;
      outcomes?: NavalShotOutcome[];
    };

export interface NavalBattleState extends TwoPlayerState {
  gameId: 'navalBattle';
  playerCount: 2;
  phase: NavalPhase;

  /** Authoritative state has each full loadout. Projected state exposes own loadout + revealed enemy abilities. */
  loadouts: [NavalAbilityId[], NavalAbilityId[]];
  usedAbilities: [NavalAbilityId[], NavalAbilityId[]];

  /** Authoritative state contains both fleets. Projected state contains only the viewer's fleet. */
  fleets: [NavalPlacement[], NavalPlacement[]];
  ready: [boolean, boolean];
  shots: NavalShot[];
  sonarScans: NavalSonarScan[];
  jammers: NavalJammer[];
  hunterWindow: NavalHunterWindow | null;
  remainingShips: [number, number];
  starter: Player;
  lastAction: NavalPublicAction | null;
  /** Present only on projected states. Null is the privacy-handoff/public-only view. */
  viewerSeat?: Player | null;
}

export type NavalBattleMove =
  | { type: 'selectAbilities'; abilities: [NavalAbilityId, NavalAbilityId, NavalAbilityId] }
  | {
      type: 'place';
      shipId: NavalShipId;
      row: number;
      col: number;
      orientation: NavalOrientation;
    }
  | { type: 'ready' }
  | { type: 'fire'; row: number; col: number }
  | { type: 'skipHunter' }
  | { type: 'useAbility'; ability: 'sonarPulse'; row: number; col: number }
  | {
      type: 'useAbility';
      ability: 'twinSalvo';
      targets: [NavalCoordinate, NavalCoordinate];
    }
  | { type: 'useAbility'; ability: 'hunterProtocol'; row: number; col: number }
  | { type: 'useAbility'; ability: 'emergencyRepair'; row: number; col: number }
  | { type: 'useAbility'; ability: 'signalJammer'; row: number; col: number }
  | {
      type: 'useAbility';
      ability: 'silentReposition';
      shipId: NavalShipId;
      row: number;
      col: number;
      orientation: NavalOrientation;
    };

export const navalShip = (shipId: NavalShipId) => {
  const ship = NAVAL_SHIPS.find((candidate) => candidate.id === shipId);
  if (!ship) throw new Error('invalid-ship');
  return ship;
};

export function createNavalBattle(starter: Player = 0): NavalBattleState {
  return {
    gameId: 'navalBattle',
    playerCount: 2,
    phase: 'loadout',
    loadouts: [[], []],
    usedAbilities: [[], []],
    fleets: [[], []],
    ready: [false, false],
    shots: [],
    sonarScans: [],
    jammers: [],
    hunterWindow: null,
    remainingShips: [NAVAL_SHIPS.length, NAVAL_SHIPS.length],
    starter,
    lastAction: null,
    turn: starter,
    ply: 0,
    winner: null,
    drawReason: null,
  };
}
