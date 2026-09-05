import { asPlugin, GameRegistry } from '../core/src/game.ts';
import { abaloneEngine } from './abalone/rules.ts';
import { quoridorEngine } from './quoridor/rules.ts';
import { checkersEngine } from './checkers/rules.ts';
import { gomokuEngine } from './gomoku/rules.ts';
import { connectFourEngine } from './connect-four/rules.ts';
import { morrisEngine } from './nine-mens-morris/rules.ts';
export const games = new GameRegistry()
  .register(asPlugin(abaloneEngine))
  .register(asPlugin(quoridorEngine))
  .register(asPlugin(checkersEngine))
  .register(asPlugin(gomokuEngine))
  .register(asPlugin(morrisEngine))
  .register(asPlugin(connectFourEngine));
