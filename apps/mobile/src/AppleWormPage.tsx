import { useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import {
  WORM_LEVEL_COUNT, findWormSolution, moveWorm,
  restoreWorm, startWorm, wormLevel, type Direction, type WormState,
} from '../../../packages/games/apple-worm/engine.ts';
import { WormApple, WormCharacter, WormPortal, WormSky, WormTerrain } from './AppleWormArt.tsx';
import { finishWormGesture, startWormGesture, type WormGesture } from './apple-worm-gestures.ts';
import { useI18n } from './i18n.tsx';
import { feedback, storage, type Settings } from './platform.ts';
import { enterGameLandscape, leaveGameLandscape } from './immersive-game.ts';
import { App as NativeApp } from '@capacitor/app';

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
  const swipe = useRef<WormGesture | null>(null);
  const width = board.width * TILE;
  const height = board.height * TILE;
  const sceneWidth = Math.max(width + TILE * 10, Math.ceil((height + TILE * 3) * 16 / 9));
  const sceneHeight = Math.max(height + TILE * 2, Math.ceil(sceneWidth * 9 / 16));
  const boardX = (sceneWidth - width) / 2;
  const boardY = (sceneHeight - height) * .61;
  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (swipe.current || !event.isPrimary ||
        (event.pointerType === 'mouse' && event.button !== 0)) return;
    const gesture = startWormGesture(event.pointerId, event.clientX, event.clientY);
    if (!gesture) return;
    swipe.current = gesture;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const direction = finishWormGesture(swipe.current, event.pointerId, event.clientX, event.clientY);
    if (swipe.current?.pointerId !== event.pointerId) return;
    swipe.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (direction) onSwipe(direction);
  };
  const cancelSwipe = () => { swipe.current = null; };
  return (
    <svg className="worm-board" viewBox={'0 0 ' + sceneWidth + ' ' + sceneHeight}
      role="img" aria-label={label} style={{direction:'ltr'}} data-input="swipe"
      onPointerDown={onPointerDown} onPointerUp={onPointerUp}
      onPointerCancel={cancelSwipe} onLostPointerCapture={cancelSwipe}
      xmlns="http://www.w3.org/2000/svg">
      <WormSky width={sceneWidth} height={sceneHeight} id={svgId}/>
      <g transform={`translate(${boardX} ${boardY})`}>
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
        <WormCharacter key={state.moves} body={state.body} tile={TILE} id={svgId}/>
      </g>
    </svg>
  );
}

