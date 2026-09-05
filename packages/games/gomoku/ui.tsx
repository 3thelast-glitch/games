import { useEffect, useState } from 'react';
import { isGameOver } from '../../core/src/game.ts';
import { Disc, type BoardProps } from '../shared/ui.tsx';
import type { GomokuState, GomokuMove } from './state.ts';
export function GomokuBoard({ state, disabled, onMove, t }: BoardProps<GomokuState, GomokuMove>) {
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => setSelected(null), [state]);
  const locked = disabled || isGameOver(state);
  return (
    <div className="classic-game gomoku-game">
      <p className="board-hint">{t('gomokuHint')}</p>
      <div className="board-scroll" tabIndex={0} role="region" aria-label={t('gomoku')}>
        <div className="classic-board gomoku-board" dir="ltr">
          {state.board.map((owner, i) => (
            <button
              key={i}
              aria-label={`${t(owner === null ? 'placeStone' : owner === 0 ? 'player1' : 'player2')} ${Math.floor(i / 15) + 1},${(i % 15) + 1}`}
              disabled={locked || owner !== null}
              aria-pressed={selected === i}
              onClick={() => setSelected(i)}
              className={`board-cell intersection ${state.winningLine.includes(i) ? 'winning-cell' : ''} ${state.lastMove === i ? 'last-cell' : ''} ${selected === i ? 'selected-cell' : ''}`}
            >
              {owner !== null ? (
                <Disc owner={owner} />
              ) : selected === i ? (
                <span className="stone-preview">
                  <Disc owner={state.turn} />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
      <div className="stone-controls">
        <span role="status">
          {selected === null
            ? t('selectIntersection')
            : `${t('selectedPoint')} ${Math.floor(selected / 15) + 1},${(selected % 15) + 1}`}
        </span>
        <button
          className="button primary"
          disabled={locked || selected === null || state.board[selected] !== null}
          onClick={() => {
            if (selected !== null) onMove({ row: Math.floor(selected / 15), col: selected % 15 });
          }}
        >
          {t('confirmStone')}
        </button>
      </div>
    </div>
  );
}
