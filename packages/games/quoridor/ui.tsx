import { useEffect, useState } from 'react';
import { pawnTargets, wallValidation } from './rules.ts';
import { squareEqual, type QuoridorMove, type QuoridorState, type Wall } from './state.ts';
export interface QuoridorBoardProps {
  state: QuoridorState;
  disabled: boolean;
  onMove: (move: QuoridorMove) => void;
  t: (key: string) => string;
}
const wallRect = (w: Wall) => ({
  x: 24 + w.col * 48 + (w.orientation === 'v' ? 42 : 0),
  y: 24 + w.row * 48 + (w.orientation === 'h' ? 42 : 0),
  width: w.orientation === 'h' ? 90 : 6,
  height: w.orientation === 'h' ? 6 : 90,
});
export function QuoridorBoard({ state, disabled, onMove, t }: QuoridorBoardProps) {
  const [mode, setMode] = useState<'pawn' | 'wall'>('pawn'),
    [orientation, setOrientation] = useState<'h' | 'v'>('h'),
    [preview, setPreview] = useState<Wall | null>(null);
  useEffect(() => {
    setPreview(null);
    setMode('pawn');
  }, [state.ply]);
  const targets = disabled ? [] : pawnTargets(state),
    valid = preview ? wallValidation(state, preview) : null;
  const activate = (event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };
  return (
    <div className="quoridor-game">
      <div className="segmented board-mode">
        <button
          aria-pressed={mode === 'pawn'}
          onClick={() => {
            setMode('pawn');
            setPreview(null);
          }}
        >
          {t('movePawn')}
        </button>
        <button
          aria-pressed={mode === 'wall'}
          disabled={disabled || !state.remaining[state.turn]}
          onClick={() => setMode('wall')}
        >
          {t('placeWall')} <span>{state.remaining[state.turn]}</span>
        </button>
      </div>
      <svg
        className="quoridor-board"
        viewBox="0 0 476 476"
        style={{ direction: 'ltr' }}
        aria-label={t('quoridor')}
      >
        <defs>
          <linearGradient id="qFrame" x2=".8" y2="1">
            <stop stopColor="#353a48" />
            <stop offset="1" stopColor="#20232e" />
          </linearGradient>
          <radialGradient id="pawn0" cx="35%" cy="22%">
            <stop stopColor="#cefff3" />
            <stop offset=".38" stopColor="#68d8bd" />
            <stop offset="1" stopColor="#218879" />
          </radialGradient>
          <radialGradient id="pawn1" cx="35%" cy="22%">
            <stop stopColor="#ffebc1" />
            <stop offset=".38" stopColor="#efb96d" />
            <stop offset="1" stopColor="#a86e34" />
          </radialGradient>
        </defs>
        <rect x="4" y="4" width="468" height="468" rx="24" fill="url(#qFrame)" stroke="#4a4e60" />
        <rect x="16" y="16" width="444" height="444" rx="14" fill="#151922" />
        <path d="M32 13H232" stroke="#70dcc0" strokeWidth="3" />
        <path d="M244 13H444" stroke="#e4b36d" strokeWidth="3" strokeDasharray="4 4" />
        <path d="M32 463H232" stroke="#70dcc0" strokeWidth="3" strokeDasharray="4 4" />
        <path d="M244 463H444" stroke="#e4b36d" strokeWidth="3" />
        {Array.from({ length: 81 }, (_, i) => {
          const row = Math.floor(i / 9),
            col = i % 9,
            legal = mode === 'pawn' && targets.some((p) => squareEqual(p, [row, col]));
          const play = () => {
            if (legal) onMove({ kind: 'pawn', to: [row, col] });
          };
          return (
            <g key={i}>
              <rect
                x={24 + col * 48}
                y={24 + row * 48}
                width="42"
                height="42"
                rx="5"
                fill={row === 0 ? '#25372f' : row === 8 ? '#393027' : '#2b303b'}
                stroke={legal ? '#6cdbbc' : '#363c49'}
                strokeWidth={legal ? 2 : 1}
                role="button"
                tabIndex={legal ? 0 : -1}
                aria-disabled={!legal}
                aria-label={`${t('movePawn')} ${row + 1},${col + 1}`}
                onClick={play}
                onKeyDown={(e) => activate(e, play)}
                className={legal ? 'legal-square' : ''}
              />
              {legal && (
                <circle
                  cx={45 + col * 48}
                  cy={45 + row * 48}
                  r="5"
                  fill="#83e1c5"
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}
        {state.walls.map((wall, i) => (
          <rect
            key={i}
            {...wallRect(wall)}
            rx="3"
            fill={wall.owner === 0 ? '#81dec0' : '#f0bb74'}
            className="placed-wall"
            pointerEvents="none"
          />
        ))}
        {state.pawns.map(([row, col], player) => (
          <g
            key={player}
            className="pawn"
            style={{
              transform: `translate(${45 + col * 48}px,${45 + row * 48}px)`,
            }}
            pointerEvents="none"
          >
            <ellipse cy="9" rx="15" ry="9" fill="#000" opacity=".35" />
            <path
              d="M-12 7Q-9 0 -8 -4Q-15 -25 0 -26Q15 -25 8 -4Q9 0 12 7Q12 17 0 17Q-12 17 -12 7"
              fill={`url(#pawn${player})`}
              stroke={player === 0 ? '#9aefd4' : '#fbd798'}
              strokeWidth=".7"
            />
            <ellipse cy="9" rx="8" ry="3" fill="white" opacity=".15" />
          </g>
        ))}
        {mode === 'wall' &&
          !disabled &&
          Array.from({ length: 64 }, (_, i) => {
            const row = Math.floor(i / 8),
              col = i % 8,
              wall = { row, col, orientation },
              select = () => setPreview(wall);
            return (
              <rect
                key={i}
                x={orientation === 'h' ? 24 + col * 48 : 60 + col * 48}
                y={orientation === 'h' ? 60 + row * 48 : 24 + row * 48}
                width={orientation === 'h' ? 48 : 18}
                height={orientation === 'h' ? 18 : 48}
                fill="transparent"
                role="button"
                tabIndex={0}
                aria-label={`${t('placeWall')} ${row + 1},${col + 1}`}
                onClick={select}
                onKeyDown={(e) => activate(e, select)}
                className="wall-slot"
              />
            );
          })}
        {preview && (
          <rect
            {...wallRect(preview)}
            rx="3"
            fill={valid?.ok ? '#a2f8d8' : '#fc8789'}
            fillOpacity=".6"
            stroke={valid?.ok ? '#b7ffe7' : '#ff949b'}
            strokeWidth="2"
            className="wall-preview"
            pointerEvents="none"
          />
        )}
      </svg>
      {mode === 'wall' ? (
        <div className="wall-controls">
          <div className="segmented">
            <button
              aria-pressed={orientation === 'h'}
              onClick={() => {
                setOrientation('h');
                if (preview) setPreview({ ...preview, orientation: 'h' });
              }}
            >
              {t('horizontal')}
            </button>
            <button
              aria-pressed={orientation === 'v'}
              onClick={() => {
                setOrientation('v');
                if (preview) setPreview({ ...preview, orientation: 'v' });
              }}
            >
              {t('vertical')}
            </button>
          </div>
          <p className={`board-hint ${valid && !valid.ok ? 'error-text' : ''}`}>
            {t(valid ? (valid.ok ? 'validWall' : valid.code) : 'wallHint')}
          </p>
          <button
            className="button primary"
            disabled={!preview || !valid?.ok || disabled}
            onClick={() => {
              if (preview) onMove({ kind: 'wall', wall: preview });
            }}
          >
            {t('confirmWall')}
          </button>
        </div>
      ) : (
        <p className="board-hint">{t('pawnHint')}</p>
      )}
    </div>
  );
}
