import { games } from '../../../packages/games/registry.ts';
import { chooseMove } from '../../../packages/core/src/ai.ts';
import type { BaseState, Difficulty } from '../../../packages/core/src/game.ts';
import { chooseChessExpertMove } from '../../../packages/games/chess/expert.ts';
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
  }>,
) => {
  try {
    const { state, difficulty, requestId } = event.data;
    self.postMessage({
      requestId,
      move:
        state.gameId === 'chess'
          ? chooseChessExpertMove(state as ChessState)
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
