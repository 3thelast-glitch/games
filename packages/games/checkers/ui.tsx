import { useEffect, useState } from 'react';
import { isGameOver } from '../../core/src/game.ts';
import { Disc, type BoardProps } from '../shared/ui.tsx';
import { checkersLegalMoves } from './rules.ts';
import type { CheckersState, CheckersMove } from './state.ts';
export function CheckersBoard({
  state,
  disabled,
  onMove,
  t,
}: BoardProps<CheckersState, CheckersMove>) {
  const [selection, setSelection] = useState<number | null>(null);
  useEffect(() => setSelection(null), [state]);
  const selected = state.forcedFrom ?? selection,
    moves = checkersLegalMoves(state),
    locked = disabled || isGameOver(state);
  const targets = moves.filter((m) => m.from === selected).map((m) => m.to);
  const captureRequired = moves.some(
    (m) => Math.abs(Math.floor(m.from / 8) - Math.floor(m.to / 8)) === 2,
  );
  return (
    <div className="classic-game checkers-game">
      <p className="board-hint" role="status">
        {t(
          state.forcedFrom !== null
            ? 'continueCapture'
            : captureRequired
              ? 'captureRequired'
              : 'checkersHint',
        )}
      </p>
      <div className="classic-board checkers-board" dir="ltr" aria-label={t('checkers')}>
        {state.board.map((piece, i) => {
          const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
          const target = targets.includes(i),
            selectable = moves.some((m) => m.from === i);
          const label = `${t(piece ? (piece.owner === 0 ? 'player1' : 'player2') : 'emptyCell')}${piece?.king ? ` ${t('king')}` : ''} ${Math.floor(i / 8) + 1},${(i % 8) + 1}`;
          return (
            <button
              key={i}
              className={`board-cell ${dark ? 'dark-square' : 'light-square'} ${selected === i ? 'selected-cell' : ''} ${target ? 'legal-cell' : ''} ${state.lastMove?.to === i ? 'last-cell' : ''}`}
              aria-label={label}
              aria-pressed={selected === i}
              disabled={locked || (!selectable && !target)}
              onClick={() =>
                target && selected !== null
                  ? onMove({ from: selected, to: i })
                  : setSelection(selected === i ? null : i)
              }
            >
              {piece && <Disc owner={piece.owner} king={piece.king} />}
              {target && <span className="target-dot" />}
            </button>
          );
        })}
      </div>
      <button
        className="button secondary board-clear"
        disabled={locked || selection === null || state.forcedFrom !== null}
        onClick={() => setSelection(null)}
      >
        {t('clear')}
      </button>
    </div>
  );
}
