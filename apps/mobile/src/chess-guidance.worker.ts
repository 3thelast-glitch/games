import { chooseChessExpertMove } from '../../../packages/games/chess/expert.ts';
import { buildChessGuidance } from '../../../packages/games/chess/guidance.ts';
import type { ChessAiStyle } from '../../../packages/games/chess/training.ts';
import type { ChessState } from '../../../packages/games/chess/state.ts';
import type { Difficulty } from '../../../packages/core/src/game.ts';

interface GuidanceRequest {
  requestId: string;
  matchId: string;
  state: ChessState;
  difficulty: Difficulty;
  style?: ChessAiStyle;
}

self.onmessage = (event: MessageEvent<GuidanceRequest>) => {
  const { requestId, matchId, state, difficulty, style } = event.data;
  try {
    const strength =
      difficulty === 'easy'
        ? { budgetMs: 180, maxDepth: 3 }
        : difficulty === 'medium'
          ? { budgetMs: 650, maxDepth: 4 }
          : { budgetMs: 1800, maxDepth: 6 };
    const move = chooseChessExpertMove(state, {
      ...strength,
      style: style ?? 'balanced',
      useBook: true,
    });
    const suggestion = move ? buildChessGuidance(state, move) : null;
    self.postMessage({
      requestId,
      matchId,
      ply: state.ply,
      suggestion,
    });
  } catch {
    self.postMessage({ requestId, matchId, ply: state.ply, error: 'guidance-error' });
  }
};
