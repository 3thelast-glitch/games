import { chooseMove, type AIOptions } from '../../core/src/ai.ts';
import { asPlugin, type Difficulty } from '../../core/src/game.ts';
import { morrisEngine } from './rules.ts';
import type { MorrisState, MorrisMove } from './state.ts';
export const morrisAI = (state: MorrisState, difficulty: Difficulty, options?: AIOptions) =>
  chooseMove(asPlugin(morrisEngine), state, difficulty, options) as MorrisMove | null;
