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
      <img src="/icon.svg" alt="" />
      <span>
        board<span className="brand-light">arena</span>
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
export function GameArt({ game, compact = false }: { game: string; compact?: boolean }) {
  const id = useId().replace(/:/g, ''),
    s = createAbalone();
  return (
    <div className={`game-art ${game} ${compact ? 'compact' : ''}`} aria-hidden="true">
      <div className="art-halo" />
      {game === 'abalone' ? (
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
