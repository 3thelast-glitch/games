import { asPlugin, GameRegistry } from '../core/src/game.ts';
import { abaloneEngine } from './abalone/rules.ts';
import { quoridorEngine } from './quoridor/rules.ts';
export const games = new GameRegistry()
  .register(asPlugin(abaloneEngine))
  .register(asPlugin(quoridorEngine));
