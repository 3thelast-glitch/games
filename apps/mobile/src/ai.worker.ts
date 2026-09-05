import { games } from '../../../packages/games/registry.ts';
import { chooseMove } from '../../../packages/core/src/ai.ts';
import type { BaseState, Difficulty } from '../../../packages/core/src/game.ts';
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
      move: chooseMove(games.get(state.gameId), state, difficulty),
    });
  } catch {
    self.postMessage({ requestId: event.data.requestId, error: 'ai-error' });
  }
};
