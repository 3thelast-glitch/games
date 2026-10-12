import { games } from '../../../packages/games/registry.ts';
import { chooseMove } from '../../../packages/core/src/ai.ts';
import type { BaseState, Difficulty } from '../../../packages/core/src/game.ts';
import { chooseChessExpertMove } from '../../../packages/games/chess/expert.ts';
import type { ChessBotStyle } from '../../../packages/games/chess/bot.ts';
import type { ChessState } from '../../../packages/games/chess/state.ts';
import { chooseDominoMove } from '../../../packages/games/dominoes/ai.ts';
import type { DominoesState } from '../../../packages/games/dominoes/state.ts';
import { chooseNavalMove } from '../../../packages/games/naval-battle/ai.ts';
import type { NavalBattleState } from '../../../packages/games/naval-battle/state.ts';

self.onmessage = (
  event: MessageEvent<{
    state: BaseState;
    difficulty: Difficulty;
    requestId: string;
    chessStyle?: ChessBotStyle;
  }>,
) => {
  try {
    const { state, difficulty, requestId, chessStyle } = event.data;
    const chessStrength =
      difficulty === 'easy'
        ? { budgetMs: 250, maxDepth: 3 }
        : difficulty === 'medium'
          ? { budgetMs: 1200, maxDepth: 5 }
          : { budgetMs: 5000, maxDepth: 7 };
    self.postMessage({
      requestId,
      move:
        state.gameId === 'chess'
          ? chooseChessExpertMove(state as ChessState, {
              ...chessStrength,
              style: chessStyle ?? 'balanced',
            })
          : state.gameId === 'dominoes'
            ? chooseDominoMove(state as DominoesState, difficulty)
            : state.gameId === 'navalBattle'
              ? chooseNavalMove(state as NavalBattleState, difficulty)
              : chooseMove(games.get(state.gameId), state, difficulty),
    });
  } catch {
    self.postMessage({ requestId: event.data.requestId, error: 'ai-error' });
  }
};
