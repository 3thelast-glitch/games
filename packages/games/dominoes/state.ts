import type { Player, TwoPlayerState } from '../../core/src/game.ts';

export type DominoTileId = string;
export type DominoSide = 'left' | 'right';

export interface DominoTile {
  id: DominoTileId;
  a: number;
  b: number;
}

export interface DominoChainTile {
  tileId: DominoTileId;
  leftValue: number;
  rightValue: number;
}

export type DominoPublicAction =
  | {
      type: 'play';
      player: Player;
      tileId: DominoTileId;
      side: DominoSide;
      leftValue: number;
      rightValue: number;
    }
  | { type: 'draw'; player: Player; handCount: number; tileId?: DominoTileId }
  | { type: 'pass'; player: Player };

export interface DominoesState extends TwoPlayerState {
  gameId: 'dominoes';
  playerCount: 2;
  /** Full IDs exist only in authoritative/local state. Projections keep only the viewer's hand. */
  hands: [DominoTileId[], DominoTileId[]];
  handCounts: [number, number];
  /** Full ordered IDs exist only in authoritative/local state. Projections expose only boneyardCount. */
  boneyard: DominoTileId[];
  boneyardCount: number;
  chain: DominoChainTile[];
  openingStarter: Player;
  /** Hidden from the non-starting player until it becomes public by being played. */
  openingTileId: DominoTileId | null;
  openingPending: boolean;
  seed: number;
  lastAction: DominoPublicAction | null;
  blockedPips: [number, number] | null;
  /** Present only in a projected state. Null means a public-only local handoff view. */
  viewerSeat?: Player | null;
}

export type DominoesMove =
  | { type: 'play'; tileId: DominoTileId; side: DominoSide }
  | { type: 'draw' }
  | { type: 'pass' };

function randomSeed(): number {
  const bytes = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return bytes[0] || 1;
  }
  return (Date.now() ^ 0x85ebca6b) >>> 0 || 1;
}

export function seededDominoRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const canonicalDominoId = (a: number, b: number): DominoTileId =>
  `${Math.min(a, b)}|${Math.max(a, b)}`;

export function dominoTile(id: DominoTileId): DominoTile {
  const match = /^([0-6])\|([0-6])$/.exec(id);
  if (!match) throw new Error('invalid-domino-id');
  const a = Number(match[1]),
    b = Number(match[2]);
  if (a > b) throw new Error('non-canonical-domino-id');
  return { id, a, b };
}

export function createDoubleSixSet(): DominoTile[] {
  const result: DominoTile[] = [];
  for (let a = 0; a <= 6; a++)
    for (let b = a; b <= 6; b++) result.push({ id: canonicalDominoId(a, b), a, b });
  return result;
}

export function shuffleDominoIds(ids: DominoTileId[], seed: number): DominoTileId[] {
  const out = [...ids];
  const random = seededDominoRandom(seed);
  for (let index = out.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [out[index], out[swap]] = [out[swap], out[index]];
  }
  return out;
}

function openingRank(id: DominoTileId): [number, number, number, number] {
  const { a, b } = dominoTile(id);
  return [a === b ? 1 : 0, a === b ? a : a + b, b, a];
}

function compareRank(left: DominoTileId, right: DominoTileId): number {
  const a = openingRank(left),
    b = openingRank(right);
  for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
}

export function chooseDominoOpening(
  hands: [DominoTileId[], DominoTileId[]],
): { starter: Player; tileId: DominoTileId } {
  const doubles: Array<{ player: Player; tileId: DominoTileId }> = [];
  for (const player of [0, 1] as const)
    for (const tileId of hands[player]) {
      const tile = dominoTile(tileId);
      if (tile.a === tile.b) doubles.push({ player, tileId });
    }
  const candidates = doubles.length
    ? doubles
    : ([0, 1] as const).flatMap((player) => hands[player].map((tileId) => ({ player, tileId })));
  candidates.sort((left, right) => compareRank(right.tileId, left.tileId));
  return candidates[0];
}

export function createDominoes(seed = randomSeed()): DominoesState {
  const pool = shuffleDominoIds(
    createDoubleSixSet().map((tile) => tile.id),
    seed,
  );
  const hands: [DominoTileId[], DominoTileId[]] = [pool.splice(0, 7), pool.splice(0, 7)];
  const opening = chooseDominoOpening(hands);
  return {
    gameId: 'dominoes',
    playerCount: 2,
    hands,
    handCounts: [7, 7],
    boneyard: pool,
    boneyardCount: pool.length,
    chain: [],
    openingStarter: opening.starter,
    openingTileId: opening.tileId,
    openingPending: true,
    seed,
    lastAction: null,
    blockedPips: null,
    turn: opening.starter,
    ply: 0,
    winner: null,
    drawReason: null,
  };
}
