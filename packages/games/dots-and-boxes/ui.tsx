import { isGameOver } from '../../core/src/game.ts';
import type { BoardProps } from '../shared/ui.tsx';
import {
  horizontalEdgeIndex,
  verticalEdgeIndex,
  type DotsAndBoxesMove,
  type DotsAndBoxesState,
} from './state.ts';

function isRecentBox(state: DotsAndBoxesState, index: number) {
  if (!state.lastMove || state.boxes[index] === null) return false;
  const row = Math.floor(index / state.boxCols);
  const col = index % state.boxCols;
  const move = state.lastMove;
  if (move.orientation === 'h')
    return move.col === col && (move.row === row || move.row === row + 1);
  return move.row === row && (move.col === col || move.col === col + 1);
}

export function DotsAndBoxesBoard({
  state,
  disabled,
  onMove,
  t,
}: BoardProps<DotsAndBoxesState, DotsAndBoxesMove>) {
  const locked = disabled || isGameOver(state);
  const xStep = 100 / state.boxCols;
  const yStep = 100 / state.boxRows;

  return (
    <div className="classic-game dots-boxes-game">
      <p className="board-hint" id="dots-board-hint">{t('dotsAndBoxesHint')}</p>
      <div className="dots-scoreline" aria-label={t('dotsAndBoxesScore')}>
        <span className={state.turn === 0 && !isGameOver(state) ? 'active' : ''}>
          <i className="dots-player-mark player-0" aria-hidden="true" />
          {t('player1')}: <strong>{state.scores[0]}</strong>
        </span>
        <span className={state.turn === 1 && !isGameOver(state) ? 'active' : ''}>
          <i className="dots-player-mark player-1" aria-hidden="true" />
          {t('player2')}: <strong>{state.scores[1]}</strong>
        </span>
      </div>
      <div className="dots-board-shell">
        <div
          className="dots-board"
          dir="ltr"
          role="grid"
          aria-label={t('dotsAndBoxes')}
          aria-describedby="dots-board-hint"
        >
          {state.boxes.map((owner, index) => {
            const row = Math.floor(index / state.boxCols);
            const col = index % state.boxCols;
            const recent = isRecentBox(state, index);
            return (
              <span
                key={`box-${index}`}
                className={`dots-box ${owner === null ? '' : `box-owner-${owner}`} ${recent ? 'recent-box' : ''}`}
                style={{
                  left: `${col * xStep}%`,
                  top: `${row * yStep}%`,
                  width: `${xStep}%`,
                  height: `${yStep}%`,
                }}
                aria-hidden="true"
              >
                {owner !== null && <span>{owner + 1}</span>}
              </span>
            );
          })}

          {Array.from({ length: (state.boxRows + 1) * state.boxCols }, (_, index) => {
            const row = Math.floor(index / state.boxCols);
            const col = index % state.boxCols;
            const owner = state.horizontalEdges[horizontalEdgeIndex(state, row, col)];
            const last =
              state.lastMove?.orientation === 'h' &&
              state.lastMove.row === row &&
              state.lastMove.col === col;
            return (
              <button
                key={`h-${row}-${col}`}
                type="button"
                className={`dots-edge horizontal ${owner === null ? 'available' : `edge-owner-${owner}`} ${last ? 'last-edge' : ''}`}
                style={{
                  left: `calc(${col * xStep}% + 16px)`,
                  top: `${row * yStep}%`,
                  width: `calc(${xStep}% - 32px)`,
                }}
                disabled={locked || owner !== null}
                tabIndex={locked || owner !== null ? -1 : 0}
                aria-current={last ? 'true' : undefined}
                aria-label={
                  owner === null
                    ? `${t('drawHorizontalEdge')} ${row + 1},${col + 1}`
                    : `${t(owner === 0 ? 'player1' : 'player2')} · ${row + 1},${col + 1}`
                }
                onClick={() => onMove({ orientation: 'h', row, col })}
              />
            );
          })}

          {Array.from({ length: state.boxRows * (state.boxCols + 1) }, (_, index) => {
            const row = Math.floor(index / (state.boxCols + 1));
            const col = index % (state.boxCols + 1);
            const owner = state.verticalEdges[verticalEdgeIndex(state, row, col)];
            const last =
              state.lastMove?.orientation === 'v' &&
              state.lastMove.row === row &&
              state.lastMove.col === col;
            return (
              <button
                key={`v-${row}-${col}`}
                type="button"
                className={`dots-edge vertical ${owner === null ? 'available' : `edge-owner-${owner}`} ${last ? 'last-edge' : ''}`}
                style={{
                  left: `${col * xStep}%`,
                  top: `calc(${row * yStep}% + 16px)`,
                  height: `calc(${yStep}% - 32px)`,
                }}
                disabled={locked || owner !== null}
                tabIndex={locked || owner !== null ? -1 : 0}
                aria-current={last ? 'true' : undefined}
                aria-label={
                  owner === null
                    ? `${t('drawVerticalEdge')} ${row + 1},${col + 1}`
                    : `${t(owner === 0 ? 'player1' : 'player2')} · ${row + 1},${col + 1}`
                }
                onClick={() => onMove({ orientation: 'v', row, col })}
              />
            );
          })}

          {Array.from({ length: (state.boxRows + 1) * (state.boxCols + 1) }, (_, index) => {
            const row = Math.floor(index / (state.boxCols + 1));
            const col = index % (state.boxCols + 1);
            return (
              <span
                key={`dot-${row}-${col}`}
                className="dots-dot"
                style={{ left: `${col * xStep}%`, top: `${row * yStep}%` }}
                aria-hidden="true"
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
