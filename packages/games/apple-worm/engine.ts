/**
 * NAQLA Apple Worm: original offline grid puzzles.
 * Pure, immutable rules. No copyrighted Poki code, level layouts or assets are used.
 */
import { appleWormBlueprint, APPLE_WORM_STAGE_COUNT } from './levels.ts';

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
  /** Backwards-compatible saved growth state from earlier engine versions. */
  pendingGrowth?: boolean;
  phase: Phase;
  moves: number;
}
export const WORM_LEVEL_COUNT = APPLE_WORM_STAGE_COUNT;
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
 * Forty individually specified independent stages; layouts are not generated
 * from the previous 30-stage procedural formula. The unofficial online guide
 * describes reference tactics but does not supply licensed map source files.
 */
export function wormLevel(number: number): WormLevel {
  const layout = appleWormBlueprint(number);
  const gaps = new Set(layout.gaps);
  const blocks: Point[] = [];
  for (let x = 0; x < layout.width; x++) {
    if (!gaps.has(x)) blocks.push({ x, y: layout.floor });
  }
  for (const x of layout.raised) blocks.push({x, y: layout.floor - 1});
  for (const [x, y] of layout.floating) blocks.push({x, y});
  return {
    number, width: layout.width, height: layout.height,
    blocks, spikes: [],
    apple: {x:layout.fruit[0], y:layout.fruit[1]},
    portal: {x:layout.exit[0], y:layout.exit[1]},
    start:layout.start.map(([x,y])=>({x,y})),
  };
}
export function startWorm(level = 1): WormState {
  return { level, body: wormLevel(level).start.map(p => ({ ...p })), eaten: false, pendingGrowth: false, phase: 'playing', moves: 0 };
}
export function moveWorm(state: WormState, direction: Direction): WormState {
  if (state.phase !== 'playing' || !Object.prototype.hasOwnProperty.call(STEPS, direction)) return state;
  const board = wormLevel(state.level);
  const blocked = new Set(board.blocks.map(key));
  const lethal = new Set(board.spikes.map(key));
  const delta = STEPS[direction];
  const head = state.body[0]!;
  const nextHead = { x: head.x + delta.x, y: head.y + delta.y };
  if (!within(nextHead, board) || blocked.has(key(nextHead))) return state;

  // The worm has a permanent head. It must turn around its neck rather than
  // reverse directly into the second segment, even when the tail could vacate.
  if (state.body[1] && same(state.body[1], nextHead)) return state;

  // The apple is a PHYSICAL object. It supports the worm when approached from
  // above. The only legal way to eat is for the head's mouth to move sideways
  // into the fruit. Dropping onto it or pressing down/up must NEVER eat it.
  const touchesApple = !state.eaten && same(nextHead, board.apple);
  if (touchesApple && direction !== 'left' && direction !== 'right') return state;
  const ateOnStep = touchesApple;
  const grows = ateOnStep || Boolean(state.pendingGrowth);
  const occupied = grows ? state.body : state.body.slice(0, -1);
  if (occupied.some(p => same(p, nextHead))) return state;

  let body = [nextHead, ...state.body.map(p => ({ ...p }))];
  if (!grows) body = body.slice(0, -1);
  const eaten = state.eaten || ateOnStep;
  const pendingGrowth = false;
  let phase: Phase = 'playing';
  const winning = () => eaten && same(body[0]!, board.portal);
  const dead = () => body.some(p => !within(p, board) || lethal.has(key(p)));
  const supported = (parts: Point[]) => parts.some(p =>
    blocked.has(key({ x: p.x, y: p.y + 1 })) ||
    (!eaten && same({ x: p.x, y: p.y + 1 }, board.apple)));

  if (dead()) phase = 'lost';
  else if (winning()) phase = 'won';
  else {
    // Gravity moves the whole connected worm, never individual body parts.
    // An uneaten apple blocks vertical falling and acts as a perch, just like
    // a real solid object. It is collectible only by mouth-first side contact.
    while (!supported(body)) {
      const falling = body.map(p => ({ x: p.x, y: p.y + 1 }));
      // Defensive stop for unsupported/corrupted positions: the fruit cannot
      // be passed through by gravity regardless of where the head is.
      if (!eaten && falling.some(p => same(p, board.apple))) break;
      body = falling;
      if (dead()) { phase = 'lost'; break; }
      if (winning()) { phase = 'won'; break; }
    }
  }
  return { level: state.level, body, eaten, pendingGrowth, phase, moves: state.moves + 1 };
}

export function restoreWorm(value: unknown): WormState | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as Partial<WormState>;
  if (typeof state.level !== 'number' || !Number.isInteger(state.level) || (state.level ?? 0) < 1 || (state.level ?? 0) > WORM_LEVEL_COUNT
      || !Array.isArray(state.body) || state.body.length < 2 || state.body.length > 10
      || typeof state.eaten !== 'boolean' || (state.pendingGrowth !== undefined && typeof state.pendingGrowth !== 'boolean')
      || (state.pendingGrowth === true && (!state.eaten || state.phase === 'won'))
      || !['playing', 'lost', 'won'].includes(state.phase ?? '')
      || typeof state.moves !== 'number' || !Number.isSafeInteger(state.moves) || (state.moves ?? -1) < 0) return null;
  const board = wormLevel(state.level!);
  if (!state.body.every(p => p && Number.isInteger(p.x) && Number.isInteger(p.y)
    && p.x >= 0 && p.x < board.width && p.y >= 0 && p.y < board.height)) return null;
  if (new Set(state.body.map(key)).size !== state.body.length) return null;
  if (state.body.some(p => board.blocks.some(b => same(p, b)))) return null;
  return { level: state.level!, body: state.body.map(p => ({ ...p })), eaten: state.eaten,
    pendingGrowth: state.pendingGrowth === true, phase: state.phase!, moves: state.moves! };
}
/** BFS used only for an optional on-device hint, never during a normal input. */
export function findWormSolution(initial: WormState, cap = 30000): Direction[] | null {
  if (initial.phase === 'won') return [];
  if (initial.phase === 'lost') return null;
  const serialize = (s: WormState) => (s.eaten ? '1' : '0') + (s.pendingGrowth ? 'g' : '-') + ':' + s.body.map(key).join('|');
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
