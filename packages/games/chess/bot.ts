export type ChessBotStyle =
  | 'balanced'
  | 'tactical'
  | 'aggressive'
  | 'positional'
  | 'defensive'
  | 'gambit'
  | 'endgame';

export type ChessCoachFocus =
  | 'off'
  | 'opening'
  | 'tactics'
  | 'positional'
  | 'kingSafety'
  | 'endgame';

export interface ChessAiConfig {
  minutes: 3 | 5 | 10 | 15 | 30;
  style: ChessBotStyle;
  coach: ChessCoachFocus;
}

export const DEFAULT_CHESS_AI_CONFIG: ChessAiConfig = {
  minutes: 10,
  style: 'balanced',
  coach: 'off',
};

export const CHESS_BOT_STYLES: readonly ChessBotStyle[] = [
  'balanced',
  'tactical',
  'aggressive',
  'positional',
  'defensive',
  'gambit',
  'endgame',
] as const;

export const CHESS_COACH_FOCUS: readonly ChessCoachFocus[] = [
  'off',
  'opening',
  'tactics',
  'positional',
  'kingSafety',
  'endgame',
] as const;
