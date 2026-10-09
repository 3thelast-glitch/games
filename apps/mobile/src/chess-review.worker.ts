import { reviewChessMove } from '../../../packages/games/chess/expert.ts';
import type { ChessMove, ChessState } from '../../../packages/games/chess/state.ts';

self.onmessage = (
  event: MessageEvent<{
    requestId: string;
    state: ChessState;
    move: ChessMove;
  }>,
) => {
  try {
    const review = reviewChessMove(event.data.state, event.data.move, {
      budgetMs: 450,
      maxDepth: 4,
    });
    self.postMessage({ requestId: event.data.requestId, review });
  } catch {
    self.postMessage({ requestId: event.data.requestId, error: 'chess-review-error' });
  }
};
