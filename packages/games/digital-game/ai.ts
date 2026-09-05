import { chooseMove, type AIOptions } from '../../core/src/ai.ts';
import { asPlugin, type Difficulty } from '../../core/src/game.ts';
import { digitalGameEngine } from './rules.ts';
import type { DigitalGameMove, DigitalGameState } from './state.ts';

export const digitalGameAI = (
  state: DigitalGameState,
  difficulty: Difficulty,
  options?: AIOptions,
) => chooseMove(asPlugin(digitalGameEngine), state, difficulty, options) as DigitalGameMove | null;
