import { type AIOptions } from '../../core/src/ai.ts';
import type { Difficulty } from '../../core/src/game.ts';
import type { ConnectFourState } from './state.ts';
import { chooseConnectFourExpertMove } from './expert.ts';

export const connectFourAI = (
  state: ConnectFourState,
  difficulty: Difficulty,
  options?: AIOptions,
) => chooseConnectFourExpertMove(state, difficulty, options);
