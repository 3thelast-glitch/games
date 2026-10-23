/**
 * Heuristic (weighted A*) solver for the Apple Worm 105-stage game.
 *
 * Phase 1 companion to solvability.ts: the plain BFS there classifies
 * stages honestly but runs out of budget on the large late stages (many
 * apples -> long body -> exploding state space). This solver searches the
 * EXACT same engine transitions (startScreenshotWorm/moveScreenshotWorm);
 * it changes only the *order* in which states are explored, plus a
 * best-cost visited map. It never invents moves, geometry or exits, and a
 * stage counts as won only after replayAppleWormRoute replays the found
 * route through the real engine to phase "won".
 *
 * Guidance notes (from the actual game rules, not assumptions):
 * - The portal is always open; apples are OPTIONAL growth, never a gate.
 *   The heuristic therefore targets the exit only and never requires
 *   collecting fruit. Eating can still matter physically (a longer body
 *   bridges/support-changes), and the search explores those states too.
 * - For top-boundary stages (70/95/101) the target is the exit row above
 *   the field, straight above the start head column.
 * - States are post-gravity (the engine settles the worm inside a move),
 *   so Manhattan distance on the head is a stable guide.
 *
 * Status language matches solvability.ts: "budget" means UNDETERMINED
 * (never "impossible"); "exhausted" refers strictly to this search under
 * the current provisional engine.
 */
import {
  SCREENSHOT_DIRECTIONS,
  screenshotWormLevel,
  startScreenshotWorm,
  moveScreenshotWorm,
  type ScreenshotDirection,
  type ScreenshotState,
} from './screenshot-game.ts';
import { replayAppleWormRoute, type SolvabilityStatus } from './solvability.ts';

export interface HeuristicSolvability {
  level: number;
  status: SolvabilityStatus;
  explored: number;
  discovered: number;
  route: readonly ScreenshotDirection[] | null;
  routeLength: number | null;
  elapsedMs: number;
  maxStates: number;
}

const stateKey = (s: ScreenshotState) =>
  s.body.map((p) => p[0] + ',' + p[1]).join(';') +
  '|' +
  s.collected.join(',') +
  '|' +
  (s.grayPositions?.map((p) => p[0] + ',' + p[1]).join(';') ?? '');

interface Node {
  state: ScreenshotState;
  parent: number;
  via: ScreenshotDirection | null;
  g: number;
}

/** Minimal binary heap keyed by (f, h, -g): classic A* pop order with a
 * depth tie-break so equal-cost frontier nodes nearer the goal go first. */
class Frontier {
  private items: { index: number; f: number; h: number; g: number }[] = [];
  get size() {
    return this.items.length;
  }
  push(item: { index: number; f: number; h: number; g: number }) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!Frontier.less(a[i]!, a[p]!)) break;
      [a[i], a[p]] = [a[p]!, a[i]!];
      i = p;
    }
  }
  pop(): { index: number; f: number; h: number; g: number } | undefined {
    const a = this.items;
    if (!a.length) return undefined;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && Frontier.less(a[l]!, a[m]!)) m = l;
        if (r < a.length && Frontier.less(a[r]!, a[m]!)) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m]!, a[i]!];
        i = m;
      }
    }
    return top;
  }
  private static less(
    x: { f: number; h: number; g: number },
    y: { f: number; h: number; g: number },
  ) {
    if (x.f !== y.f) return x.f < y.f;
    if (x.h !== y.h) return x.h < y.h;
    return x.g > y.g;
  }
}

export function solveAppleWormLevelHeuristic(
  level: number,
  options: {
    maxStates?: number;
    maxMillis?: number;
    /** A* heuristic weight: 1 = classic A*, >1 = greedier/faster. */
    weight?: number;
    source?: 'full-video' | 'legacy';
  } = {},
): HeuristicSolvability {
  const mode = options.source ?? 'full-video';
  const stage = screenshotWormLevel(level, mode);
  const started = Date.now();
  const maxStates = options.maxStates ?? 100_000;
  const maxMillis = options.maxMillis ?? 60_000;
  const weight = options.weight ?? 2;
  if (!Number.isInteger(maxStates) || maxStates < 1)
    throw new RangeError('maxStates must be positive');
  if (!(weight >= 1)) throw new RangeError('weight must be >= 1');
  const done = (status: SolvabilityStatus, explored: number, discovered: number) => ({
    level,
    status,
    explored,
    discovered,
    route: null,
    routeLength: null,
    elapsedMs: Date.now() - started,
    maxStates,
  });
  if (stage.exitMode === 'unknown') return done('missing-exit', 0, 0);

  const initial = startScreenshotWorm(level, mode);
  if (initial.phase === 'won')
    return { ...done('won', 0, 1), route: [], routeLength: 0 };
  const target: readonly [number, number] = stage.portal ?? [initial.body[0]![0], -3];
  const heuristic = (s: ScreenshotState) =>
    Math.abs(s.body[0]![0] - target[0]) + Math.abs(s.body[0]![1] - target[1]);

  const nodes: Node[] = [{ state: initial, parent: -1, via: null, g: 0 }];
  const bestG = new Map<string, number>([[stateKey(initial), 0]]);
  const frontier = new Frontier();
  frontier.push({ index: 0, f: weight * heuristic(initial), h: heuristic(initial), g: 0 });
  let explored = 0;

  while (frontier.size) {
    if (explored >= maxStates || Date.now() - started >= maxMillis) break;
    const current = frontier.pop()!;
    const node = nodes[current.index]!;
    if (current.g > node.g) continue; // stale heap entry
    explored++;
    for (const direction of SCREENSHOT_DIRECTIONS) {
      const next = moveScreenshotWorm(node.state, direction, stage);
      if (next === node.state || next.phase === 'lost') continue;
      const g = node.g + 1;
      if (next.phase === 'won') {
        const route: ScreenshotDirection[] = [direction];
        let i = current.index;
        while (i > 0) {
          const n = nodes[i]!;
          if (n.via) route.push(n.via);
          i = n.parent;
        }
        route.reverse();
        const checked = replayAppleWormRoute(level, route, { source: mode });
        if (!checked.won || checked.legalMoves !== route.length)
          throw new Error('heuristic solver found an invalid winning route for stage ' + level);
        return {
          level,
          status: 'won',
          explored,
          discovered: bestG.size,
          route,
          routeLength: route.length,
          elapsedMs: Date.now() - started,
          maxStates,
        };
      }
      const k = stateKey(next);
      const known = bestG.get(k);
      if (known !== undefined && known <= g) continue;
      bestG.set(k, g);
      const index = nodes.length;
      nodes.push({ state: next, parent: current.index, via: direction, g });
      const h = heuristic(next);
      frontier.push({ index, f: g + weight * h, h, g });
    }
  }
  return done(frontier.size ? 'budget' : 'exhausted', explored, bestG.size);
}
