import { chooseMove, type AIOptions } from '../../core/src/ai.ts';
import { asPlugin, type Difficulty } from '../../core/src/game.ts';
import { reversiEngine } from './rules.ts';
import type { ReversiMove, ReversiState } from './state.ts';

export const reversiAI = (state: ReversiState, difficulty: Difficulty, options?: AIOptions) =>
  chooseMove(asPlugin(reversiEngine), state, difficulty, options) as ReversiMove | null;
