import {
  RuleError,
  opponent,
  type Player,
  type RulesEngine,
  type Validation,
} from '../../core/src/game.ts';
import {
  createQuoridor,
  goalRow,
  inGrid,
  squareEqual,
  type QuoridorState,
  type QuoridorMove,
  type Square,
  type Wall,
} from './state.ts';
const steps: Square[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const plus = (a: Square, b: Square): Square => [a[0] + b[0], a[1] + b[1]];
const index = (p: Square) => p[0] * 9 + p[1];
const adjacencyCache = new WeakMap<QuoridorState, number[][]>();
export function edgeBlocked(state: QuoridorState, a: Square, b: Square): boolean {
  if (!inGrid(a) || !inGrid(b) || Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) return true;
  if (a[0] !== b[0])
    return state.walls.some(
      (w) =>
        w.orientation === 'h' &&
        w.row === Math.min(a[0], b[0]) &&
        (a[1] === w.col || a[1] === w.col + 1),
    );
  return state.walls.some(
    (w) =>
      w.orientation === 'v' &&
      w.col === Math.min(a[1], b[1]) &&
      (a[0] === w.row || a[0] === w.row + 1),
  );
}
function adjacency(state: QuoridorState): number[][] {
  const existing = adjacencyCache.get(state);
  if (existing) return existing;
  const graph = Array.from({ length: 81 }, (_, i) => {
    const p: Square = [Math.floor(i / 9), i % 9];
    return steps
      .map((d) => plus(p, d))
      .filter((n) => !edgeBlocked(state, p, n))
      .map(index);
  });
  adjacencyCache.set(state, graph);
  return graph;
}
// Wall validation ignores pawn occupancy: pawns move and cannot permanently seal a route.
export function shortestPath(state: QuoridorState, player: Player): Square[] {
  const graph = adjacency(state),
    start = index(state.pawns[player]);
  const previous = new Int16Array(81).fill(-2),
    queue = [start];
  previous[start] = -1;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const cell = queue[cursor];
    if (Math.floor(cell / 9) === goalRow(player)) {
      const result: Square[] = [];
      let step = cell;
      while (step !== -1) {
        result.push([Math.floor(step / 9), step % 9]);
        step = previous[step];
      }
      return result.reverse();
    }
    for (const next of graph[cell])
      if (previous[next] === -2) {
        previous[next] = cell;
        queue.push(next);
      }
  }
  return [];
}
export function pawnTargets(state: QuoridorState, player: Player = state.turn): Square[] {
  if (state.winner !== null) return [];
  const current = state.pawns[player],
    other = state.pawns[opponent(player)],
    targets: Square[] = [];
  for (const d of steps) {
    const adjacent = plus(current, d);
    if (edgeBlocked(state, current, adjacent)) continue;
    if (!squareEqual(adjacent, other)) {
      targets.push(adjacent);
      continue;
    }
    const behind = plus(other, d);
    if (!edgeBlocked(state, other, behind)) targets.push(behind);
    else
      for (const side of steps.filter((s) => s[0] * d[0] + s[1] * d[1] === 0)) {
        const diagonal = plus(other, side);
        if (!edgeBlocked(state, other, diagonal)) targets.push(diagonal);
      }
  }
  return targets;
}
export function parseQuoridorMove(input: unknown): QuoridorMove {
  if (!input || typeof input !== 'object') throw new RuleError('invalid-move');
  const m = input as QuoridorMove;
  if (
    m.kind === 'pawn' &&
    Object.keys(m).every((k) => ['kind', 'to'].includes(k)) &&
    Array.isArray(m.to) &&
    inGrid(m.to)
  )
    return m;
  if (
    m.kind === 'wall' &&
    Object.keys(m).every((k) => ['kind', 'wall'].includes(k)) &&
    m.wall &&
    typeof m.wall === 'object' &&
    Object.keys(m.wall).every((k) => ['row', 'col', 'orientation'].includes(k)) &&
    ['h', 'v'].includes(m.wall.orientation) &&
    [m.wall.row, m.wall.col].every((n) => Number.isInteger(n) && n >= 0 && n < 8)
  )
    return m;
  throw new RuleError('invalid-move');
}
export function wallValidation(state: QuoridorState, wall: Wall): Validation {
  try {
    parseQuoridorMove({ kind: 'wall', wall });
  } catch {
    return { ok: false, code: 'invalid-wall' };
  }
  if (state.winner !== null) return { ok: false, code: 'game-over' };
  if (state.remaining[state.turn] <= 0) return { ok: false, code: 'no-walls' };
  for (const existing of state.walls) {
    if (wall.row === existing.row && wall.col === existing.col)
      return { ok: false, code: 'wall-overlap' };
    if (
      wall.orientation === existing.orientation &&
      (wall.orientation === 'h'
        ? wall.row === existing.row && Math.abs(wall.col - existing.col) < 2
        : wall.col === existing.col && Math.abs(wall.row - existing.row) < 2)
    )
      return { ok: false, code: 'wall-overlap' };
  }
  const next: QuoridorState = {
    ...state,
    walls: [...state.walls, { ...wall, owner: state.turn }],
  };
  if (!shortestPath(next, 0).length || !shortestPath(next, 1).length)
    return { ok: false, code: 'path-blocked' };
  return { ok: true };
}
export function validateQuoridor(state: QuoridorState, move: QuoridorMove): Validation {
  try {
    parseQuoridorMove(move);
  } catch {
    return { ok: false, code: 'invalid-move' };
  }
  if (state.winner !== null) return { ok: false, code: 'game-over' };
  if (move.kind === 'wall') return wallValidation(state, move.wall);
  return pawnTargets(state).some((p) => squareEqual(p, move.to))
    ? { ok: true }
    : { ok: false, code: 'illegal-pawn-move' };
}
export function applyQuoridor(state: QuoridorState, move: QuoridorMove): QuoridorState {
  const validation = validateQuoridor(state, move);
  if (!validation.ok) throw new RuleError(validation.code);
  const next: QuoridorState = {
    ...state,
    pawns: [...state.pawns],
    walls: [...state.walls],
    remaining: [...state.remaining],
    turn: opponent(state.turn),
    ply: state.ply + 1,
  };
  if (move.kind === 'wall') {
    next.walls.push({ ...move.wall, owner: state.turn });
    next.remaining[state.turn]--;
  } else {
    next.pawns[state.turn] = [...move.to];
    if (move.to[0] === goalRow(state.turn)) next.winner = state.turn;
  }
  return next;
}
export function quoridorLegalMoves(state: QuoridorState): QuoridorMove[] {
  if (state.winner !== null) return [];
  const moves: QuoridorMove[] = pawnTargets(state).map((to) => ({
    kind: 'pawn',
    to,
  }));
  if (state.remaining[state.turn])
    for (let row = 0; row < 8; row++)
      for (let col = 0; col < 8; col++)
        for (const orientation of ['h', 'v'] as const) {
          const wall = { row, col, orientation };
          if (wallValidation(state, wall).ok) moves.push({ kind: 'wall', wall });
        }
  return moves;
}
export const quoridorEngine: RulesEngine<QuoridorState, QuoridorMove> = {
  id: 'quoridor',
  winReason: 'goal',
  create: createQuoridor,
  parseMove: parseQuoridorMove,
  validate: validateQuoridor,
  apply: applyQuoridor,
  legalMoves: quoridorLegalMoves,
  evaluate: (state, player) =>
    (shortestPath(state, opponent(player)).length - shortestPath(state, player).length) * 16 +
    (state.remaining[player] - state.remaining[opponent(player)]) * 2,
};
