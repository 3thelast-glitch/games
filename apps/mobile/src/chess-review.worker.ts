import { reviewChessMove } from '../../../packages/games/chess/expert.ts';
import type { ChessMove, ChessState } from '../../../packages/games/chess/state.ts';

type ChessReviewJob = {
  state: ChessState;
  move: ChessMove;
};

type ChessReviewMessage =
  | {
      requestId: string;
      state: ChessState;
      move: ChessMove;
    }
  | {
      requestId: string;
      batch: ChessReviewJob[];
    };

self.onmessage = (event: MessageEvent<ChessReviewMessage>) => {
  try {
    if ('batch' in event.data) {
      const reviews = event.data.batch
        .map((job) =>
          reviewChessMove(job.state, job.move, {
            budgetMs: 220,
            maxDepth: 3,
          }),
        )
        .filter(Boolean);
      self.postMessage({ requestId: event.data.requestId, reviews });
      return;
    }

    const review = reviewChessMove(event.data.state, event.data.move, {
      budgetMs: 450,
      maxDepth: 4,
    });
    self.postMessage({ requestId: event.data.requestId, review });
  } catch {
    self.postMessage({ requestId: event.data.requestId, error: 'chess-review-error' });
  }
};
