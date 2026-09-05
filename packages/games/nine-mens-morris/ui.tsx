import { useEffect, useState } from 'react';
import { isGameOver } from '../../core/src/game.ts';
import { Disc, type BoardProps } from '../shared/ui.tsx';
import { morrisCount, morrisLegalMoves, inMill } from './rules.ts';
import { MORRIS_POINTS, MORRIS_EDGES, type MorrisState, type MorrisMove } from './state.ts';
export function MorrisBoard({ state, disabled, onMove, t }: BoardProps<MorrisState, MorrisMove>) {
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => setSelected(null), [state]);
  const locked = disabled || isGameOver(state),
    moves = morrisLegalMoves(state);
  const hint = state.capturing
    ? 'morrisCaptureHint'
    : state.remaining.some((n) => n > 0)
      ? 'morrisPlaceHint'
      : morrisCount(state, state.turn) === 3
        ? 'morrisFlyHint'
        : 'morrisMoveHint';
  return (
    <div className="classic-game morris-game">
      <p className="board-hint" role="status">
        {t(hint)}
      </p>
      <div className="morris-reserves">
        {t('reserve')}: {t('player1')} {state.remaining[0]} · {t('player2')} {state.remaining[1]}
      </div>
      <div className="morris-board" dir="ltr" aria-label={t('nineMensMorris')}>
        <svg viewBox="-0.5 -0.5 7 7" aria-hidden="true">
          {MORRIS_EDGES.map(([a, b], i) => (
            <line
              key={i}
              x1={MORRIS_POINTS[a][0]}
              y1={MORRIS_POINTS[a][1]}
              x2={MORRIS_POINTS[b][0]}
              y2={MORRIS_POINTS[b][1]}
            />
          ))}
        </svg>
        {MORRIS_POINTS.map(([x, y], i) => {
          const owner = state.board[i];
          const action = moves.find((m) =>
            m.kind === 'capture'
              ? m.at === i
              : m.to === i && (m.kind === 'place' || m.from === selected),
          );
          const selectable = moves.some((m) => m.kind === 'move' && m.from === i);
          return (
            <button
              key={i}
              className={`morris-point ${selected === i ? 'selected-cell' : ''} ${action ? 'legal-cell' : ''} ${inMill(state, i) ? 'mill-cell' : ''} ${state.capturing && action ? 'capture-cell' : ''}`}
              style={{ left: `${((x + 0.5) / 7) * 100}%`, top: `${((y + 0.5) / 7) * 100}%` }}
              aria-label={`${t(owner === null ? 'emptyCell' : owner === 0 ? 'player1' : 'player2')} ${i + 1}`}
              aria-pressed={selected === i}
              disabled={locked || (!action && !selectable)}
              onClick={() => (action ? onMove(action) : setSelected(selected === i ? null : i))}
            >
              {owner !== null ? (
                <Disc owner={owner} />
              ) : (
                <span className="morris-empty">{i + 1}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
