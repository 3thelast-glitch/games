import { chooseMove, type AIOptions } from '../../core/src/ai.ts';
import { asPlugin, type Difficulty } from '../../core/src/game.ts';
import { connectFourEngine } from './rules.ts';
import type { ConnectFourState, ConnectFourMove } from './state.ts';
export const connectFourAI = (
  state: ConnectFourState,
  difficulty: Difficulty,
  options?: AIOptions,
) => chooseMove(asPlugin(connectFourEngine), state, difficulty, options) as ConnectFourMove | null;
