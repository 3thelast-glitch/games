import { useEffect, useState, type CSSProperties } from 'react';
import {
  DIRECTIONS,
  HEXES,
  fromKey,
  hexKey,
  type Hex,
  type AbaloneState,
  type AbaloneMove,
} from './state.ts';
import { validateAbalone } from './rules.ts';
export interface AbaloneBoardProps {
  state: AbaloneState;
  disabled: boolean;
  onMove: (move: AbaloneMove) => void;
  t: (key: string) => string;
}
export const hexPosition = ([q, r]: Hex) => ({
  x: 240 + (q + r / 2) * 46,
  y: 222 + r * 39.837,
});
const directionLabels = ['→', '↘', '↙', '←', '↖', '↗'];
export function AbaloneBoard({ state, disabled, onMove, t }: AbaloneBoardProps) {
  const [selected, setSelected] = useState<Hex[]>([]);
  useEffect(() => {
    setSelected([]);
  }, [state.ply]);
  const select = (point: Hex) => {
    if (disabled || state.board[hexKey(point)]?.owner !== state.turn) return;
    setSelected((previous) =>
      previous.some((p) => hexKey(p) === hexKey(point))
        ? previous.filter((p) => hexKey(p) !== hexKey(point))
        : previous.length < 3
          ? [...previous, point]
          : [point],
    );
  };
  const position = (p: Hex): CSSProperties => {
    const { x, y } = hexPosition(p);
    return { left: `${(x / 480) * 100}%`, top: `${(y / 444) * 100}%` };
  };
  return (
    <div className="abalone-game">
      <div className="hex-board" dir="ltr" aria-label={t('abalone')}>
        <svg className="board-base" viewBox="0 0 480 444" aria-hidden="true">
          <defs>
            <linearGradient id="hexFrame" x2="1" y2="1">
              <stop stopColor="#343749" />
              <stop offset="1" stopColor="#191d29" />
            </linearGradient>
          </defs>
          <polygon
            points="131,16 349,16 466,222 349,428 131,428 14,222"
            fill="url(#hexFrame)"
            stroke="#54546d"
            strokeWidth="1"
          />
          <polygon
            points="135,27 345,27 454,222 345,417 135,417 26,222"
            fill="#141822"
            stroke="#282d3b"
          />
          {HEXES.map((p) => {
            const { x, y } = hexPosition(p);
            return (
              <circle
                key={hexKey(p)}
                cx={x}
                cy={y}
                r="19.5"
                fill="#080c13"
                stroke="#282e3d"
                strokeWidth="1.5"
              />
            );
          })}
        </svg>
        {Object.entries(state.board).map(([key, marble]) => {
          const p = fromKey(key),
            index = selected.findIndex((s) => hexKey(s) === key);
          return (
            <button
              key={marble.id}
              className={`marble ${marble.owner === 0 ? 'black' : 'white'} ${index >= 0 ? 'selected' : ''}`}
              style={position(p)}
              disabled={disabled || marble.owner !== state.turn}
              onClick={() => select(p)}
              aria-label={`${t(marble.owner === 0 ? 'player1' : 'player2')} ${key}`}
              aria-pressed={index >= 0}
            >
              {index >= 0 && <span>{index + 1}</span>}
            </button>
          );
        })}
        {state.lastMove
          .filter((m) => m.ejected)
          .map((m) => {
            const from = hexPosition(m.from),
              to = hexPosition(m.to);
            // Percentages refer to the marble size, so the fall scales with the board.
            const fall = {
              ...position(m.from),
              '--fall-x': `${((to.x - from.x) / (480 * 0.0745)) * 155}%`,
              '--fall-y': `${((to.y - from.y) / (480 * 0.0745)) * 155}%`,
            } as CSSProperties;
            return (
              <div
                key={`${state.ply}-${m.marble.id}`}
                className={`marble ${m.marble.owner === 0 ? 'black' : 'white'} ejected`}
                style={fall}
                aria-hidden="true"
              />
            );
          })}
      </div>
      <p className="board-hint">{t(selected.length ? 'chooseDirection' : 'selectMarbles')}</p>
      <div className="abalone-controls">
        <button className="text-button" onClick={() => setSelected([])} disabled={!selected.length}>
          {t('clear')}
        </button>
        <div className="direction-pad" dir="ltr">
          {DIRECTIONS.map((_, direction) => (
            <button
              key={direction}
              style={{
                gridArea: ['2 / 3', '3 / 3', '3 / 1', '2 / 1', '1 / 1', '1 / 3'][direction],
              }}
              className="direction"
              aria-label={`${t('turn')} ${directionLabels[direction]}`}
              disabled={
                disabled ||
                !selected.length ||
                !validateAbalone(state, { marbles: selected, direction }).ok
              }
              onClick={() => onMove({ marbles: selected, direction })}
            >
              {directionLabels[direction]}
            </button>
          ))}
          <span className="direction-center">{selected.length}/3</span>
        </div>
      </div>
    </div>
  );
}
