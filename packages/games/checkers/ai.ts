import { chooseMove, type AIOptions } from '../../core/src/ai.ts';
import { asPlugin, type Difficulty } from '../../core/src/game.ts';
import { checkersEngine } from './rules.ts';
import type { CheckersState, CheckersMove } from './state.ts';
export const checkersAI = (state: CheckersState, difficulty: Difficulty, options?: AIOptions) =>
  chooseMove(asPlugin(checkersEngine), state, difficulty, options) as CheckersMove | null;
