import type { Player, TwoPlayerState } from '../../core/src/game.ts';

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
export type NavalPhase = 'placement' | 'battle';

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
  /** Public only when the shot sank that ship. */
  sunkShipId?: NavalShipId;
  /** Full hull is disclosed only once sunk. */
  sunkCells?: NavalCoordinate[];
}

export type NavalPublicAction =
  | { type: 'ready'; player: Player }
  | { type: 'fire'; player: Player; row: number; col: number; outcome: NavalShotOutcome; sunkShipId?: NavalShipId };

export interface NavalBattleState extends TwoPlayerState {
  gameId: 'navalBattle';
  playerCount: 2;
  phase: NavalPhase;
  /** Authoritative state contains both fleets. Projected state contains only the viewer's fleet. */
  fleets: [NavalPlacement[], NavalPlacement[]];
  ready: [boolean, boolean];
  shots: NavalShot[];
  remainingShips: [number, number];
  starter: Player;
  lastAction: NavalPublicAction | null;
  /** Present only on projected states. Null is the privacy-handoff/public-only view. */
  viewerSeat?: Player | null;
}

export type NavalBattleMove =
  | {
      type: 'place';
      shipId: NavalShipId;
      row: number;
      col: number;
      orientation: NavalOrientation;
    }
  | { type: 'ready' }
  | { type: 'fire'; row: number; col: number };

export const navalShip = (shipId: NavalShipId) => {
  const ship = NAVAL_SHIPS.find((candidate) => candidate.id === shipId);
  if (!ship) throw new Error('invalid-ship');
  return ship;
};

export function createNavalBattle(starter: Player = 0): NavalBattleState {
  return {
    gameId: 'navalBattle',
    playerCount: 2,
    phase: 'placement',
    fleets: [[], []],
    ready: [false, false],
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
