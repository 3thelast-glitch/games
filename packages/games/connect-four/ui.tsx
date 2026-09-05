import { isGameOver } from '../../core/src/game.ts';
import { Disc, type BoardProps } from '../shared/ui.tsx';
import type { ConnectFourState, ConnectFourMove } from './state.ts';
export function ConnectFourBoard({
  state,
  disabled,
  onMove,
  t,
}: BoardProps<ConnectFourState, ConnectFourMove>) {
  const locked = disabled || isGameOver(state);
  return (
    <div className="classic-game connect-four-game">
      <p className="board-hint">{t('connectFourHint')}</p>
      <div className="connect-columns" dir="ltr" aria-label={t('connectFour')}>
        {Array.from({ length: 7 }, (_, column) => (
          <button
            key={column}
            className="connect-column"
            aria-label={`${t('dropColumn')} ${column + 1}`}
            disabled={locked || state.board[column] !== null}
            onClick={() => onMove({ column })}
          >
            <span className="column-arrow" aria-hidden="true">
              ↓ {column + 1}
            </span>
            {Array.from({ length: 6 }, (_, row) => {
              const at = row * 7 + column,
                owner = state.board[at];
              return (
                <span
                  key={row}
                  className={`connect-slot ${state.winningLine.includes(at) ? 'winning-cell' : ''} ${state.lastMove === at ? 'last-cell' : ''}`}
                >
                  {owner !== null && <Disc owner={owner} />}
                  <span className="sr-only">{`${row + 1},${column + 1}: ${t(owner === null ? 'emptyCell' : owner === 0 ? 'player1' : 'player2')}`}</span>
                </span>
              );
            })}
          </button>
        ))}
      </div>
    </div>
  );
}
