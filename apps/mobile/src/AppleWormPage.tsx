import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import {
  DIRECTIONS, WORM_LEVEL_COUNT, findWormSolution, moveWorm,
  restoreWorm, startWorm, wormLevel, type Direction, type WormState,
} from '../../../packages/games/apple-worm/engine.ts';
import { useI18n } from './i18n.tsx';
import { feedback, storage, type Settings } from './platform.ts';

interface SavedWorm { unlocked: number; state: WormState }
const SAVE_KEY = 'apple-worm-offline-v1';
const DELTAS: Record<Direction, string> = {
  up: '↑', down: '↓', left: '←', right: '→',
};
const INPUT: Record<string, Direction> = {
  arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down',
  arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right',
};
const TILE = 48;

function WormBoard({ state, onSwipe, label }: {
  state: WormState; onSwipe: (direction: Direction) => void; label: string;
}) {
  const board = wormLevel(state.level);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const width = board.width * TILE;
  const height = board.height * TILE;
  const touchStart = (e: TouchEvent<SVGSVGElement>) => {
    const p = e.touches[0];
    if (p) swipe.current = { x: p.clientX, y: p.clientY };
  };
  const touchEnd = (e: TouchEvent<SVGSVGElement>) => {
    if (!swipe.current || !e.changedTouches[0]) return;
    const dx = e.changedTouches[0].clientX - swipe.current.x;
    const dy = e.changedTouches[0].clientY - swipe.current.y;
    swipe.current = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  };
  return (
    <svg className="worm-board" viewBox={'0 0 ' + width + ' ' + height}
      role="img" aria-label={label} onTouchStart={touchStart} onTouchEnd={touchEnd}
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="worm-sky" x2="0" y2="1">
          <stop stopColor="#58b8ec" /><stop offset="1" stopColor="#c8edff" />
        </linearGradient>
        <linearGradient id="worm-earth" x2=".2" y2="1">
          <stop stopColor="#9d623d" /><stop offset="1" stopColor="#563424" />
        </linearGradient>
        <linearGradient id="worm-green" x2=".2" y2="1">
          <stop stopColor="#a6eb5e" /><stop offset=".7" stopColor="#46ac28" />
          <stop offset="1" stopColor="#267420" />
        </linearGradient>
        <radialGradient id="worm-portal">
          <stop stopColor="#11141e" /><stop offset=".8" stopColor="#121c39" />
          <stop offset="1" stopColor="#5673e7" />
        </radialGradient>
      </defs>
      <rect width={width} height={height} fill="url(#worm-sky)"/>
      <circle cx={width - 75} cy="76" r="44" fill="#fff2c0" opacity=".7"/>
      <g opacity=".32" fill="#fff">
        <ellipse cx="100" cy="155" rx="86" ry="22" />
        <ellipse cx="136" cy="139" rx="43" ry="24" />
        <ellipse cx={width - 150} cy="227" rx="92" ry="24" />
      </g>
      <path d={'M0 ' + (height - 50) + ' Q' + (width * .28) + ' ' + (height - 140) +
        ' ' + (width * .52) + ' ' + (height - 65) + ' T' + width + ' ' + (height - 80) +
        ' V' + height + ' H0Z'} fill="#65b77a" opacity=".27"/>
      {board.blocks.map((p, i) => {
        const x = p.x * TILE, y = p.y * TILE;
        const above = !board.blocks.some(t => t.x === p.x && t.y === p.y - 1);
        return <g key={'block-' + i}>
          <rect x={x + 1} y={y + 2} width={TILE - 2} height={TILE - 2} rx="5"
            fill="url(#worm-earth)" stroke="#4d2e25" strokeWidth="2"/>
          <path d={'M' + (x + 7) + ' ' + (y + 24) + 'l9 3m18 8l7 -5'}
            stroke="#b88254" strokeWidth="2" opacity=".62" fill="none" />
          {above && <>
            <rect x={x} y={y} width={TILE} height="10" rx="4" fill="#4c9b3c"/>
            <path d={'M' + x + ' ' + (y + 7) + 'q8 -9 16 0t16 0t16 0'}
              stroke="#8ad860" strokeWidth="4" fill="none"/>
          </>}
        </g>;
      })}
      {board.spikes.map((p, i) => <path key={'spike-' + i}
        d={'M' + (p.x * TILE + 5) + ' ' + (p.y * TILE + 42) + 'l13 -34 10 25 11 -25 7 34Z'}
        fill="#65778b" stroke="#e9f5ff" strokeWidth="2"/>)}
      <g transform={'translate(' + (board.portal.x * TILE + TILE / 2) + ',' + (board.portal.y * TILE + TILE / 2) + ')'}>
        <circle r="20" fill="url(#worm-portal)" stroke={state.eaten ? '#85f2f8' : '#7485ae'}
          strokeWidth="3" className={state.eaten ? 'worm-portal-ready' : ''}/>
        <path d="M-13 0C-14 -18 17 -19 15 0C13 17 -12 15 -9 1C-7 -10 9 -10 8 1C7 8 -5 8 -3 0"
          fill="none" stroke={state.eaten ? '#8befff' : '#64749b'} strokeWidth="3.2" strokeLinecap="round"/>
      </g>
      {!state.eaten && <g transform={'translate(' + (board.apple.x * TILE + 24) + ',' + (board.apple.y * TILE + 25) + ')'}>
        <ellipse cx="2" cy="17" rx="18" ry="5" fill="#1d3950" opacity=".2"/>
        <path d="M0 -15C-25 -28 -25 -2 -14 12C-7 24 0 19 0 19S8 24 16 12C28 -3 24 -28 0 -15Z"
          fill="#e83730" stroke="#a72225" strokeWidth="2.6"/>
        <ellipse cx="-8" cy="-4" rx="5" ry="9" fill="#ff9b81" opacity=".5" transform="rotate(25 -8 -4)"/>
        <path d="M1 -14q-3 -11 4 -19" stroke="#513f26" strokeWidth="4" strokeLinecap="round" fill="none"/>
        <path d="M4 -26q17 -18 23 -2q-14 13 -23 2" fill="#339b56" stroke="#1f7944" strokeWidth="2"/>
      </g>}
      {[...state.body].reverse().map((p, i) => {
        const head = i === state.body.length - 1;
        const x = p.x * TILE + 3, y = p.y * TILE + 4;
        return <g key={'worm-' + i} className={head ? 'worm-head' : 'worm-segment'}>
          <rect x={x + 1} y={y + 5} width="42" height="40" rx="19" fill="#193d1d" opacity=".16"/>
          <rect x={x} y={y} width="42" height="40" rx="16" fill="url(#worm-green)"
            stroke="#247d28" strokeWidth="2.6"/>
          {!head && <path d={'M' + (x + 21) + ' ' + (y + 5) + 'v28'}
            stroke="#b6fa86" strokeWidth="3" opacity=".27" />}
          {head && <>
            <ellipse cx={x + 17} cy={y + 14} rx="8" ry="10" fill="white"/>
            <ellipse cx={x + 31} cy={y + 14} rx="8" ry="10" fill="white"/>
            <circle cx={x + 19} cy={y + 15} r="3.6" fill="#152637"/>
            <circle cx={x + 33} cy={y + 15} r="3.6" fill="#152637"/>
            <ellipse cx={x + 29} cy={y + 30} rx="10" ry="5" fill="#ba4e86"
              stroke="#763e6e" strokeWidth="1.7"/>
          </>}
        </g>;
      })}
    </svg>
  );
}

