import { isGameOver } from '../../core/src/game.ts';
import type { BoardProps } from '../shared/ui.tsx';
import { REVERSI_SIZE, type ReversiMove, type ReversiState } from './state.ts';
import { getReversiLegalMoves } from './rules.ts';

export function ReversiBoard({ state, disabled, onMove, t }: BoardProps<ReversiState, ReversiMove>) {
  const locked = disabled || isGameOver(state);
  const legalMoves = getReversiLegalMoves(state.board, state.turn);
  const legal = new Set(legalMoves.map(({ row, col }) => row * REVERSI_SIZE + col));
  const flipped = new Set(state.lastFlipped);

  return (
    <div className="classic-game reversi-game">
      <div className="reversi-score" aria-label={t('reversiScore')}>
        <span className={state.turn === 0 && !isGameOver(state) ? 'active' : ''}>
          <i className="reversi-score-disc disc-0" aria-hidden="true" />
          <strong>{t('reversiBlack')}</strong>
          <b>{state.scores[0]}</b>
        </span>
        <span className={state.turn === 1 && !isGameOver(state) ? 'active' : ''}>
          <i className="reversi-score-disc disc-1" aria-hidden="true" />
          <strong>{t('reversiWhite')}</strong>
          <b>{state.scores[1]}</b>
        </span>
      </div>

      <p className="board-hint" role="status" aria-live="polite">
        {state.lastPass !== null
          ? `${t(state.lastPass === 0 ? 'reversiBlack' : 'reversiWhite')} ${t('reversiPassed')}`
          : t('reversiHint')}
      </p>

      <div
        className="reversi-board"
        dir="ltr"
        role="grid"
        aria-rowcount={REVERSI_SIZE}
        aria-colcount={REVERSI_SIZE}
        aria-label={t('reversi')}
      >
        {state.board.map((owner, at) => {
          const row = Math.floor(at / REVERSI_SIZE);
          const col = at % REVERSI_SIZE;
          const isLegal = legal.has(at);
          const label =
            owner === 0
              ? t('reversiBlack')
              : owner === 1
                ? t('reversiWhite')
                : isLegal
                  ? t('reversiLegalMove')
                  : t('emptyCell');
          return (
            <button
              key={at}
              className={`reversi-cell ${state.lastMove === at ? 'last-cell' : ''}`}
              disabled={locked || !isLegal}
              aria-label={`${label} ${row + 1},${col + 1}`}
              data-row={row}
              data-col={col}
              onClick={() => onMove({ row, col })}
            >
              {owner !== null ? (
                <span
                  aria-hidden="true"
                  className={`reversi-disc disc-${owner} ${flipped.has(at) ? 'flipped' : ''}`}
                />
              ) : isLegal ? (
                <span className="reversi-legal-dot" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
