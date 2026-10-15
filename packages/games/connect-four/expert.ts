import type { AIOptions } from '../../core/src/ai.ts';
import type { Difficulty, Player } from '../../core/src/game.ts';
import { opponent } from '../../core/src/game.ts';
import { applyConnectFour, connectFourEngine } from './rules.ts';
import type { ConnectFourMove, ConnectFourState } from './state.ts';

const WIN_SCORE = 1_000_000;
const WINDOW_WEIGHTS = [0, 1, 10, 100, WIN_SCORE] as const;
const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]] as const;

/** A game-specific heuristic that considers center control and all unblocked four-cell windows. */
function scorePosition(state: ConnectFourState, player: Player): number {
  const other = opponent(player);
  let score = 0;
  for (let row = 0; row < 6; row++)
    if (state.board[row * 7 + 3] === player) score += 5;
    else if (state.board[row * 7 + 3] === other) score -= 5;

  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      for (const [dr, dc] of DIRECTIONS) {
        const endRow = row + dr * 3;
        const endCol = col + dc * 3;
        if (endRow < 0 || endRow >= 6 || endCol < 0 || endCol >= 7) continue;
        let own = 0;
        let enemy = 0;
        for (let distance = 0; distance < 4; distance++) {
          const cell = state.board[(row + dr * distance) * 7 + col + dc * distance];
          if (cell === player) own++;
          else if (cell === other) enemy++;
        }
        if (own === 0) score -= WINDOW_WEIGHTS[enemy] * (enemy === 3 ? 2 : 1);
        else if (enemy === 0) score += WINDOW_WEIGHTS[own];
      }
    }
  }
  return score;
}

function immediateWin(state: ConnectFourState, player: Player): ConnectFourMove | null {
  // Re-evaluating a hypothetical next turn is safe: Connect Four has no hidden state.
  const position = state.turn === player ? state : { ...state, turn: player };
  for (const move of connectFourEngine.legalMoves(position))
    if (applyConnectFour(position, move).winner === player) return move;
  return null;
}

export function chooseConnectFourExpertMove(
  state: ConnectFourState,
  difficulty: Difficulty,
  options: AIOptions = {},
): ConnectFourMove | null {
  if (state.winner !== null || state.drawReason) return null;
  const available = connectFourEngine.legalMoves(state);
  if (!available.length) return null;
  if (difficulty === 'easy') {
    const rand = options.random ?? Math.random;
    const sample = Math.max(0, Math.min(0.999999, rand()));
    return available[Math.floor(sample * available.length)];
  }

  // Both Medium and Hard recognize wins and single-move losses.
  const win = immediateWin(state, state.turn);
  if (win) return win;
  const threat = immediateWin(state, opponent(state.turn));
  if (threat && available.some((move) => move.column === threat.column))
    return { column: threat.column };

  const root = state.turn;
  const maxDepth = difficulty === 'hard' ? 6 : 3;
  const now = options.now ?? Date.now;
  const deadline = now() + (options.budgetMs ?? (difficulty === 'hard' ? 1350 : 320));
  let nodes = 0;
  const TIMEOUT = Symbol('ai-timeout');
  const evaluate = (position: ConnectFourState): number => {
    if (position.winner !== null)
      return position.winner === root ? WIN_SCORE - position.ply : -WIN_SCORE + position.ply;
    if (position.drawReason) return 0;
    return scorePosition(position, root);
  };

  function search(position: ConnectFourState, depth: number, alpha: number, beta: number): number {
    if ((++nodes & 63) === 0 && now() >= deadline) throw TIMEOUT;
    if (depth === 0 || position.winner !== null || position.drawReason) return evaluate(position);
    const maximize = position.turn === root;
    let best = maximize ? -Infinity : Infinity;
    const moves = connectFourEngine.legalMoves(position);
    if (!moves.length) return evaluate(position);
    for (const move of moves) {
      const next = applyConnectFour(position, move);
      const value = search(next, depth - 1, alpha, beta);
      best = maximize ? Math.max(best, value) : Math.min(best, value);
      if (maximize) alpha = Math.max(alpha, best);
      else beta = Math.min(beta, best);
      if (alpha >= beta) break;
    }
    return best;
  }

  // Center-first legal move order is deliberately stable, even when the time budget is tight.
  let bestMove = available[0];
  let bestFallback = -Infinity;
  for (const move of available) {
    const value = evaluate(applyConnectFour(state, move));
    if (value > bestFallback) {
      bestMove = move;
      bestFallback = value;
    }
  }

  // Only commit a completed iterative-deepening pass; a timeout keeps a valid move.
  for (let depth = 2; depth <= maxDepth; depth++) {
    if (now() >= deadline) break;
    let iterationBest = bestMove;
    let iterationScore = -Infinity;
    try {
      for (const move of available) {
        if (now() >= deadline) throw TIMEOUT;
        const value = search(applyConnectFour(state, move), depth - 1, iterationScore, Infinity);
        if (value > iterationScore) {
          iterationBest = move;
          iterationScore = value;
        }
      }
      bestMove = iterationBest;
    } catch (error) {
      if (error !== TIMEOUT) throw error;
      break;
    }
  }
  return bestMove;
}
