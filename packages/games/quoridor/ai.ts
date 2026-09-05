import { chooseMove, type AIOptions } from '../../core/src/ai.ts';
import { asPlugin, type Difficulty } from '../../core/src/game.ts';
import { quoridorEngine } from './rules.ts';
import type { QuoridorMove, QuoridorState } from './state.ts';
export const quoridorAI = (state: QuoridorState, difficulty: Difficulty, options?: AIOptions) =>
  chooseMove(asPlugin(quoridorEngine), state, difficulty, options) as QuoridorMove | null;
