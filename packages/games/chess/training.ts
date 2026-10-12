export type ChessAiStyle =
  | 'balanced'
  | 'aggressive'
  | 'tactical'
  | 'positional'
  | 'defensive'
  | 'gambit'
  | 'endgame';

export type ChessTrainingFocus =
  | 'opening'
  | 'development'
  | 'center'
  | 'kingSafety'
  | 'tactics'
  | 'endgame'
  | 'positional';

export interface ChessAiSessionConfig {
  style: ChessAiStyle;
  coach: boolean;
  focus: ChessTrainingFocus;
  minutes: 3 | 5 | 10 | 15 | null;
}

export const DEFAULT_CHESS_AI_SESSION: ChessAiSessionConfig = {
  style: 'balanced',
  coach: true,
  focus: 'development',
  minutes: 10,
};

export const CHESS_AI_STYLES: readonly ChessAiStyle[] = [
  'balanced',
  'aggressive',
  'tactical',
  'positional',
  'defensive',
  'gambit',
  'endgame',
] as const;

export const CHESS_TRAINING_FOCUS: readonly ChessTrainingFocus[] = [
  'opening',
  'development',
  'center',
  'kingSafety',
  'tactics',
  'endgame',
  'positional',
] as const;
