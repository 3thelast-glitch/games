import { ClassicArt } from './ClassicArt.tsx';
import { createContext, useContext, useEffect, useId, useRef, type ReactNode } from 'react';
import { useI18n } from './i18n.tsx';
import { HEXES, createAbalone, hexKey } from '../../../packages/games/abalone/state.ts';
import { hexPosition } from '../../../packages/games/abalone/ui.tsx';
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    library: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    trophy: (
      <>
        <path d="M8 3h8v6a4 4 0 0 1-8 0V3ZM12 13v6M8 21h8M8 5H4v3a4 4 0 0 0 4 4M16 5h4v3a4 4 0 0 1-4 4" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    settings: (
      <>
        <path d="m10 3 4 0 1 3 3 1 3 3-2 3 0 4-4 1-3 3-3-2-4-1-1-4-2-3 3-3Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    back: <path d="M20 12H4m6-6-6 6 6 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 4 4 10-10" />,
    volume: (
      <>
        <path d="M11 4 6 8H3v8h3l5 4V4ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" />
      </>
    ),
    mute: (
      <>
        <path d="M11 4 6 8H3v8h3l5 4V4ZM16 9l6 6m0-6-6 6" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v6l4 2" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5" />
      </>
    ),
    ai: (
      <>
        <rect x="4" y="7" width="16" height="14" rx="4" />
        <path d="M12 3v4m-4 6h1m6 0h1m-7 4h6" />
        <circle cx="12" cy="3" r="1" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="12" rx="3" />
        <path d="M8 10V6a4 4 0 0 1 8 0v4M12 15v3" />
      </>
    ),
    spark: <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z" />,
    undo: <path d="M8 4 3 9l5 5M3 9h10a7 7 0 0 1 0 14" />,
    restart: (
      <>
        <path d="M3 4v6h6M3 10a9 9 0 1 1 2 8" />
      </>
    ),
    flag: (
      <>
        <path d="M5 22V3m0 0c5-5 9 5 14 0v10c-5 5-9-5-14 0" />
      </>
    ),
    handshake: (
      <>
        <path d="m2 9 4-5 6 3 6-3 4 5-5 9-5 3-5-3-5-9ZM6 9l4 4 3-4 5 5" />
      </>
    ),
    heart: <path d="M12 21 3 12C-3 4 8-2 12 6c4-8 15-2 9 6Z" />,
    copy: (
      <>
        <rect x="8" y="8" width="13" height="13" rx="2" />
        <path d="M16 8V3H3v13h5" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-11v1" />
      </>
    ),
    smile: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 9h.01M16 9h.01M7 14q5 6 10 0" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.spark}
    </svg>
  );
}
export function Logo() {
  const { t } = useI18n();
  return (
    <span className="brand">
      <img src="/brand/icon-192.png" alt="" width="44" height="44" />
      <span>
        <span className="brand-name">{t('brandName')}</span>
        <small>{t('brandMotto')}</small>
      </span>
    </span>
  );
}
export const avatars: Record<string, string> = {
  orbit: '◉',
  rook: '♜',
  comet: '✦',
  hex: '⬡',
  crown: '♛',
  moon: '☾',
};
export function Avatar({
  name = 'Guest',
  avatar = 'orbit',
  large = false,
}: {
  name?: string;
  avatar?: string;
  large?: boolean;
}) {
  return (
    <span className={`avatar ${large ? 'large' : ''}`} aria-label={name}>
      {avatars[avatar] ?? name.slice(0, 1)}
    </span>
  );
}
export const NoticeContext = createContext('');
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    id = useId();
  const { t } = useI18n(),
    notice = useContext(NoticeContext);
  useEffect(() => {
    const d = dialog.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal ${wide ? 'wide' : ''}`}
      aria-labelledby={id}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-top">
          <h2 id={id}>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label={t('close')}>
            <Icon name="close" />
          </button>
        </div>
        {notice && (
          <p className="inline-notice" role="status">
            {t(notice)}
          </p>
        )}
        {children}
      </div>
    </dialog>
  );
}
function DotsAndBoxesArt({ id }: { id: string }) {
  const claimed = [
    { row: 1, col: 1, owner: 0 },
    { row: 2, col: 2, owner: 1 },
    { row: 3, col: 1, owner: 0 },
  ] as const;
  const horizontal = [
    [0, 1, 0],
    [1, 1, 0],
    [1, 2, 1],
    [2, 1, 0],
    [2, 2, 1],
    [3, 1, 0],
    [3, 2, 1],
    [4, 1, 0],
    [4, 3, 1],
  ] as const;
  const vertical = [
    [1, 1, 0],
    [1, 2, 0],
    [1, 3, 1],
    [2, 1, 0],
    [2, 2, 1],
    [2, 3, 1],
    [3, 1, 0],
    [3, 2, 0],
    [3, 3, 1],
  ] as const;
  const x = (col: number) => 100 + col * 88;
  const y = (row: number) => 58 + row * 55;
  return (
    <svg viewBox="0 0 640 400" role="presentation">
      <defs>
        <linearGradient id={`${id}dotsSurface`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#151f35" />
          <stop offset="1" stopColor="#0c1322" />
        </linearGradient>
        <linearGradient id={`${id}p0`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#65ddff" />
          <stop offset="1" stopColor="#4993ff" />
        </linearGradient>
        <linearGradient id={`${id}p1`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#b89cff" />
          <stop offset="1" stopColor="#7d63d8" />
        </linearGradient>
        <filter id={`${id}dotsShadow`} x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="14" stdDeviation="12" floodColor="#02050c" floodOpacity=".62" />
        </filter>
      </defs>
      <ellipse cx="320" cy="338" rx="230" ry="34" fill="#030710" opacity=".7" />
      <g filter={`url(#${id}dotsShadow)`}>
        <rect x="64" y="30" width="512" height="320" rx="28" fill={`url(#${id}dotsSurface)`} stroke="#314263" strokeWidth="2" />
        <rect x="76" y="42" width="488" height="296" rx="22" fill="none" stroke="#ffffff" strokeOpacity=".035" />
        {claimed.map(({ row, col, owner }) => (
          <g key={`c-${row}-${col}`}>
            <rect
              x={x(col) + 8}
              y={y(row) + 8}
              width="72"
              height="39"
              rx="10"
              fill={owner === 0 ? "#3dbce6" : "#8d73dd"}
              opacity=".18"
            />
            <path
              d={owner === 0 ? `M ${x(col) + 31} ${y(row) + 29} l 10 10 20 -22` : `M ${x(col) + 31} ${y(row) + 19} l 28 20 M ${x(col) + 59} ${y(row) + 19} l -28 20`}
              fill="none"
              stroke={owner === 0 ? "#82e9ff" : "#c6b4ff"}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity=".85"
            />
          </g>
        ))}
        <g strokeLinecap="round" strokeWidth="8">
          {horizontal.map(([row, col, owner], index) => (
            <line
              key={`h-${index}`}
              x1={x(col)}
              y1={y(row)}
              x2={x(col + 1)}
              y2={y(row)}
              stroke={owner === 0 ? `url(#${id}p0)` : `url(#${id}p1)`}
            />
          ))}
          {vertical.map(([row, col, owner], index) => (
            <line
              key={`v-${index}`}
              x1={x(col)}
              y1={y(row)}
              x2={x(col)}
              y2={y(row + 1)}
              stroke={owner === 0 ? `url(#${id}p0)` : `url(#${id}p1)`}
            />
          ))}
        </g>
        {Array.from({ length: 36 }, (_, index) => {
          const row = Math.floor(index / 6);
          const col = index % 6;
          return (
            <g key={index}>
              <circle cx={x(col)} cy={y(row)} r="8" fill="#060b13" opacity=".7" />
              <circle cx={x(col)} cy={y(row) - 1} r="6" fill="#e7f0ff" stroke="#9fb4d5" strokeWidth="1.5" />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

const artPipPositions: Record<number, Array<[number, number]>> = {
  0: [],
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.22], [0.72, 0.22], [0.28, 0.5], [0.72, 0.5], [0.28, 0.78], [0.72, 0.78]],
};

function ArtDomino({
  x,
  y,
  a,
  b,
  filter,
}: {
  x: number;
  y: number;
  a: number;
  b: number;
  filter: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`} filter={filter}>
      <rect width="116" height="64" rx="12" fill="#f1eee6" stroke="#c9c4b8" strokeWidth="2" />
      <rect x="3" y="3" width="110" height="58" rx="9" fill="none" stroke="#ffffff" strokeOpacity=".7" />
      <line x1="58" y1="8" x2="58" y2="56" stroke="#777267" strokeWidth="2" />
      {[a, b].map((value, half) =>
        artPipPositions[value].map(([px, py], index) => (
          <circle
            key={`${half}-${index}`}
            cx={half * 58 + 8 + px * 42}
            cy={8 + py * 48}
            r="4.7"
            fill="#202632"
          />
        )),
      )}
    </g>
  );
}

function DominoesArt({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 640 400" role="presentation">
      <defs>
        <linearGradient id={`${id}dominoSurface`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#102b2d" />
          <stop offset=".58" stopColor="#11222d" />
          <stop offset="1" stopColor="#0a1421" />
        </linearGradient>
        <radialGradient id={`${id}dominoGlow`} cx="45%" cy="45%">
          <stop stopColor="#73e2c1" stopOpacity=".18" />
          <stop offset="1" stopColor="#73e2c1" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}dominoShadow`} x="-20%" y="-30%" width="140%" height="180%">
          <feDropShadow dx="0" dy="13" stdDeviation="9" floodColor="#02060a" floodOpacity=".7" />
        </filter>
      </defs>
      <rect x="42" y="48" width="556" height="288" rx="28" fill={`url(#${id}dominoSurface)`} stroke="#2b5150" strokeWidth="2" />
      <ellipse cx="318" cy="188" rx="250" ry="145" fill={`url(#${id}dominoGlow)`} />
      <path d="M78 293 C 196 252, 405 336, 564 278" fill="none" stroke="#7ddfc1" strokeOpacity=".08" strokeWidth="2" />
      <path d="M88 104 C 220 151, 426 66, 555 121" fill="none" stroke="#d4ae72" strokeOpacity=".08" strokeWidth="2" />
      <ArtDomino x={82} y={171} a={2} b={6} filter={`url(#${id}dominoShadow)`} />
      <ArtDomino x={199} y={171} a={6} b={6} filter={`url(#${id}dominoShadow)`} />
      <ArtDomino x={316} y={171} a={6} b={4} filter={`url(#${id}dominoShadow)`} />
      <ArtDomino x={433} y={171} a={4} b={1} filter={`url(#${id}dominoShadow)`} />
      <circle cx="113" cy="133" r="4" fill="#79e2c1" opacity=".65" />
      <circle cx="542" cy="265" r="4" fill="#d9b97c" opacity=".55" />
    </svg>
  );
}


function NavalBattleArt({ id }: { id: string }) {
  const ship = (
    x: number,
    y: number,
    scale: number,
    rotate: number,
    variant: 'carrier' | 'battleship' | 'submarine' | 'destroyer',
  ) => {
    const paths = {
      carrier: 'M5 18 L24 7 L103 6 L124 12 L145 18 L124 25 L103 30 L24 29 Z M43 9 L84 9 L99 15 L47 15 Z',
      battleship: 'M6 18 L26 8 L105 9 L138 18 L105 27 L26 28 Z M56 10 L91 10 L105 18 L91 25 L56 25 Z',
      submarine: 'M8 18 C27 7 113 7 140 18 C113 29 27 29 8 18 Z M65 10 L87 10 L98 18 L87 26 L65 26 Z',
      destroyer: 'M8 18 L33 10 L106 11 L137 18 L106 25 L33 26 Z M70 11 L93 12 L103 18 L93 24 L70 25 Z',
    } as const;
    return (
      <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
        <path d={paths[variant]} fill="#637b89" stroke="#9ebbc5" strokeWidth="1.6" />
        <path d="M28 18 H118" stroke="#d4edf2" strokeOpacity=".24" strokeWidth="1.1" />
        <path d="M43 24 H94" stroke="#1e3948" strokeOpacity=".5" strokeWidth="2" />
      </g>
    );
  };
  return (
    <svg viewBox="0 0 640 400" role="presentation">
      <defs>
        <linearGradient id={`${id}navalSea`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#0d3147" />
          <stop offset=".52" stopColor="#0a2235" />
          <stop offset="1" stopColor="#07131f" />
        </linearGradient>
        <radialGradient id={`${id}navalGlow`} cx="58%" cy="36%">
          <stop stopColor="#53c8d9" stopOpacity=".22" />
          <stop offset=".48" stopColor="#257a95" stopOpacity=".08" />
          <stop offset="1" stopColor="#0a1a27" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}navalHit`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ffd09b" />
          <stop offset=".5" stopColor="#ef825d" />
          <stop offset="1" stopColor="#b8473d" />
        </linearGradient>
        <filter id={`${id}navalShadow`} x="-30%" y="-40%" width="160%" height="190%">
          <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#02070c" floodOpacity=".72" />
        </filter>
        <filter id={`${id}navalGlowFx`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <rect x="36" y="38" width="568" height="302" rx="28" fill={`url(#${id}navalSea)`} stroke="#27516a" strokeWidth="2" />
      <rect x="48" y="50" width="544" height="278" rx="22" fill="none" stroke="#d9f5f8" strokeOpacity=".035" />
      <ellipse cx="365" cy="176" rx="238" ry="150" fill={`url(#${id}navalGlow)`} />
      <g stroke="#7ab8ca" strokeOpacity=".12" strokeWidth="1">
        {Array.from({ length: 12 }, (_, i) => <line key={`v${i}`} x1={67 + i * 46} y1="67" x2={67 + i * 46} y2="310" />)}
        {Array.from({ length: 7 }, (_, i) => <line key={`h${i}`} x1="67" y1={67 + i * 40.5} x2="573" y2={67 + i * 40.5} />)}
      </g>
      <g opacity=".42" fill="none" stroke="#6fd5de" strokeWidth="1.5">
        <circle cx="455" cy="132" r="44" />
        <circle cx="455" cy="132" r="76" opacity=".55" />
        <path d="M455 132 L513 87" />
        <path d="M455 132 A76 76 0 0 1 520 171" opacity=".55" />
      </g>
      <g filter={`url(#${id}navalShadow)`}>
        {ship(116, 112, 1.28, -8, 'carrier')}
        {ship(346, 218, .92, 5, 'battleship')}
        {ship(206, 260, .72, -4, 'submarine')}
        {ship(414, 104, .64, 11, 'destroyer')}
      </g>
      <g transform="translate(470 228)">
        <circle r="24" fill="none" stroke="#72dce4" strokeOpacity=".46" strokeWidth="2" />
        <circle r="12" fill="none" stroke="#72dce4" strokeOpacity=".72" strokeWidth="2" />
        <path d="M-34 0H34M0-34V34" stroke="#72dce4" strokeOpacity=".55" strokeWidth="1.5" />
      </g>
      <g transform="translate(344 146)">
        <circle r="18" fill="#ef7857" opacity=".12" filter={`url(#${id}navalGlowFx)`} />
        <circle r="7" fill={`url(#${id}navalHit)`} />
        <path d="M-14 -14L14 14M14 -14L-14 14" stroke="#f6a283" strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <path d="M79 298 C164 275 241 318 322 297 S487 277 562 300" fill="none" stroke="#b9edf1" strokeOpacity=".06" strokeWidth="2" />
      <path d="M79 89 C174 110 243 73 329 95 S489 118 559 93" fill="none" stroke="#b9edf1" strokeOpacity=".05" strokeWidth="2" />
    </svg>
  );
}

export function GameArt({ game, compact = false }: { game: string; compact?: boolean }) {
  const id = useId().replace(/:/g, ''),
    s = createAbalone();
  return (
    <div className={`game-art ${game} ${compact ? 'compact' : ''}`} aria-hidden="true">
      <div className="art-halo" />
      {game === 'dotsAndBoxes' ? (
        <DotsAndBoxesArt id={id} />
      ) : game === 'dominoes' ? (
        <DominoesArt id={id} />
      ) : game === 'navalBattle' ? (
        <NavalBattleArt id={id} />
      ) : ['checkers', 'gomoku', 'nineMensMorris', 'connectFour', 'reversi', 'digitalGame', 'chess'].includes(game) ? (
        <ClassicArt game={game} />
      ) : game === 'abalone' ? (
        <svg viewBox="0 0 480 444">
          <defs>
            <radialGradient id={`${id}b`} cx="35%" cy="22%">
              <stop stopColor="#687082" />
              <stop offset=".35" stopColor="#282d3a" />
              <stop offset="1" stopColor="#080b11" />
            </radialGradient>
            <radialGradient id={`${id}w`} cx="35%" cy="22%">
              <stop stopColor="#fff" />
              <stop offset=".4" stopColor="#eaedf4" />
              <stop offset="1" stopColor="#a1a8b9" />
            </radialGradient>
          </defs>
          <polygon
            points="131,16 349,16 466,222 349,428 131,428 14,222"
            fill="#282a3c"
            stroke="#72708b"
            strokeWidth="2"
          />
          <polygon points="135,27 345,27 454,222 345,417 135,417 26,222" fill="#151724" />
          {HEXES.map((p) => {
            const { x, y } = hexPosition(p);
            const m = s.board[hexKey(p)];
            return (
              <g key={hexKey(p)}>
                <circle cx={x} cy={y} r="19" fill="#0a0d16" stroke="#34374b" />
                {m && (
                  <>
                    <ellipse cx={x} cy={y + 6} rx="18" ry="15" fill="black" opacity=".5" />
                    <circle
                      cx={x}
                      cy={y - 2}
                      r="17"
                      fill={`url(#${id}${m.owner === 0 ? 'b' : 'w'})`}
                    />
                  </>
                )}
              </g>
            );
          })}
        </svg>
      ) : (
        <svg viewBox="0 0 440 440">
          <defs>
            <radialGradient id={`${id}p`} cx="30%" cy="15%">
              <stop stopColor="#d4ffee" />
              <stop offset="1" stopColor="#43a78e" />
            </radialGradient>
          </defs>
          <rect
            x="10"
            y="10"
            width="420"
            height="420"
            rx="25"
            fill="#293b3c"
            stroke="#607a74"
            strokeWidth="2"
          />
          {Array.from({ length: 81 }, (_, i) => (
            <rect
              key={i}
              x={26 + (i % 9) * 43}
              y={26 + Math.floor(i / 9) * 43}
              width="36"
              height="36"
              rx="4"
              fill="#1b282b"
              stroke="#3b4b4b"
            />
          ))}
          <g strokeLinecap="round" strokeWidth="9" stroke="#b2d2b7">
            <path d="M66 110h80M197 239h80M283 66v80M111 281v80M326 323h80" />
          </g>
          <ellipse cx="219" cy="301" rx="20" ry="10" fill="#000" opacity=".3" />
          <path
            d="M207 295q1-15 4-24c-10-21 26-21 16 0q3 10 4 24q-12 13-24 0"
            fill={`url(#${id}p)`}
          />
          <path d="M335 165q1-15 4-24c-10-21 26-21 16 0q3 10 4 24q-12 13-24 0" fill="#e7b97b" />
        </svg>
      )}
      <span className="art-orbit one" />
      <span className="art-orbit two" />
    </div>
  );
}
export function Empty({ icon = 'spark', children }: { icon?: string; children: ReactNode }) {
  return (
    <div className="empty-state">
      <Icon name={icon} size={30} />
      <p>{children}</p>
    </div>
  );
}
export const formatTime = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};