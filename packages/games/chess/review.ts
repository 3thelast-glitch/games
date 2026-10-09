import type { Player } from '../../core/src/game.ts';
import type { ChessMove } from './state.ts';

export type ChessMoveGrade =
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder';

export interface ChessMoveReview {
  player: Player;
  ply: number;
  move: ChessMove;
  notation: string;
  grade: ChessMoveGrade;
  accuracy: number;
  centipawnLoss: number;
  bestMove: ChessMove | null;
  bestNotation: string | null;
}

export interface ChessPlayerReviewSummary {
  player: Player;
  moves: number;
  accuracy: number;
  averageCentipawnLoss: number;
  grades: Record<ChessMoveGrade, number>;
}

export interface ChessGameReviewSummary {
  players: [ChessPlayerReviewSummary, ChessPlayerReviewSummary];
  quality: number;
  totalMoves: number;
}

const files = 'abcdefgh';

export function chessSquareName(index: number): string {
  const row = Math.floor(index / 8);
  const col = index % 8;
  return `${files[col] ?? '?'}${8 - row}`;
}

export function chessMoveNotation(move: ChessMove): string {
  const promotion = move.promotion
    ? `=${move.promotion === 'knight' ? 'N' : move.promotion[0].toUpperCase()}`
    : '';
  return `${chessSquareName(move.from)}–${chessSquareName(move.to)}${promotion}`;
}

export function chessMoveGrade(loss: number, isBestMove = false): ChessMoveGrade {
  if (isBestMove || loss <= 10) return 'best';
  if (loss <= 30) return 'excellent';
  if (loss <= 70) return 'good';
  if (loss <= 140) return 'inaccuracy';
  if (loss <= 300) return 'mistake';
  return 'blunder';
}

export function chessMoveAccuracy(loss: number, isBestMove = false): number {
  if (isBestMove || loss <= 0) return 100;
  const accuracy = 100 * Math.exp(-Math.max(0, loss) / 180);
  return Math.max(0, Math.min(100, Math.round(accuracy)));
}

const emptyGrades = (): Record<ChessMoveGrade, number> => ({
  best: 0,
  excellent: 0,
  good: 0,
  inaccuracy: 0,
  mistake: 0,
  blunder: 0,
});

export function summarizeChessReviews(reviews: readonly ChessMoveReview[]): ChessGameReviewSummary {
  const players = ([0, 1] as const).map((player) => {
    const playerReviews = reviews.filter((review) => review.player === player);
    const grades = emptyGrades();
    for (const review of playerReviews) grades[review.grade]++;
    const moves = playerReviews.length;
    const accuracy = moves
      ? Math.round(playerReviews.reduce((sum, review) => sum + review.accuracy, 0) / moves)
      : 0;
    const averageCentipawnLoss = moves
      ? Math.round(
          playerReviews.reduce((sum, review) => sum + review.centipawnLoss, 0) / moves,
        )
      : 0;
    return {
      player,
      moves,
      accuracy,
      averageCentipawnLoss,
      grades,
    };
  }) as [ChessPlayerReviewSummary, ChessPlayerReviewSummary];

  const active = players.filter((player) => player.moves > 0);
  const quality = active.length
    ? Math.round(active.reduce((sum, player) => sum + player.accuracy, 0) / active.length)
    : 0;

  return {
    players,
    quality,
    totalMoves: reviews.length,
  };
}
