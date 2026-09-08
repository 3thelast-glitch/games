import { useEffect, useState } from 'react';
import { isGameOver } from '../../core/src/game.ts';
import type { BoardProps } from '../shared/ui.tsx';
import { REVERSI_SIZE, type ReversiMove, type ReversiState } from './state.ts';
import { getReversiLegalMoves } from './rules.ts';

type AnimationSpeed = 'fast' | 'normal' | 'slow';

interface ReversiVisualSettings {
  showLegalMoves: boolean;
  movePreview: boolean;
  animationSpeed: AnimationSpeed;
  boardCoordinates: boolean;
}

const STORAGE_KEY = 'board-arena:reversi-visual-settings';
const DEFAULT_VISUAL_SETTINGS: ReversiVisualSettings = {
  showLegalMoves: true,
  movePreview: true,
  animationSpeed: 'normal',
  boardCoordinates: false,
};

function readVisualSettings(): ReversiVisualSettings {
  if (typeof window === 'undefined') return DEFAULT_VISUAL_SETTINGS;
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<ReversiVisualSettings> | null;
    if (!saved) return DEFAULT_VISUAL_SETTINGS;
    return {
      showLegalMoves: typeof saved.showLegalMoves === 'boolean' ? saved.showLegalMoves : true,
      movePreview: typeof saved.movePreview === 'boolean' ? saved.movePreview : true,
      animationSpeed: ['fast', 'normal', 'slow'].includes(String(saved.animationSpeed))
        ? (saved.animationSpeed as AnimationSpeed)
        : 'normal',
      boardCoordinates: typeof saved.boardCoordinates === 'boolean' ? saved.boardCoordinates : false,
    };
  } catch {
    return DEFAULT_VISUAL_SETTINGS;
  }
}

export function ReversiBoard({ state, disabled, onMove, t }: BoardProps<ReversiState, ReversiMove>) {
  const locked = disabled || isGameOver(state);
  const legalMoves = getReversiLegalMoves(state.board, state.turn);
  const legal = new Set(legalMoves.map(({ row, col }) => row * REVERSI_SIZE + col));
  const flipped = new Set(state.lastFlipped);
  const [visual, setVisual] = useState<ReversiVisualSettings>(readVisualSettings);
  const arabic = typeof document !== 'undefined' && document.documentElement.lang === 'ar';
  const labels = arabic
    ? {
        title: 'إعدادات اللوحة',
        legal: 'إظهار الحركات القانونية',
        preview: 'معاينة الحركة',
        animation: 'سرعة الحركة',
        coordinates: 'إحداثيات اللوحة',
        fast: 'سريعة',
        normal: 'عادية',
        slow: 'بطيئة',
      }
    : {
        title: 'Board settings',
        legal: 'Show legal moves',
        preview: 'Move preview',
        animation: 'Animation speed',
        coordinates: 'Board coordinates',
        fast: 'Fast',
        normal: 'Normal',
        slow: 'Slow',
      };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visual));
    } catch {}
  }, [visual]);

  const updateVisual = (patch: Partial<ReversiVisualSettings>) =>
    setVisual((current) => ({ ...current, ...patch }));

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

      <details className="reversi-preferences">
        <summary>{labels.title}</summary>
        <div className="reversi-preferences-grid">
          <label>
            <span>{labels.legal}</span>
            <input
              type="checkbox"
              role="switch"
              data-reversi-setting="show-legal-moves"
              checked={visual.showLegalMoves}
              onChange={(event) => updateVisual({ showLegalMoves: event.target.checked })}
            />
          </label>
          <label>
            <span>{labels.preview}</span>
            <input
              type="checkbox"
              role="switch"
              data-reversi-setting="move-preview"
              checked={visual.movePreview}
              onChange={(event) => updateVisual({ movePreview: event.target.checked })}
            />
          </label>
          <label>
            <span>{labels.coordinates}</span>
            <input
              type="checkbox"
              role="switch"
              data-reversi-setting="board-coordinates"
              checked={visual.boardCoordinates}
              onChange={(event) => updateVisual({ boardCoordinates: event.target.checked })}
            />
          </label>
          <div className="reversi-speed-setting">
            <span>{labels.animation}</span>
            <div className="reversi-speed-buttons" role="group" aria-label={labels.animation}>
              {(['fast', 'normal', 'slow'] as AnimationSpeed[]).map((speed) => (
                <button
                  type="button"
                  key={speed}
                  data-reversi-speed={speed}
                  aria-pressed={visual.animationSpeed === speed}
                  onClick={() => updateVisual({ animationSpeed: speed })}
                >
                  {labels[speed]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </details>

      <p className="board-hint" role="status" aria-live="polite">
        {state.lastPass !== null
          ? `${t(state.lastPass === 0 ? 'reversiBlack' : 'reversiWhite')} ${t('reversiPassed')}`
          : t('reversiHint')}
      </p>

      <div
        className={`reversi-board animation-${visual.animationSpeed} ${visual.movePreview ? 'show-preview' : ''}`}
        dir="ltr"
        role="grid"
        aria-rowcount={REVERSI_SIZE}
        aria-colcount={REVERSI_SIZE}
        aria-label={t('reversi')}
        data-show-legal-moves={String(visual.showLegalMoves)}
        data-move-preview={String(visual.movePreview)}
        data-animation-speed={visual.animationSpeed}
        data-board-coordinates={String(visual.boardCoordinates)}
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
              aria-label={`${label} ${String.fromCharCode(65 + col)}${row + 1}`}
              data-row={row}
              data-col={col}
              data-legal={String(isLegal)}
              onClick={() => onMove({ row, col })}
            >
              {visual.boardCoordinates && row === 0 && (
                <span className="reversi-coordinate reversi-file" aria-hidden="true">
                  {String.fromCharCode(65 + col)}
                </span>
              )}
              {visual.boardCoordinates && col === 0 && (
                <span className="reversi-coordinate reversi-rank" aria-hidden="true">
                  {row + 1}
                </span>
              )}
              {owner !== null ? (
                <span
                  aria-hidden="true"
                  className={`reversi-disc disc-${owner} ${flipped.has(at) ? 'flipped' : ''}`}
                />
              ) : isLegal ? (
                <>
                  {visual.movePreview && (
                    <span
                      className={`reversi-preview-disc disc-${state.turn}`}
                      aria-hidden="true"
                    />
                  )}
                  {visual.showLegalMoves && <span className="reversi-legal-dot" aria-hidden="true" />}
                </>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
