import type { BaseState, PlayerCount, Seat } from '../../core/src/game.ts';

export type DigitalColor = 'red' | 'blue' | 'orange' | 'black';
export type MeldType = 'group' | 'run';

export interface DigitalTile {
  id: string;
  value: number | null;
  color: DigitalColor | null;
  copyIndex: 0 | 1 | null;
  isJoker: boolean;
}

export interface DigitalMeld {
  id: string;
  tiles: string[];
  type: MeldType;
}

export interface DigitalGameState extends BaseState {
  gameId: 'digitalGame';
  playerCount: PlayerCount;
  /** Complete catalog on authoritative/local states; projected online states only include visible tiles. */
  tiles: Record<string, DigitalTile>;
  /** One rack per seat. Online projections replace non-viewer IDs with opaque placeholders. */
  racks: string[][];
  rackCounts: number[];
  /** Authoritative/local draw order. Online projections contain count-only placeholders. */
  drawPool: string[];
  table: DigitalMeld[];
  hasCompletedInitialMeld: boolean[];
  scores: number[];
  /** Authoritative shuffle seed. Online projections deliberately replace it with 0. */
  seed: number;
  /** Present only in a projected online state so the UI knows which private rack is visible. */
  viewerSeat?: Seat;
  lastAction: 'commit' | 'draw' | null;
  emptyPoolPasses: number;
}

export interface CommitMeldIntent {
  id?: string;
  tiles: string[];
}

export type DigitalGameMove =
  | { type: 'draw' }
  | {
      type: 'commit';
      table: CommitMeldIntent[];
    };

export const DIGITAL_COLORS: readonly DigitalColor[] = ['red', 'blue', 'orange', 'black'];
export const INITIAL_MELD_POINTS = 30;
export const JOKER_PENALTY = 30;
export const TILES_PER_PLAYER = 14;
export const TOTAL_TILES = 106;

function randomSeed(): number {
  const bytes = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return bytes[0] || 1;
  }
  return (Date.now() ^ 0x9e3779b9) >>> 0 || 1;
}

export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createTileSet(): DigitalTile[] {
  const tiles: DigitalTile[] = [];
  let serial = 0;
  for (const color of DIGITAL_COLORS)
    for (let value = 1; value <= 13; value++)
      for (const copyIndex of [0, 1] as const)
        tiles.push({
          id: `t${String(serial++).padStart(3, '0')}`,
          value,
          color,
          copyIndex,
          isJoker: false,
        });
  tiles.push({ id: `t${String(serial++).padStart(3, '0')}`, value: null, color: null, copyIndex: null, isJoker: true });
  tiles.push({ id: `t${String(serial++).padStart(3, '0')}`, value: null, color: null, copyIndex: null, isJoker: true });
  return tiles;
}

export function shuffleTileIds(ids: string[], seed: number): string[] {
  const out = [...ids];
  const random = seededRandom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createDigitalGame(seed = randomSeed(), playerCount: PlayerCount = 2): DigitalGameState {
  const list = createTileSet();
  const tiles = Object.fromEntries(list.map((tile) => [tile.id, tile]));
  const pool = shuffleTileIds(list.map((tile) => tile.id), seed);
  const racks = Array.from({ length: playerCount }, () => pool.splice(0, TILES_PER_PLAYER));
  return {
    gameId: 'digitalGame',
    playerCount,
    tiles,
    racks,
    rackCounts: racks.map((rack) => rack.length),
    drawPool: pool,
    table: [],
    hasCompletedInitialMeld: Array.from({ length: playerCount }, () => false),
    scores: Array.from({ length: playerCount }, () => 0),
    seed,
    lastAction: null,
    emptyPoolPasses: 0,
    turn: 0,
    ply: 0,
    winner: null,
    drawReason: null,
  };
}

export function createDigitalGameForPlayers(playerCount: PlayerCount = 2): DigitalGameState {
  return createDigitalGame(randomSeed(), playerCount);
}

export const nextPlayer = (player: Seat, playerCount: number = 2): Seat =>
  (((player + 1) % playerCount) as Seat);