export function AppleWormPage({ onExit, settings }: { onExit: () => void; settings: Settings }) {
  const { t, lang } = useI18n();
  const [state, setState] = useState<WormState>(() => startWorm());
  const ref = useRef(state);
  const [unlocked, setUnlocked] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [history, setHistory] = useState<WormState[]>([]);
  const [hint, setHint] = useState<Direction | null>(null);
  const [showLevels, setShowLevels] = useState(false);
  const board = useMemo(() => wormLevel(state.level), [state.level]);
  useEffect(() => {
    let active = true;
    void storage.get<SavedWorm | null>(SAVE_KEY, null).then(saved => {
      if (!active) return;
      const progress = Number.isInteger(saved?.unlocked) ?
        Math.max(1, Math.min(WORM_LEVEL_COUNT, saved!.unlocked)) : 1;
      const resume = restoreWorm(saved?.state);
      if (resume && resume.level <= progress) {
        ref.current = resume;
        setState(resume);
      }
      setUnlocked(progress);
      setLoaded(true);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (loaded) void storage.set(SAVE_KEY, { unlocked, state } satisfies SavedWorm);
  }, [state, unlocked, loaded]);
  const move = (direction: Direction) => {
    const before = ref.current;
    const next = moveWorm(before, direction);
    if (next === before) return;
    ref.current = next;
    setHistory(previous => [...previous.slice(-99), before]);
    setHint(null);
    setState(next);
    if (next.phase === 'won') setUnlocked(previous => Math.max(previous, Math.min(WORM_LEVEL_COUNT, next.level + 1)));
    feedback(settings, next.phase === 'won' ? 'win' : 'move');
  };
  const restart = () => {
    const next = startWorm(ref.current.level);
    ref.current = next; setState(next); setHistory([]); setHint(null);
  };
  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    ref.current = previous;
    setState(previous);
    setHistory(items => items.slice(0, -1));
    setHint(null);
  };
  const selectLevel = (level: number) => {
    if (level < 1 || level > unlocked) return;
    const next = startWorm(level);
    ref.current = next; setState(next); setHistory([]); setHint(null); setShowLevels(false);
  };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || showLevels) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input,textarea,select,[contenteditable="true"]')) return;
      const code = event.key.toLowerCase();
      const direction = INPUT[code];
      if (direction) { event.preventDefault(); move(direction); }
      else if (code === 'r') { event.preventDefault(); restart(); }
      else if (code === 'z') { event.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });
  if (!loaded) return <main className="worm-page"><p>{t('loading')}</p></main>;
  return (
    <main className="worm-page page-enter">
      <header className="worm-header">
        <div>
          <span className="eyebrow">NAQLA • PUZZLE ADVENTURE</span>
          <h1>{t('appleWorm')}</h1>
          <p>{t('appleWormDesc')}</p>
        </div>
        <button type="button" className="button secondary" onClick={onExit}>{t('appleWormBack')}</button>
      </header>
      <section className="worm-layout">
        <div className="worm-stage">
          <div className="worm-stage-top">
            <strong>{t('appleWormLevel')} {state.level} / {WORM_LEVEL_COUNT}</strong>
            <span>{t('appleWormMoves')}: {state.moves}</span>
            <button className="worm-link" type="button" onClick={() => setShowLevels(value => !value)}
              aria-expanded={showLevels}>{t('appleWormChoose')}</button>
          </div>
          {showLevels && <div className="worm-level-grid" aria-label={t('appleWormChoose')}>
            {Array.from({ length: WORM_LEVEL_COUNT }, (_, index) => index + 1).map(level =>
              <button type="button" key={level} disabled={level > unlocked}
                className={level === state.level ? 'selected' : ''}
                aria-current={level === state.level ? 'step' : undefined}
                onClick={() => selectLevel(level)}>{level > unlocked ? '🔒' : level}</button>
            )}
          </div>}
          <WormBoard state={state} onSwipe={move} label={t('appleWormBoard')} />
          {state.phase !== 'playing' && <div className={'worm-result ' + state.phase} role="status">
            <h2>{t(state.phase === 'won' ? 'appleWormWon' : 'appleWormLost')}</h2>
            <p>{t(state.phase === 'won' ? 'appleWormWonDesc' : 'appleWormLostDesc')}</p>
            <button className="button primary" type="button"
              onClick={() => state.phase === 'won' && state.level < WORM_LEVEL_COUNT ?
                selectLevel(state.level + 1) : restart()}>
              {t(state.phase === 'won' && state.level < WORM_LEVEL_COUNT ? 'appleWormNext' : 'appleWormRetry')}
            </button>
          </div>}
        </div>
        <aside className="worm-panel">
          <div className="worm-objective">
            <span className="worm-mini-apple" aria-hidden="true">🍎</span>
            <div><strong>{t('appleWormGoal')}</strong><p>{t('appleWormInstructions')}</p></div>
          </div>
          <div className="worm-stats">
            <span>{t('appleWormApple')}: <b>{state.eaten ? '✓' : '○'}</b></span>
            <span>{t('appleWormLength')}: <b>{state.body.length}</b></span>
          </div>
          <div className="worm-pad" dir="ltr" aria-label={t('appleWormControls')}>
            <button type="button" className="up" onClick={() => move('up')} disabled={state.phase !== 'playing'} aria-label={t('appleWormUp')}>↑</button>
            <button type="button" className="left" onClick={() => move('left')} disabled={state.phase !== 'playing'} aria-label={t('appleWormLeft')}>←</button>
            <button type="button" className="down" onClick={() => move('down')} disabled={state.phase !== 'playing'} aria-label={t('appleWormDown')}>↓</button>
            <button type="button" className="right" onClick={() => move('right')} disabled={state.phase !== 'playing'} aria-label={t('appleWormRight')}>→</button>
          </div>
          <div className="worm-actions">
            <button type="button" onClick={undo} disabled={!history.length}>{t('appleWormUndo')}</button>
            <button type="button" onClick={restart}>{t('appleWormRetry')}</button>
            <button type="button" disabled={state.phase !== 'playing'} onClick={() => {
              const path = findWormSolution(state, 30000);
              setHint(path?.[0] ?? null);
            }}>{t('appleWormHint')}</button>
          </div>
          {hint && <p className="worm-hint" role="status">{t('appleWormTry')} {DELTAS[hint]}</p>}
          <small className="worm-help">{t('appleWormKeyboard')}</small>
          <small className="worm-help">{lang === 'ar' ? 'يتم حفظ تقدمك تلقائيًا على هذا الجهاز.' : 'Your progress is saved automatically on this device.'}</small>
        </aside>
      </section>
    </main>
  );
}
