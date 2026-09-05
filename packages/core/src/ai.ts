import {
  isGameOver,
  type BaseState,
  type Difficulty,
  type GamePlugin,
  type Player,
} from './game.ts';
export interface AIOptions {
  random?: () => number;
  budgetMs?: number;
  now?: () => number;
}
// UI-free, bounded iterative-deepening alpha-beta. Run in a worker on the client.
export function chooseMove(
  game: GamePlugin,
  state: BaseState,
  difficulty: Difficulty,
  options: AIOptions = {},
): unknown | null {
  if (isGameOver(state)) return null;
  const now = options.now ?? Date.now;
  const deadline = now() + (options.budgetMs ?? (difficulty === 'hard' ? 1400 : 400));
  const player = state.turn;
  const moves = game.legalMoves(state);
  if (!moves.length) return null;
  if (difficulty === 'easy')
    return moves[
      Math.min(moves.length - 1, Math.floor((options.random ?? Math.random)() * moves.length))
    ];
  const value = (s: BaseState, p: Player) =>
    s.drawReason
      ? 0
      : s.winner === null
        ? game.evaluate(s, p)
        : s.winner === p
          ? 100000 - s.ply
          : -100000 + s.ply;
  const ordered = moves
    .map((move) => {
      const next = game.apply(state, move);
      return { move, next, score: value(next, player) };
    })
    .sort((a, b) => b.score - a.score);
  let best = ordered[0].move;
  if (difficulty === 'medium' || ordered[0].next.winner === player) return best;
  const TIMEOUT = Symbol('timeout');
  function search(s: BaseState, depth: number, alpha: number, beta: number): number {
    if (now() > deadline) throw TIMEOUT;
    if (depth === 0 || isGameOver(s)) return value(s, player);
    const maximize = s.turn === player;
    const candidates = game
      .legalMoves(s)
      .map((move) => {
        const next = game.apply(s, move);
        return { next, score: value(next, player) };
      })
      .sort((a, b) => (maximize ? b.score - a.score : a.score - b.score))
      .slice(0, 10);
    if (!candidates.length) return value(s, player);
    let result = maximize ? -Infinity : Infinity;
    for (const candidate of candidates) {
      const score = search(candidate.next, depth - 1, alpha, beta);
      result = maximize ? Math.max(result, score) : Math.min(result, score);
      if (maximize) alpha = Math.max(alpha, result);
      else beta = Math.min(beta, result);
      if (alpha >= beta) break;
    }
    return result;
  }
  for (let depth = 2; depth <= 3; depth++) {
    let iterationBest = best,
      score = -Infinity;
    try {
      for (const item of ordered.slice(0, 14)) {
        const candidate = search(item.next, depth - 1, score, Infinity);
        if (candidate > score) {
          score = candidate;
          iterationBest = item.move;
        }
      }
      best = iterationBest;
    } catch (error) {
      if (error !== TIMEOUT) throw error;
      break;
    }
  }
  return best;
}
