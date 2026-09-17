import type { AIOptions } from '../../core/src/ai.ts';
import type { Difficulty } from '../../core/src/game.ts';
import { dominoOpenEnds, legalDominoMoves } from './rules.ts';
import { dominoTile, type DominoesMove, type DominoesState } from './state.ts';

function playScore(state: DominoesState, move: Extract<DominoesMove, { type: 'play' }>, hard: boolean) {
  const tile = dominoTile(move.tileId);
  let score = (tile.a + tile.b) * 12 + (tile.a === tile.b ? 10 : 0);
  if (!hard) return score;

  const hand = state.hands[state.turn].filter((id) => id !== move.tileId);
  const ends = dominoOpenEnds(state);
  let nextLeft = tile.a,
    nextRight = tile.b;
  if (ends) {
    if (move.side === 'left') {
      nextRight = ends[1];
      nextLeft = tile.b === ends[0] ? tile.a : tile.b;
    } else {
      nextLeft = ends[0];
      nextRight = tile.a === ends[1] ? tile.b : tile.a;
    }
  }

  let mobility = 0,
    endCoverage = 0;
  for (const id of hand) {
    const candidate = dominoTile(id);
    if (candidate.a === nextLeft || candidate.b === nextLeft) {
      mobility++;
      endCoverage++;
    }
    if (candidate.a === nextRight || candidate.b === nextRight) {
      mobility++;
      endCoverage++;
    }
  }
  score += mobility * 7 + endCoverage * 3 - hand.length;
  return score;
}

/**
 * Chooses from the same projected observation the player is allowed to see.
 * It never requires opponent tile IDs, boneyard order or the authoritative seed.
 */
export function chooseDominoMove(
  state: DominoesState,
  difficulty: Difficulty,
  options: AIOptions = {},
): DominoesMove | null {
  const moves = legalDominoMoves(state);
  if (!moves.length) return null;
  const random = options.random ?? Math.random;
  if (moves.length === 1) return moves[0];
  if (difficulty === 'easy') return moves[Math.min(moves.length - 1, Math.floor(random() * moves.length))];

  const scored = moves.map((move, index) => ({
    move,
    index,
    score: move.type === 'play' ? playScore(state, move, difficulty === 'hard') : -100000,
  }));
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored[0].move;
}