export function AppleWormPage({ onExit, settings, onToggleSound }: { onExit: () => void; settings: Settings; onToggleSound: () => void }) {
  const { t, lang } = useI18n();
  const exitRef = useRef(onExit);
  exitRef.current = onExit;
  const [state, setState] = useState<WormState>(() => startWorm());
  const ref = useRef(state);
  const [unlocked, setUnlocked] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [history, setHistory] = useState<WormState[]>([]);
  const [hint, setHint] = useState<Direction | null>(null);
  const [showLevels, setShowLevels] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  useEffect(() => {
    void enterGameLandscape();
    let alive = true;
    let removal: (() => void) | undefined;
    void NativeApp.addListener('backButton', () => exitRef.current()).then(handle => {
      if (alive) removal = () => { void handle.remove(); };
      else void handle.remove();
    }).catch(() => {});
    return () => {
      alive = false;
      removal?.();
      void leaveGameLandscape();
    };
  }, []);
  useLayoutEffect(() => {
    // Start at the actual game area, not the previously scrolled library card.
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);
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
    ref.current = next; setState(next); setHistory([]); setHint(null); setShowLevels(false); setShowMenu(false);
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
  const showHint = () => {
    const path = findWormSolution(state, 30000);
    setHint(path?.[0] ?? null);
    setShowMenu(false);
  };
  if (!loaded) return <main className="worm-page worm-immersive"><p>{t('loading')}</p></main>;
  return (
    <main className="worm-page worm-immersive" dir={lang === 'ar' ? 'rtl' : 'ltr'}
      data-display="immersive-landscape" data-phase={state.phase}>
      <section className="worm-stage worm-fullstage" aria-label={t('appleWormBoard')}>
        <div className="worm-playfield">
          <WormBoard state={state} onSwipe={move} label={t('appleWormBoard')} />
        </div>
        <div className="worm-game-hud">
          <div className="worm-hud-start">
            <button className="worm-game-button worm-exit" type="button"
              aria-label={t('appleWormBack')} title={t('appleWormBack')} onClick={onExit}>↩</button>
          </div>
          <div className="worm-hud-center" aria-live="polite">
            <span className="worm-game-goal" aria-hidden="true">🐛 → 🍎 → 🌀</span>
            <span className="worm-game-moves">{t('appleWormMoves')}: <b className="worm-moves-value">{state.moves}</b></span>
          </div>
          <div className="worm-hud-end">
            <button className="worm-game-button" type="button" onClick={onToggleSound}
              aria-pressed={settings.sound} aria-label={t('appleWormSound')}>{settings.sound ? '🔊' : '🔇'}</button>
            <button className="worm-game-button" type="button" onClick={showHint}
              disabled={state.phase !== 'playing'} aria-label={t('appleWormHint')}>💡</button>
            <button className="worm-game-button" type="button" onClick={() => {
              setShowLevels(previous => !previous); setShowMenu(false);
            }} aria-label={t('appleWormChoose')} aria-expanded={showLevels}>▦</button>
            <button className="worm-game-button" type="button" onClick={() => {
              setShowMenu(previous => !previous); setShowLevels(false);
            }} aria-label={t('appleWormOptions')} aria-expanded={showMenu}>☰</button>
          </div>
        </div>
        <div className="worm-game-level" aria-label={t('appleWormLevel')}>
          {String(state.level).padStart(2, '0')}
        </div>
        {hint && state.phase === 'playing' && (
          <div className="worm-hint-bubble" role="status">{t('appleWormHint')}: {DELTAS[hint]}</div>
        )}
        {showMenu && <div className="worm-game-menu" role="dialog" aria-label={t('appleWormOptions')}>
          <h2>{t('appleWormOptions')}</h2>
          <button type="button" onClick={undo} disabled={!history.length}>
            ↶ {t('appleWormUndo')}</button>
          <button type="button" onClick={() => { restart(); setShowMenu(false); }}>
            ⟳ {t('appleWormRetry')}</button>
          <button type="button" onClick={onToggleSound}>
            {settings.sound ? '🔊' : '🔇'} {t('appleWormSound')}</button>
          <button type="button" onClick={onExit}>↩ {t('appleWormBack')}</button>
          <button type="button" onClick={() => setShowMenu(false)}>{t('appleWormClose')}</button>
        </div>}
        {showLevels && <div className="worm-game-level-dialog" role="dialog" aria-label={t('appleWormChoose')}>
          <div className="worm-level-heading">
            <h2>{t('appleWormChoose')}</h2>
            <button className="worm-game-button" type="button" onClick={() => setShowLevels(false)}
              aria-label={t('appleWormClose')}>✕</button>
          </div>
          <div className="worm-level-grid">
            {Array.from({ length: WORM_LEVEL_COUNT }, (_, index) => index + 1).map(level =>
              <button type="button" key={level} disabled={level > unlocked}
                className={level === state.level ? 'selected' : ''}
                aria-current={level === state.level ? 'step' : undefined}
                onClick={() => selectLevel(level)}>{level > unlocked ? '🔒' : level}</button>
            )}
          </div>
        </div>}
        {state.phase !== 'playing' && <div className={'worm-result ' + state.phase} role="status">
          <h2>{t(state.phase === 'won' ? 'appleWormWon' : 'appleWormLost')}</h2>
          <p>{t(state.phase === 'won' ? 'appleWormWonDesc' : 'appleWormLostDesc')}</p>
          <button type="button" onClick={() => state.phase === 'won' &&
            state.level < WORM_LEVEL_COUNT ? selectLevel(state.level + 1) : restart()}>
            {t(state.phase === 'won' && state.level < WORM_LEVEL_COUNT ?
              'appleWormNext' : 'appleWormRetry')}
          </button>
        </div>}
      </section>
      <div className="worm-rotate-gate" role="status">
        <div className="worm-rotate-image" aria-hidden="true">📱↻</div>
        <h2>{t('appleWormRotateTitle')}</h2>
        <p>{t('appleWormRotateDesc')}</p>
        <button type="button" onClick={onExit}>{t('appleWormBack')}</button>
      </div>
    </main>
  );
}
