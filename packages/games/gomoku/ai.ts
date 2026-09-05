import { chooseMove, type AIOptions } from '../../core/src/ai.ts';
import { asPlugin, type Difficulty } from '../../core/src/game.ts';
import { gomokuEngine } from './rules.ts';
import type { GomokuState, GomokuMove } from './state.ts';
export const gomokuAI = (state: GomokuState, difficulty: Difficulty, options?: AIOptions) =>
  chooseMove(asPlugin(gomokuEngine), state, difficulty, options) as GomokuMove | null;
