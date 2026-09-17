import { chooseMove, type AIOptions } from '../../core/src/ai.ts';
import { asPlugin, type Difficulty } from '../../core/src/game.ts';
import { dotsAndBoxesEngine } from './rules.ts';
import type { DotsAndBoxesMove, DotsAndBoxesState } from './state.ts';

export const dotsAndBoxesAI = (
  state: DotsAndBoxesState,
  difficulty: Difficulty,
  options?: AIOptions,
) =>
  chooseMove(asPlugin(dotsAndBoxesEngine), state, difficulty, options) as DotsAndBoxesMove | null;
