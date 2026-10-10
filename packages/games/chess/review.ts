import type { Player } from '../../core/src/game.ts';
import type { ChessMove } from './state.ts';

export type ChessMoveGrade =
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder';

export type ChessStrategicMetric =
  | 'material'
  | 'kingSafety'
  | 'centerControl'
  | 'development'
  | 'pieceActivity'
  | 'pawnStructure'
  | 'space'
  | 'initiative'
  | 'passedPawns'
  | 'endgame';

export type ChessStrategicScores = Record<ChessStrategicMetric, number>;

export interface ChessStrategicSnapshot {
  white: ChessStrategicScores;
  black: ChessStrategicScores;
}

export interface ChessEvaluation {
  /** Centipawns from White's perspective. Positive favors White. */
  centipawns: number;
  /** 0 means checkmate on the board. Positive favors White, negative favors Black. */
  mate: number | null;
  /** UI-friendly share for the evaluation bar. */
  whitePercent: number;
}

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
  evaluationBefore?: ChessEvaluation;
  evaluationAfter?: ChessEvaluation;
  strategicAfter?: ChessStrategicSnapshot;
}

export interface ChessPlayerReviewSummary {
  player: Player;
  moves: number;
  accuracy: number;
  averageCentipawnLoss: number;
  grades: Record<ChessMoveGrade, number>;
  biggestMistake: ChessMoveReview | null;
  bestMove: ChessMoveReview | null;
}

export interface ChessGameReviewSummary {
  players: [ChessPlayerReviewSummary, ChessPlayerReviewSummary];
  quality: number;
  totalMoves: number;
  turningPoint: ChessMoveReview | null;
  finalEvaluation: ChessEvaluation | null;
  finalStrategic: ChessStrategicSnapshot | null;
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

export function chessEvaluationWhitePercent(centipawns: number, mate: number | null = null): number {
  if (mate !== null) return mate > 0 ? 100 : mate < 0 ? 0 : centipawns >= 0 ? 100 : 0;
  const bounded = Math.max(-2400, Math.min(2400, centipawns));
  return Math.round(10000 / (1 + Math.exp(-bounded / 320))) / 100;
}

export function formatChessEvaluation(evaluation: ChessEvaluation | null | undefined): string {
  if (!evaluation) return '0.0';
  if (evaluation.mate !== null) {
    if (evaluation.mate === 0) return evaluation.centipawns >= 0 ? 'M' : '-M';
    return evaluation.mate > 0 ? `M${evaluation.mate}` : `-M${Math.abs(evaluation.mate)}`;
  }
  const pawns = evaluation.centipawns / 100;
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`;
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
    const biggestMistake =
      [...playerReviews].sort((a, b) => b.centipawnLoss - a.centipawnLoss)[0] ?? null;
    const bestMove =
      [...playerReviews].sort(
        (a, b) => b.accuracy - a.accuracy || a.centipawnLoss - b.centipawnLoss || a.ply - b.ply,
      )[0] ?? null;
    return {
      player,
      moves,
      accuracy,
      averageCentipawnLoss,
      grades,
      biggestMistake,
      bestMove,
    };
  }) as [ChessPlayerReviewSummary, ChessPlayerReviewSummary];

  const active = players.filter((player) => player.moves > 0);
  const quality = active.length
    ? Math.round(active.reduce((sum, player) => sum + player.accuracy, 0) / active.length)
    : 0;
  const turningPoint =
    [...reviews].sort((a, b) => b.centipawnLoss - a.centipawnLoss || a.ply - b.ply)[0] ?? null;
  const last = reviews[reviews.length - 1] ?? null;

  return {
    players,
    quality,
    totalMoves: reviews.length,
    turningPoint,
    finalEvaluation: last?.evaluationAfter ?? null,
    finalStrategic: last?.strategicAfter ?? null,
  };
}
