import { chooseMove, type AIOptions } from '../../core/src/ai.ts';
import { asPlugin, type Difficulty } from '../../core/src/game.ts';
import { abaloneEngine } from './rules.ts';
import type { AbaloneMove, AbaloneState } from './state.ts';
export const abaloneAI = (state: AbaloneState, difficulty: Difficulty, options?: AIOptions) =>
  chooseMove(asPlugin(abaloneEngine), state, difficulty, options) as AbaloneMove | null;
