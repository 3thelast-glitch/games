/**
 * NAQLA Apple Worm: original offline grid puzzles.
 * Pure, immutable rules. No copyrighted Poki code, level layouts or assets are used.
 */
export interface Point { x: number; y: number }
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Phase = 'playing' | 'won' | 'lost';
export interface WormLevel {
  number: number;
  width: number;
  height: number;
  blocks: Point[];
  spikes: Point[];
  apple: Point;
  portal: Point;
  start: Point[]; // head first
}
export interface WormState {
  level: number;
  body: Point[];
  eaten: boolean;
  phase: Phase;
  moves: number;
}
export const WORM_LEVEL_COUNT = 30;
export const DIRECTIONS: Direction[] = ['up', 'right', 'down', 'left'];
const STEPS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const key = (p: Point) => p.x + ':' + p.y;
const within = (p: Point, level: WormLevel) =>
  p.x >= 0 && p.x < level.width && p.y >= 0 && p.y < level.height;

/**
 * Thirty authored variants of an original five-chapter progression.
 * Ch. 1 teaches apples, gravity and gaps; subsequent chapters extend routes,
 * raise obstructions and combine bridge and climb mechanics.
 */
export function wormLevel(number: number): WormLevel {
  if (!Number.isInteger(number) || number < 1 || number > WORM_LEVEL_COUNT)
    throw new RangeError('Invalid Apple Worm level');
  const index = number - 1;
  const chapter = Math.floor(index / 6);
  const variant = index % 6;
  const width = 10 + chapter * 2;
  const floor = 7;
  const blocks: Point[] = [];
  const spikePositions: Point[] = [];
  const gaps = new Set<number>();
  // Leave at least one stable landing tile on the far side of a gap.
  if (variant === 1) gaps.add(6 + chapter);
  if (variant === 2) {
    gaps.add(6 + chapter);
    gaps.add(7 + chapter);
  }
  if (variant === 4) gaps.add(8 + chapter);
  if (chapter >= 2 && variant === 0) gaps.add(width - 4);
  if (chapter >= 3 && variant === 1) gaps.add(width - 4);
  for (let x = 0; x < width; x++) if (!gaps.has(x)) blocks.push({ x, y: floor });
  if (variant === 3 || variant === 4) blocks.push({ x: 6, y: floor - 1 });
  if (variant === 5) blocks.push({ x: 3, y: floor - 1 });
  // Raised end platforms add spatial planning without obstructing the teaching route.
  if (chapter >= 2 && variant === 3) blocks.push({ x: width - 4, y: floor - 1 });
  if (chapter >= 3 && variant === 4) blocks.push({ x: width - 4, y: floor - 1 });
  // Decorative hazards are lethal when touched; keep the direct teaching lane clear.
  if (chapter >= 1 && variant === 0) spikePositions.push({ x: width - 2, y: floor - 2 });
  if (chapter >= 2 && variant === 2) spikePositions.push({ x: width - 3, y: floor - 2 });
  const apple = variant === 5 ? { x: 4, y: floor - 2 } :
    { x: 3 + ((index + 1) % 3), y: floor - 1 };
  return {
    number, width, height: 9, blocks, spikes: spikePositions,
    apple, portal: { x: width - 2, y: floor - 1 },
    start: [{ x: 2, y: floor - 1 }, { x: 1, y: floor - 1 }],
  };
}
export function startWorm(level = 1): WormState {
  return { level, body: wormLevel(level).start.map(p => ({ ...p })), eaten: false, phase: 'playing', moves: 0 };
}
export function moveWorm(state: WormState, direction: Direction): WormState {
  if (state.phase !== 'playing' || !Object.prototype.hasOwnProperty.call(STEPS, direction)) return state;
  const board = wormLevel(state.level);
  const blocked = new Set(board.blocks.map(key));
  const lethal = new Set(board.spikes.map(key));
  const delta = STEPS[direction];
  const nextHead = { x: state.body[0]!.x + delta.x, y: state.body[0]!.y + delta.y };
  if (!within(nextHead, board) || blocked.has(key(nextHead))) return state;
  const grows = !state.eaten && same(nextHead, board.apple);
  const occupied = grows ? state.body : state.body.slice(0, -1);
  if (occupied.some(p => same(p, nextHead))) return state;
  let body = [nextHead, ...state.body.map(p => ({ ...p }))];
  if (!grows) body = body.slice(0, -1);
  const eaten = state.eaten || grows;
  let phase: Phase = 'playing';
  const winning = () => eaten && same(body[0]!, board.portal);
  const dead = () => body.some(p => !within(p, board) || lethal.has(key(p)));
  if (dead()) phase = 'lost';
  else if (winning()) phase = 'won';
  else {
    // The whole worm falls one cell while not a single segment is supported.
    // Every segment moves together; the body is a rigid connected shape.
    while (!body.some(p => blocked.has(key({ x: p.x, y: p.y + 1 })))) {
      body = body.map(p => ({ x: p.x, y: p.y + 1 }));
      if (dead()) { phase = 'lost'; break; }
      if (winning()) { phase = 'won'; break; }
    }
  }
  return { level: state.level, body, eaten, phase, moves: state.moves + 1 };
}
export function restoreWorm(value: unknown): WormState | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as Partial<WormState>;
  if (typeof state.level !== 'number' || !Number.isInteger(state.level) || (state.level ?? 0) < 1 || (state.level ?? 0) > 30
      || !Array.isArray(state.body) || state.body.length < 2 || state.body.length > 10
      || typeof state.eaten !== 'boolean' || !['playing', 'lost', 'won'].includes(state.phase ?? '')
      || typeof state.moves !== 'number' || !Number.isSafeInteger(state.moves) || (state.moves ?? -1) < 0) return null;
  const board = wormLevel(state.level!);
  if (!state.body.every(p => p && Number.isInteger(p.x) && Number.isInteger(p.y)
    && p.x >= 0 && p.x < board.width && p.y >= 0 && p.y < board.height)) return null;
  if (new Set(state.body.map(key)).size !== state.body.length) return null;
  if (state.body.some(p => board.blocks.some(b => same(p, b)))) return null;
  return { level: state.level!, body: state.body.map(p => ({ ...p })), eaten: state.eaten,
    phase: state.phase!, moves: state.moves! };
}
/** BFS used only for an optional on-device hint, never during a normal input. */
export function findWormSolution(initial: WormState, cap = 30000): Direction[] | null {
  if (initial.phase === 'won') return [];
  if (initial.phase === 'lost') return null;
  const serialize = (s: WormState) => (s.eaten ? '1' : '0') + ':' + s.body.map(key).join('|');
  const seen = new Set([serialize(initial)]);
  const queue: { state: WormState; path: Direction[] }[] = [{ state: initial, path: [] }];
  for (let index = 0; index < queue.length && index < cap; index++) {
    const node = queue[index]!;
    for (const direction of DIRECTIONS) {
      const next = moveWorm(node.state, direction);
      if (next === node.state || next.phase === 'lost') continue;
      const path = [...node.path, direction];
      if (next.phase === 'won') return path;
      const signature = serialize(next);
      if (seen.has(signature)) continue;
      seen.add(signature);
      queue.push({ state: next, path });
    }
  }
  return null;
}
