import type { MatchResult } from '../../core/src/protocol.ts';
import type { ChessAiStyle } from './training.ts';
import type { ChessMoveJournal } from './journal.ts';

export interface ChessPgnMetadata {
  event?: string;
  site?: string;
  date: Date;
  round?: string;
  white: string;
  black: string;
  result?: MatchResult | null;
  termination?: string;
  timeControl?: string;
  opening?: string;
  eco?: string;
  mode?: string;
  botStyle?: ChessAiStyle;
}

const escapeTag = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
export function chessResultToken(result?: MatchResult | null): '1-0' | '0-1' | '1/2-1/2' | '*' {
  if (!result) return '*';
  if (result.winner === 0) return '1-0';
  if (result.winner === 1) return '0-1';
  return '1/2-1/2';
}
const formatDate = (date: Date) =>
  `${date.getUTCFullYear()}.${String(date.getUTCMonth() + 1).padStart(2, '0')}.${String(date.getUTCDate()).padStart(2, '0')}`;

export function exportChessPgn(journal: ChessMoveJournal, metadata: ChessPgnMetadata): string {
  const result = chessResultToken(metadata.result);
  const tags: [string, string][] = [
    ['Event', metadata.event ?? 'NAQLA Chess'],
    ['Site', metadata.site ?? 'Local device'],
    ['Date', formatDate(metadata.date)],
    ['Round', metadata.round ?? '-'],
    ['White', metadata.white],
    ['Black', metadata.black],
    ['Result', result],
  ];
  if (metadata.timeControl) tags.push(['TimeControl', metadata.timeControl]);
  if (metadata.termination) tags.push(['Termination', metadata.termination]);
  if (metadata.opening) tags.push(['Opening', metadata.opening]);
  if (metadata.eco) tags.push(['ECO', metadata.eco]);
  if (metadata.mode) tags.push(['NAQLAMode', metadata.mode]);
  if (metadata.botStyle) tags.push(['NAQLABotStyle', metadata.botStyle]);

  const standard = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  if (journal.initialFen !== standard) {
    tags.push(['SetUp', '1'], ['FEN', journal.initialFen]);
  }

  const moves: string[] = [];
  let moveNo = 1;
  for (const entry of journal.entries) {
    if (entry.player === 0) moves.push(`${moveNo}. ${entry.san}`);
    else {
      if (!moves.length || !moves[moves.length - 1].startsWith(`${moveNo}.`))
        moves.push(`${moveNo}... ${entry.san}`);
      else moves[moves.length - 1] += ` ${entry.san}`;
      moveNo++;
    }
  }
  moves.push(result);
  return tags.map(([key, value]) => `[${key} "${escapeTag(value)}"]`).join('\n') + '\n\n' + moves.join(' ') + '\n';
}
