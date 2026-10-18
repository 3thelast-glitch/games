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
import { fitWormViewport } from './apple-worm-viewport.ts';
import { App as NativeApp } from '@capacitor/app';
import { createPortal } from 'react-dom';
import { APPLE_WORM_GROUPS, APPLE_WORM_CHAPTERS } from '../../../packages/games/apple-worm/levels.ts';
import { AppleWormSourceGallery } from './AppleWormSourceGallery.tsx';

interface SavedWorm { unlocked: number; state: WormState }
const SAVE_KEY = 'apple-worm-curated-40-v3';
const DELTAS: Record<Direction, string> = {
  up: '↑', down: '↓', left: '←', right: '→',
};
const INPUT: Record<string, Direction> = {
  arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down',
  arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right',
};
const TILE = 48;

function WormBoard({ state, onSwipe, label, biteIndex }: {
  state: WormState; onSwipe: (direction: Direction) => void; label: string; biteIndex: number | null;
}) {
  const board = wormLevel(state.level);
  const svgId = useId().replace(/:/g, '') + '-board';
  const swipe = useRef<WormGesture | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState(() => ({
    width: typeof window === 'undefined' ? 960 : window.innerWidth,
    height: typeof window === 'undefined' ? 540 : window.innerHeight,
  }));
  useLayoutEffect(() => {
    const node = svgRef.current;
    if (!node) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setSize(previous => Math.abs(previous.width - rect.width) < .5 &&
        Math.abs(previous.height - rect.height) < .5
          ? previous : { width: rect.width, height: rect.height });
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(node);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  const { sceneWidth, sceneHeight, boardX, boardY } =
    fitWormViewport(board.width, board.height, size.width, size.height, TILE);
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
    <svg ref={svgRef} className="worm-board" viewBox={'0 0 ' + sceneWidth + ' ' + sceneHeight}
      preserveAspectRatio="xMidYMid meet"
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
      {board.apples.map((apple,index) =>
        !state.collectedApples?.includes(index) &&
          <WormApple key={index} x={apple.x} y={apple.y} tile={TILE}/>)}
      {biteIndex!==null && <g className="worm-apple-bite-fx" aria-hidden="true">
        <WormApple x={board.apples[biteIndex]!.x} y={board.apples[biteIndex]!.y} tile={TILE}/>
        <g className="worm-apple-crumbs" transform={`translate(${(board.apples[biteIndex]!.x+.5)*TILE} ${(board.apples[biteIndex]!.y+.5)*TILE})`}>
          <circle cx="-22" cy="-19" r="4" fill="#ffd35a"/>
          <circle cx="22" cy="-20" r="5" fill="#fbad3e"/>
          <circle cx="-16" cy="17" r="3" fill="#ffd75b"/>
          <circle cx="20" cy="18" r="4" fill="#ffec95"/>
          <path d="M0 -30V-40M-28 0H-40M30 0H40" fill="none" stroke="#fff0ae" strokeWidth="3" strokeLinecap="round"/>
        </g>
      </g>}
        <WormCharacter key={state.moves} body={state.body} tile={TILE} id={svgId} bite={biteIndex!==null}/>
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
  // The user approved ONLY the original 105 video-source stages. Open that
  // catalogue by default; independently authored legacy puzzles are opt-in.
  const [showSourceGallery, setShowSourceGallery] = useState(true);
  const [activeGroup, setActiveGroup] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [biteCue, setBiteCue] = useState<{level:number; moves:number; index:number} | null>(null);
  useEffect(() => {
    if (!biteCue) return;
    const timer = window.setTimeout(() => setBiteCue(null), 600);
    return () => window.clearTimeout(timer);
  }, [biteCue]);
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
    const beforeFruits = new Set(before.collectedApples ?? []);
    const fruitIndex = (next.collectedApples ?? []).find(index => !beforeFruits.has(index));
    if (fruitIndex!==undefined) setBiteCue({level:next.level,moves:next.moves,index:fruitIndex});
    else setBiteCue(null);
    setState(next);
    if (next.phase === 'won') setUnlocked(previous => Math.max(previous, Math.min(WORM_LEVEL_COUNT, next.level + 1)));
    feedback(settings, next.phase === 'won' ? 'win' : 'move');
  };
  const restart = () => {
    const next = startWorm(ref.current.level);
    ref.current = next; setState(next); setHistory([]); setHint(null); setBiteCue(null);
  };
  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    ref.current = previous;
    setState(previous);
    setHistory(items => items.slice(0, -1));
    setHint(null); setBiteCue(null);
  };
  const selectLevel = (level: number) => {
    if (level < 1 || level > unlocked) return;
    const next = startWorm(level);
    ref.current = next; setState(next); setHistory([]); setHint(null); setShowLevels(false); setShowMenu(false);
  };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || showLevels || showSourceGallery) return;
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
  if (!loaded) return createPortal(<main className="worm-page worm-immersive"><p>{t('loading')}</p></main>, document.body);
  return createPortal(
    <main className="worm-page worm-immersive" dir={lang === 'ar' ? 'rtl' : 'ltr'}
      data-display="immersive-landscape" data-phase={state.phase}>
      <section className="worm-stage worm-fullstage" aria-label={t('appleWormBoard')}>
        <div className="worm-playfield">
          <WormBoard state={state} onSwipe={move} label={t('appleWormBoard')}
            biteIndex={biteCue && biteCue.level===state.level && biteCue.moves===state.moves ? biteCue.index : null} />
        </div>
        <div className="worm-game-hud">
          <div className="worm-hud-start">
            <button className="worm-game-button worm-exit" type="button"
              aria-label={t('appleWormBack')} title={t('appleWormBack')} onClick={onExit}>↩</button>
          </div>
          <div className="worm-hud-center" aria-live="polite">
            <span className="worm-game-goal" aria-label={t('appleWormFruitProgress')}>
              <span title={lang === 'ar' ? '40 مرحلة قديمة غير معتمدة' : '40 unapproved legacy stages'}>
                {lang === 'ar' ? 'تجريبي (غير معتمد) · ' : 'Legacy (unapproved) · '}
              </span>
              🐛 → 🍎 {state.collectedApples?.length ?? 0}/{wormLevel(state.level).apples.length} → 🌀
            </span>
            <span className="worm-game-moves">{t('appleWormMoves')}: <b className="worm-moves-value">{state.moves}</b></span>
          </div>
          <div className="worm-hud-end">
            <button className="worm-game-button" type="button" onClick={onToggleSound}
              aria-pressed={settings.sound} aria-label={t('appleWormSound')}>{settings.sound ? '🔊' : '🔇'}</button>
            <button className="worm-game-button" type="button" onClick={showHint}
              disabled={state.phase !== 'playing'} aria-label={t('appleWormHint')}>💡</button>
            <button className="worm-game-button" type="button" onClick={() => {
              setShowSourceGallery(true); setShowLevels(false); setShowMenu(false);
            }} aria-label={lang === 'ar' ? 'مراجع المراحل الأصلية من الفيديو 105' : '105 original video level references'}
              title={lang === 'ar' ? 'مراحل الفيديو الأصلية' : 'Original video levels'}>🎞</button>
            <button className="worm-game-button" type="button" onClick={() => {
              setShowLevels(previous => !previous);
              setActiveGroup(Math.floor((state.level - 1) / 10)); setShowMenu(false);
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
          <p style={{fontSize:12,margin:'0 0 9px',color:'#e8b970'}} role="note">
            {lang === 'ar'
              ? 'المراحل الأربعون الحالية تجريبية وليست معتمدة من الفيديو. افتح مراجع المراحل الأصلية للمقارنة.'
              : 'These 40 legacy stages are not approved source-video levels. Open the original references to compare.'}
          </p>
          <button type="button" onClick={() => {setShowLevels(false);setShowSourceGallery(true);}}
            className="worm-game-button" style={{width:'100%',marginBottom:8,padding:8}}>
            🎞 {lang === 'ar' ? 'عرض خرائط الفيديو الأصلية الـ105' : 'View all 105 source-video map snapshots'}
          </button>
          <div className="worm-pack-tabs" role="tablist" aria-label={t('appleWormPacks')}>
            {APPLE_WORM_GROUPS.map((pack, index) =>
              <button key={pack.start} type="button" role="tab" aria-selected={activeGroup===index}
                className={activeGroup===index ? 'active' : ''}
                onClick={() => setActiveGroup(index)}>
                {pack.start}–{pack.end}
              </button>)}
          </div>
          <p className="worm-pack-caption" role="status">
            {t('appleWormDifficulty'+
              APPLE_WORM_CHAPTERS[activeGroup]!.difficulty[0]!.toUpperCase()+
              APPLE_WORM_CHAPTERS[activeGroup]!.difficulty.slice(1))}
          </p>
          <div className="worm-level-grid" role="tabpanel">
            {Array.from({ length: APPLE_WORM_GROUPS[activeGroup]!.end -
                APPLE_WORM_GROUPS[activeGroup]!.start + 1 },
                (_, index) => APPLE_WORM_GROUPS[activeGroup]!.start + index).map(level =>
              <button type="button" key={level} disabled={level > unlocked}
                className={level === state.level ? 'selected' : ''}
                aria-current={level === state.level ? 'step' : undefined}
                onClick={() => selectLevel(level)}>{level > unlocked ? '🔒' : level}</button>
            )}
          </div>
        </div>}
        {showSourceGallery && <AppleWormSourceGallery lang={lang === 'ar' ? 'ar' : 'en'}
          onClose={() => setShowSourceGallery(false)}/>}
        {state.phase !== 'playing' && !showSourceGallery && <div className={'worm-result ' + state.phase} role="status">
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
    </main>, document.body
  );
}
