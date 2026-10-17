import { useEffect, useId, useRef, useState, type TouchEvent } from 'react';
import {
  WORM_LEVEL_COUNT, findWormSolution, moveWorm,
  restoreWorm, startWorm, wormLevel, type Direction, type WormState,
} from '../../../packages/games/apple-worm/engine.ts';
import { WormApple, WormCharacter, WormPortal, WormSky, WormTerrain } from './AppleWormArt.tsx';
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
  const svgId = useId().replace(/:/g, '') + '-board';
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
    onSwipe(Math.abs(dx) > Math.abs(dy) ?
      (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  };
  return (
    <svg className="worm-board" viewBox={'0 0 ' + width + ' ' + height}
      role="img" aria-label={label} onTouchStart={touchStart} onTouchEnd={touchEnd}
      xmlns="http://www.w3.org/2000/svg">
      <WormSky width={width} height={height} id={svgId}/>
      <WormTerrain blocks={board.blocks} tile={TILE}/>
      {board.spikes.map((p, i) => (
        <path key={i}
          d={'M' + (p.x * TILE + 6) + ' ' + (p.y * TILE + 43) +
            'L' + (p.x * TILE + 17) + ' ' + (p.y * TILE + 7) +
            'L' + (p.x * TILE + 29) + ' ' + (p.y * TILE + 38) +
            'L' + (p.x * TILE + 40) + ' ' + (p.y * TILE + 6) +
            'L' + (p.x * TILE + 46) + ' ' + (p.y * TILE + 43) + 'Z'}
          fill="#676971" stroke="#272b31" strokeWidth="3" strokeLinejoin="round"/>
      ))}
      <WormPortal x={board.portal.x} y={board.portal.y} tile={TILE} ready={state.eaten}/>
      {!state.eaten && <WormApple x={board.apple.x} y={board.apple.y} tile={TILE}/>}
      <WormCharacter body={state.body} tile={TILE} id={svgId}/>
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
  useEffect(() => {
    let active = true;
    void storage.get<SavedWorm | null>(SAVE_KEY, null).then(saved => {
      if (!active) return;
      const progress = typeof saved?.unlocked === 'number' && Number.isInteger(saved.unlocked) ?
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
