import type { Player, TwoPlayerState } from '../../core/src/game.ts';
import type { NavalAbilityId } from './abilities.ts';

export const NAVAL_BOARD_SIZE = 10;

export const NAVAL_SHIPS = [
  { id: 'carrier', length: 5 },
  { id: 'battleship', length: 4 },
  { id: 'cruiser', length: 3 },
  { id: 'submarine', length: 3 },
  { id: 'destroyer', length: 2 },
] as const;

export type NavalShipId = (typeof NAVAL_SHIPS)[number]['id'];
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
  sunkShipId?: NavalShipId;
  sunkCells?: NavalCoordinate[];
}

export interface NavalSonarIntel {
  type: 'sonar';
  center: NavalCoordinate;
  count: number | null;
  jammed: boolean;
  atPly: number;
}

export type NavalPrivateIntel = NavalSonarIntel;

export interface NavalJammer {
  center?: NavalCoordinate;
  opponentTurnsRemaining: number;
}

export interface NavalHunterWindow {
  player: Player;
  origin: NavalCoordinate;
}

export type NavalPublicAction =
  | { type: 'loadoutReady'; player: Player }
  | { type: 'ready'; player: Player }
  | {
      type: 'fire';
      player: Player;
      row: number;
      col: number;
      outcome: NavalShotOutcome;
      sunkShipId?: NavalShipId;
    }
  | { type: 'ability'; player: Player; abilityId: NavalAbilityId };

export interface NavalBattleState extends TwoPlayerState {
  gameId: 'navalBattle';
  playerCount: 2;
  phase: NavalPhase;
  fleets: [NavalPlacement[], NavalPlacement[]];
  ready: [boolean, boolean];
  loadouts: [NavalAbilityId[], NavalAbilityId[]];
  loadoutLocked: [boolean, boolean];
  usedAbilities: [NavalAbilityId[], NavalAbilityId[]];
  privateIntel: [NavalPrivateIntel[], NavalPrivateIntel[]];
  jammers: [NavalJammer | null, NavalJammer | null];
  hunterWindow: NavalHunterWindow | null;
  shots: NavalShot[];
  remainingShips: [number, number];
  starter: Player;
  lastAction: NavalPublicAction | null;
  viewerSeat?: Player | null;
}

export type NavalBattleMove =
  | { type: 'selectAbilities'; abilities: NavalAbilityId[] }
  | {
      type: 'place';
      shipId: NavalShipId;
      row: number;
      col: number;
      orientation: NavalOrientation;
    }
  | { type: 'ready' }
  | { type: 'fire'; row: number; col: number }
  | { type: 'hunterFire'; row: number; col: number }
  | { type: 'declineHunter' }
  | { type: 'sonarPulse'; row: number; col: number }
  | {
      type: 'twinSalvo';
      targets: [NavalCoordinate, NavalCoordinate];
    }
  | { type: 'emergencyRepair'; row: number; col: number }
  | { type: 'signalJammer'; row: number; col: number }
  | {
      type: 'silentReposition';
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
    fleets: [[], []],
    ready: [false, false],
    loadouts: [[], []],
    loadoutLocked: [false, false],
    usedAbilities: [[], []],
    privateIntel: [[], []],
    jammers: [null, null],
    hunterWindow: null,
    shots: [],
    remainingShips: [NAVAL_SHIPS.length, NAVAL_SHIPS.length],
    starter,
    lastAction: null,
    turn: starter,
    ply: 0,
    winner: null,
    drawReason: null,
  };
}
