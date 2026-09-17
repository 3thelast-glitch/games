import { isGameOver } from '../../core/src/game.ts';
import type { BoardProps } from '../shared/ui.tsx';
import {
  horizontalEdgeIndex,
  verticalEdgeIndex,
  type DotsAndBoxesMove,
  type DotsAndBoxesState,
} from './state.ts';

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
      <p className="board-hint">{t('dotsAndBoxesHint')}</p>
      <div className="dots-scoreline" aria-label={t('dotsAndBoxesScore')}>
        <span>
          {t('player1')}: <strong>{state.scores[0]}</strong>
        </span>
        <span>
          {t('player2')}: <strong>{state.scores[1]}</strong>
        </span>
      </div>
      <div className="dots-board-shell">
        <div className="dots-board" dir="ltr" role="grid" aria-label={t('dotsAndBoxes')}>
          {state.boxes.map((owner, index) => {
            const row = Math.floor(index / state.boxCols);
            const col = index % state.boxCols;
            return (
              <span
                key={`box-${index}`}
                className={`dots-box ${owner === null ? '' : `box-owner-${owner}`}`}
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
                className={`dots-edge horizontal ${owner === null ? '' : `edge-owner-${owner}`} ${last ? 'last-edge' : ''}`}
                style={{
                  left: `${col * xStep}%`,
                  top: `${row * yStep}%`,
                  width: `${xStep}%`,
                }}
                disabled={locked || owner !== null}
                aria-label={`${t('drawHorizontalEdge')} ${row + 1},${col + 1}`}
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
                className={`dots-edge vertical ${owner === null ? '' : `edge-owner-${owner}`} ${last ? 'last-edge' : ''}`}
                style={{
                  left: `${col * xStep}%`,
                  top: `${row * yStep}%`,
                  height: `${yStep}%`,
                }}
                disabled={locked || owner !== null}
                aria-label={`${t('drawVerticalEdge')} ${row + 1},${col + 1}`}
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
