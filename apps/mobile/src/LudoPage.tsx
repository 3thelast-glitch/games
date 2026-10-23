import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from './i18n.tsx';
import { feedback, storage, type Settings } from './platform.ts';
import { enterFullscreenOnlyGame, leaveFullscreenOnlyGame } from './immersive-game.ts';
const secureByte = (target: Uint8Array): Uint8Array => {
  target[0] = crypto.getRandomValues(new Uint8Array(1))[0]!;
  return target;
};
import {
  chooseAiToken, circuitSize, createLudo, isSafe,
  legalMoves, moveLudo, nodeFor, resignLudo, rollLudo, routeFor, secureDie, secureSeat,
  restoreLudo, tokensPerSeat, type LudoState, type SeatCount,
} from '../../../packages/games/ludo/engine.ts';

import { buildLudoLayout, LudoBoard, LUDO_COLORS, LUDO_SYMBOLS, type Point } from './LudoBoard.tsx';

const VARIANTS: { count: SeatCount; name: string; symbol: string }[] = [
  { count: 4, name: 'Classic', symbol: '◇' },
  { count: 6, name: 'Hexa', symbol: '⬡' },
  { count: 8, name: 'Octa', symbol: '⯃' },
  { count: 10, name: 'Grand', symbol: '✺' },
];

/** Pip cells (3x3 grid indexes) for each die face. */
const PIPS: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

function DieFace({ value, tumbling, spinKey, label }: {
  value: number | null; tumbling: boolean; spinKey: number; label: string;
}) {
  return <div key={tumbling ? 'tumbling' : spinKey}
    className={'ludo-die' + (tumbling ? ' tumbling' : '')} aria-label={label}>
    {value !== null && PIPS[value]
      ? <span className="ludo-die-pips" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) =>
            <i key={i} className={PIPS[value]!.includes(i) ? 'pip on' : 'pip'} />)}
        </span>
      : <span className="ludo-die-q" aria-hidden="true">?</span>}
    <span className="ludo-sr">{value ?? '?'}</span>
  </div>;
}

/** Accurate static board preview for one variant, straight from the engine. */
function BoardPreview({ count }: { count: SeatCount }) {
  const demo = useMemo(() => createLudo(count), [count]);
  return <div className="ludo-preview" aria-hidden="true">
    <LudoBoard state={demo} legal={[]} onChoose={() => {}} zoom={1} center={{ x: 500, y: 500 }} />
  </div>;
}

interface AnimFrame { state: LudoState; delay: number }

/**
 * Builds the in-between board states for one committed move, without touching
 * the engine: the moving pawn steps cell by cell along its real route, then
 * each captured pawn travels back along its own route into its base. The
 * committed final state is applied only after the last frame.
 */
function buildMoveFrames(before: LudoState, after: LudoState, tokenId: string): AnimFrame[] {
  const move = legalMoves(before).find(m => m.tokenId === tokenId);
  if (!move) return [];
  const frames: AnimFrame[] = [];
  const withProgress = (base: LudoState, overrides: Map<string, number>): LudoState => ({
    ...base,
    tokens: base.tokens.map(t => overrides.has(t.id) ? { ...t, progress: overrides.get(t.id)! } : { ...t }),
  });
  const stepMs = move.to - Math.max(move.from, 0) > 4 ? 95 : 140;
  let current = before;
  if (move.from === -1) {
    current = withProgress(current, new Map([[tokenId, 0]]));
    frames.push({ state: current, delay: 170 });
  } else {
    for (let p = move.from + 1; p <= move.to; p++) {
      current = withProgress(current, new Map([[tokenId, p]]));
      frames.push({ state: current, delay: stepMs });
    }
  }
  // Captured pawns: enemies that stood on the destination travel home.
  const victims = before.tokens.filter(t =>
    t.seat !== before.activeSeat && t.progress >= 0 &&
    nodeFor(before, t) === move.destination &&
    after.tokens.find(x => x.id === t.id)?.progress === -1);
  for (const victim of victims) {
    const at = routeFor(before.seatCount, victim.seat).indexOf(move.destination);
    for (let p = at - 1; p >= 0; p--) {
      current = withProgress(current, new Map([[victim.id, p]]));
      frames.push({ state: current, delay: 42 });
    }
    current = withProgress(current, new Map([[victim.id, -1]]));
    frames.push({ state: current, delay: 120 });
  }
  return frames;
}

type Screen = 'home' | 'mode' | 'count' | 'config' | 'game';
type Overlay = 'none' | 'howto' | 'settings' | 'pause';

export function LudoPage({onExit,settings,onSettingsChange}:{onExit:()=>void;settings:Settings;onSettingsChange?:(patch:Partial<Settings>)=>void}) {
  const {lang,t}=useI18n();
  const ar=lang==='ar';
  const [screen,setScreen]=useState<Screen>('home');
  const [overlay,setOverlay]=useState<Overlay>('none');
  const [count,setCount]=useState<SeatCount>(4);
  const [mode,setMode]=useState<'local'|'ai'>('ai');
  const [difficulty,setDifficulty]=useState<'easy'|'medium'|'hard'>('medium');
  const [profile,setProfile]=useState<'classic'|'fast'>('classic');
  const [game,setGame]=useState<LudoState|null>(null);
  const [savedGame,setSavedGame]=useState<LudoState|null>(null);
  const [loaded,setLoaded]=useState(false);
  const [zoom,setZoom]=useState(1);
  const [focus,setFocus]=useState<Point>({x:500,y:500});
  const [notice,setNotice]=useState('');
  const [display,setDisplay]=useState<LudoState|null>(null);
  const [animating,setAnimating]=useState(false);
  const [tumbling,setTumbling]=useState<number|null>(null);
  const settingsRef=useRef(settings); settingsRef.current=settings;
  const gameRef=useRef<LudoState|null>(null); gameRef.current=game;
  const animTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const tumbleTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const tumbleInterval=useRef<ReturnType<typeof setInterval>|null>(null);
  const layout=useMemo(()=>game?buildLudoLayout(game.seatCount):null,[game?.seatCount]);

  // Immersive fullscreen entry, mirroring the other standalone games:
  // no orientation lock (Ludo supports portrait and landscape).
  useEffect(()=>{
    enterFullscreenOnlyGame('ludo');
    return ()=>{ void leaveFullscreenOnlyGame(); };
  },[]);

  const stopAnimation=()=>{
    if(animTimer.current)clearTimeout(animTimer.current);
    animTimer.current=null;
    setDisplay(null);setAnimating(false);
  };
  const stopTumble=()=>{
    if(tumbleTimer.current)clearTimeout(tumbleTimer.current);
    if(tumbleInterval.current)clearInterval(tumbleInterval.current);
    tumbleTimer.current=null;tumbleInterval.current=null;
    setTumbling(null);
  };
  useEffect(()=>()=>{stopAnimation();stopTumble();},[]);

  // Load the saved match for the Continue option; never auto-enter it.
  useEffect(()=>{
    let alive=true;
    void Promise.all([
      storage.get<unknown>('ludo-offline-v2',null),
      storage.get<unknown>('ludo-offline-v1',null),
    ]).then(([current,legacy])=>{
      if(!alive) return;
      if(current || legacy) {
        try {
          const saved=restoreLudo(current ?? legacy);
          setSavedGame(saved);
        } catch(e) {
          setNotice(e instanceof Error && e.message==='legacy-board-requires-new-match'?'legacy-save':'invalid-save');
        }
      }
    }).finally(()=>{if(alive)setLoaded(true);});
    return ()=>{alive=false;};
  },[]);
  // Persist only real match states; browsing menus never touches the save.
  useEffect(()=>{ if(game) void storage.set('ludo-offline-v2',game); },[game]);
  useEffect(()=>{ if(game) setSavedGame(game); },[game]);
  useEffect(()=>{
    let live=true;
    void storage.get<'easy'|'medium'|'hard'>('ludo-ai-level-v1','medium').then(level=>{
      if(live && ['easy','medium','hard'].includes(level)) setDifficulty(level);
    });
    return ()=>{live=false;};
  },[]);
  useEffect(()=>{if(loaded) void storage.set('ludo-ai-level-v1',difficulty);},[loaded,difficulty]);

  /** Commits a move only after its step-by-step frames have played. */
  const animateMove=(tokenId:string)=>{
    const before=gameRef.current;
    if(!before || before.phase!=='move') return;
    let after:LudoState;
    try { after=moveLudo(before,tokenId); } catch { return; }
    const frames=buildMoveFrames(before,after,tokenId);
    const placedBefore=before.placements.length;
    if(!frames.length){ setGame(after); return; }
    setAnimating(true);
    feedback(settingsRef.current,'move');
    let index=0;
    const step=()=>{
      if(index<frames.length){
        const frame=frames[index++]!;
        setDisplay(frame.state);
        animTimer.current=setTimeout(step,frame.delay);
      } else {
        animTimer.current=null;
        setDisplay(null);setAnimating(false);
        setGame(after);
        if(after.phase==='finished' || after.placements.length>placedBefore)
          feedback(settingsRef.current,'win');
      }
    };
    step();
  };

  // AI turns run only while the match screen is actually showing.
  useEffect(()=>{
    if(screen!=='game' || overlay!=='none') return;
    if(!game || game.phase==='finished' || animating) return;
    if(game.controllers[game.activeSeat]!=='ai') return;
    const revision=game.revision;
    const timer=setTimeout(()=>{
      const current=gameRef.current;
      if(!current || current.revision!==revision) return;
      try {
        if(current.phase==='roll'){
          setGame(rollLudo(current,secureDie(secureByte)));
          feedback(settingsRef.current,'move');
        } else {
          animateMove(chooseAiToken(current,difficulty,Math.random));
        }
      }catch{/* keep current state */}
    },340);
    return ()=>clearTimeout(timer);
  },[game,difficulty,animating,screen,overlay]);

  const moves=game && !animating ? legalMoves(game):[];
  const hasUnfinishedSave=!!savedGame && savedGame.phase!=='finished';
  const start=(force=false)=>{
    const current=gameRef.current;
    const wouldReplace=(current && current.phase!=='finished' && current.revision>0) || hasUnfinishedSave;
    if(wouldReplace && !force && !window.confirm(t('ludoConfirmReplace'))) return;
    stopAnimation();stopTumble();
    const seats=Array.from({length:count},(_,i)=>mode==='local'||i===0?'human':'ai') as ('human'|'ai')[];
    const startSeat=secureSeat(count,secureByte);
    setGame(createLudo(count,seats,profile,startSeat));
    setZoom(1);setFocus({x:500,y:500});setNotice('');
    setOverlay('none');
    setScreen('game');
  };
  const continueGame=()=>{
    if(!savedGame) return;
    stopAnimation();stopTumble();
    setGame(savedGame);
    setCount(savedGame.seatCount);
    setProfile(savedGame.profile);
    setMode(savedGame.controllers.every(c=>c==='human')?'local':'ai');
    setZoom(1);setFocus({x:500,y:500});setNotice('');
    setOverlay('none');
    setScreen('game');
  };
  const execute=(action:()=>LudoState)=>{
    try{setGame(action());setNotice('');}
    catch(e){setNotice(e instanceof Error?e.message:'invalid-action');}
  };
  /**
   * Human roll: the result is generated by the secure die first; the tumble
   * animation only presents it and can never change it.
   */
  const handleRoll=()=>{
    const current=gameRef.current;
    if(!current || current.phase!=='roll' || tumbling!==null || animating) return;
    if(current.controllers[current.activeSeat]!=='human') return;
    const dieValue=secureDie(secureByte);
    setTumbling(1+Math.floor(Math.random()*6));
    tumbleInterval.current=setInterval(()=>setTumbling(1+Math.floor(Math.random()*6)),75);
    tumbleTimer.current=setTimeout(()=>{
      stopTumble();
      execute(()=>rollLudo(current,dieValue));
      feedback(settingsRef.current,'move');
    },540);
  };
  const title=(s:number)=>(ar?'لاعب ':'Player ')+(s+1);
  const boardState=display ?? game;
  const eventText=!game?'':
    game.lastEvent.startsWith('captured:')?`${t('ludoCapture')} ×${game.lastEvent.slice(9)}`:
    game.lastEvent==='token-finished'?t('ludoFinish'):
    game.lastEvent==='third-six'?t('ludoThirdSix'):
    game.lastEvent==='no-move'?t('ludoNoMove'):'';
  const variantName=(c:SeatCount)=>VARIANTS.find(v=>v.count===c)?.name ?? '';

  const overlays=<>
    {overlay==='howto' && <div className="ludo-overlay" role="dialog" aria-modal="true" aria-label={t('ludoHowToPlay')}>
      <div className="ludo-sheet">
        <h2>{t('ludoHowToPlay')}</h2>
        <p>{t('ludoRules')}</p>
        <ul className="ludo-howto-list">
          <li>{t('ludoHowToRoll')}</li>
          <li>{t('ludoHowToSafe')}</li>
          <li>{t('ludoHowToZoom')}</li>
        </ul>
        <button type="button" className="button primary" onClick={()=>setOverlay(screen==='game'?'pause':'none')}>{t('back')}</button>
      </div>
    </div>}
    {overlay==='settings' && <div className="ludo-overlay" role="dialog" aria-modal="true" aria-label={t('ludoSettings')}>
      <div className="ludo-sheet">
        <h2>{t('ludoSettings')}</h2>
        <div className="ludo-setting-row">
          <span>{t('ludoSound')}</span>
          <button type="button" aria-pressed={settings.sound} disabled={!onSettingsChange}
            onClick={()=>onSettingsChange?.({sound:!settings.sound})}>{settings.sound?t('ludoOn'):t('ludoOff')}</button>
        </div>
        <div className="ludo-setting-row">
          <span>{t('ludoHaptics')}</span>
          <button type="button" aria-pressed={settings.haptics} disabled={!onSettingsChange}
            onClick={()=>onSettingsChange?.({haptics:!settings.haptics})}>{settings.haptics?t('ludoOn'):t('ludoOff')}</button>
        </div>
        <button type="button" className="button primary" onClick={()=>setOverlay(screen==='game'?'pause':'none')}>{t('back')}</button>
      </div>
    </div>}
    {overlay==='pause' && screen==='game' && <div className="ludo-overlay" role="dialog" aria-modal="true" aria-label={t('ludoPause')}>
      <div className="ludo-sheet ludo-pause-sheet">
        <h2>{t('ludoPause')}</h2>
        <button type="button" className="button primary" onClick={()=>setOverlay('none')}>{t('ludoResume')}</button>
        <button type="button" className="button secondary" onClick={()=>setOverlay('settings')}>{t('ludoSettings')}</button>
        <button type="button" className="button secondary" onClick={()=>setOverlay('howto')}>{t('ludoHowToPlay')}</button>
        <button type="button" className="button secondary" onClick={()=>{
          if(window.confirm(t('ludoConfirmRestart'))){ setOverlay('none'); start(true); }
        }}>{t('ludoRestart')}</button>
        <button type="button" className="button secondary" onClick={()=>{stopAnimation();stopTumble();setOverlay('none');setScreen('home');}}>{t('ludoMainMenu')}</button>
        <button type="button" className="button secondary ludo-exit-btn" onClick={onExit}>{t('ludoExitToNaqla')}</button>
      </div>
    </div>}
  </>;

  if(!loaded) return createPortal(<section className="ludo-page ludo-immersive" dir={ar?'rtl':'ltr'}><p className="ludo-loading">{t('loading')}</p></section>,document.body);

  return createPortal(<section className="ludo-page ludo-immersive" dir={ar?'rtl':'ltr'}>
    {screen==='home' && <div className="ludo-screen ludo-home">
      <div className="ludo-home-hero">
        <span className="ludo-deco-die d1" aria-hidden="true"><DieGlyph value={5}/></span>
        <span className="ludo-deco-die d2" aria-hidden="true"><DieGlyph value={3}/></span>
        <div className="ludo-hero-board"><BoardPreview count={4}/></div>
        <h1 className="ludo-home-title">{t('ludo')}</h1>
        <p className="ludo-home-tag">{t('ludoTag')}</p>
      </div>
      <nav className="ludo-home-menu" aria-label={t('ludo')}>
        <button type="button" className="ludo-menu-btn primary ludo-home-play" onClick={()=>setScreen('mode')}>
          <span className="ludo-menu-icon">▶</span>{t('ludoPlay')}
        </button>
        {hasUnfinishedSave && <button type="button" className="ludo-menu-btn ludo-home-continue" onClick={continueGame}>
          <span className="ludo-menu-icon">⏵</span>{t('ludoContinue')}
          <small>{variantName(savedGame!.seatCount)} · {savedGame!.seatCount} {t('ludoPlayers')}</small>
        </button>}
        <button type="button" className="ludo-menu-btn" onClick={()=>setOverlay('howto')}>
          <span className="ludo-menu-icon">?</span>{t('ludoHowToPlay')}
        </button>
        <button type="button" className="ludo-menu-btn" onClick={()=>setOverlay('settings')}>
          <span className="ludo-menu-icon">⚙</span>{t('ludoSettings')}
        </button>
        <button type="button" className="ludo-menu-btn ghost" onClick={onExit}>
          <span className="ludo-menu-icon">←</span>{t('ludoExitToNaqla')}
        </button>
      </nav>
      <p className="ludo-offline-note">{t('ludoOnlineUnavailable')}</p>
      {notice && <p className="ludo-error" role="alert">{notice==='invalid-save'?t('ludoInvalidSave'):notice==='legacy-save'?t('ludoLegacySave'):notice}</p>}
    </div>}

    {screen==='mode' && <div className="ludo-screen ludo-flow-screen">
      <header className="ludo-flow-head">
        <button type="button" className="button secondary" onClick={()=>setScreen('home')}>{t('back')}</button>
        <h2>{t('ludoSelectMode')}</h2><span className="ludo-flow-spacer"/>
      </header>
      <div className="ludo-mode-cards">
        <button type="button" className="ludo-mode-card" onClick={()=>{setMode('ai');setScreen('count');}}>
          <strong className="ludo-mode-symbol">🤖</strong>
          <strong>{t('ludoVsAi')}</strong>
          <span>{t('ludoVsAiDesc')}</span>
        </button>
        <button type="button" className="ludo-mode-card" onClick={()=>{setMode('local');setScreen('count');}}>
          <strong className="ludo-mode-symbol">👥</strong>
          <strong>{t('ludoLocal')}</strong>
          <span>{t('ludoLocalDesc')}</span>
        </button>
        <button type="button" className="ludo-mode-card" disabled aria-disabled="true">
          <strong className="ludo-mode-symbol">🌐</strong>
          <strong>{t('ludoOnline')}</strong>
          <span>{t('ludoOnlineDesc')}</span>
          <em className="ludo-soon">{t('ludoOnlineSoon')}</em>
        </button>
      </div>
    </div>}

    {screen==='count' && <div className="ludo-screen ludo-flow-screen">
      <header className="ludo-flow-head">
        <button type="button" className="button secondary" onClick={()=>setScreen('mode')}>{t('back')}</button>
        <h2>{t('ludoSelectPlayers')}</h2><span className="ludo-flow-spacer"/>
      </header>
      <div className="ludo-count-grid">
        {VARIANTS.map(v=><button type="button" key={v.count}
          className={'ludo-count-card'+(count===v.count?' chosen':'')}
          aria-pressed={count===v.count}
          onClick={()=>setCount(v.count)}>
          <BoardPreview count={v.count}/>
          <strong>{v.name}</strong>
          <span>{v.count} {t('ludoPlayers')} · {tokensPerSeat(v.count)} {t('ludoPerPlayer')}</span>
        </button>)}
      </div>
      <button type="button" className="button primary ludo-flow-next" onClick={()=>setScreen('config')}>{t('ludoMatchSettings')}</button>
    </div>}

    {screen==='config' && <div className="ludo-screen ludo-flow-screen">
      <header className="ludo-flow-head">
        <button type="button" className="button secondary" onClick={()=>setScreen('count')}>{t('back')}</button>
        <h2>{t('ludoMatchSettings')}</h2><span className="ludo-flow-spacer"/>
      </header>
      <div className="ludo-config-card">
        <div className="ludo-config-preview"><BoardPreview count={count}/></div>
        {mode==='ai' && <label className="ludo-field">{t('difficulty')}
          <select value={difficulty} onChange={e=>setDifficulty(e.target.value as typeof difficulty)}>
            <option value="easy">{t('easy')}</option><option value="medium">{t('medium')}</option><option value="hard">{t('hard')}</option>
          </select>
        </label>}
        <label className="ludo-field">{t('ludoRuleset')}
          <select value={profile} onChange={e=>setProfile(e.target.value as typeof profile)}>
            <option value="classic">{t('ludoFull')}</option><option value="fast">{t('ludoFast')}</option>
          </select>
        </label>
        <div className="ludo-field ludo-colors-field">
          <span>{t('ludoPlayerColors')}</span>
          <span className="ludo-color-dots">
            {Array.from({length:count},(_,s)=><i key={s} style={{background:LUDO_COLORS[s]}} title={title(s)}/>)}
          </span>
        </div>
        <div className="ludo-summary">
          <h3>{t('ludoSummary')}</h3>
          <p>{variantName(count)} · {count} {t('ludoPlayers')} · {tokensPerSeat(count)} {t('ludoPerPlayer')}</p>
          <p>{mode==='ai'?t('ludoVsAi'):t('ludoLocal')}{mode==='ai'?' · '+t(difficulty):''} · {profile==='classic'?t('ludoFull'):t('ludoFast')}</p>
        </div>
        <button type="button" className="button primary ludo-start" onClick={()=>start()}>{t('ludoStartGame')}</button>
      </div>
    </div>}

    {screen==='game' && game && (game.phase==='finished' ? <div className="ludo-screen ludo-results-screen">
      <div className="ludo-confetti" aria-hidden="true">{Array.from({length:14},(_,i)=><i key={i}/>)}</div>
      <p className="ludo-trophy" aria-hidden="true">🏆</p>
      <h2>{t('ludoResults')}</h2>
      {(()=>{ const winner=game.placements.find(p=>p.rank===1); return winner?<p className="ludo-winner">
        <b style={{color:LUDO_COLORS[winner.seat]}}>{LUDO_SYMBOLS[winner.seat]}</b> {t('ludoWinner')}: {title(winner.seat)}
      </p>:null; })()}
      <div className="ludo-standings">
        {[...game.placements].sort((a,b)=>a.rank-b.rank).map(p=><p key={p.seat}>
          <strong>#{p.rank}</strong> <b style={{color:LUDO_COLORS[p.seat]}}>{LUDO_SYMBOLS[p.seat]}</b> {title(p.seat)} — {t('ludo'+(p.reason==='completed'?'Completed':p.reason==='resigned'?'Resigned':'Remaining'))}
        </p>)}
      </div>
      <div className="ludo-results-actions">
        <button type="button" className="button primary" onClick={()=>start(true)}>{t('ludoPlayAgain')}</button>
        <button type="button" className="button secondary" onClick={()=>setScreen('mode')}>{t('ludoChangeMode')}</button>
        <button type="button" className="button secondary" onClick={()=>setScreen('home')}>{t('ludoMainMenu')}</button>
        <button type="button" className="button secondary" onClick={onExit}>{t('ludoExitToNaqla')}</button>
      </div>
    </div> : <div className="ludo-play" data-ludo-revision={game.revision} data-ludo-phase={game.phase} data-ludo-token-count={game.tokens.length}>
      <div className="ludo-game-topbar">
        <button type="button" className="ludo-icon-btn" aria-label={t('ludoPause')} onClick={()=>setOverlay('pause')}>❚❚</button>
        <span className="ludo-game-label">{variantName(game.seatCount)} · {game.seatCount} {t('ludoPlayers')}</span>
        <button type="button" className="ludo-icon-btn" aria-label={t('ludoMainMenu')} onClick={()=>{stopAnimation();stopTumble();setScreen('home');}}>⌂</button>
      </div>
      <div className="ludo-board-area">
        <div className="ludo-toolbar">
          <button onClick={()=>setZoom(z=>Math.max(1,z/1.35))} aria-label={t('ludoZoomOut')}>−</button>
          <button onClick={()=>{setZoom(1);setFocus({x:500,y:500});}}>{t('ludoOverview')}</button>
          <button onClick={()=>{setZoom(2);setFocus(layout?.bases[game.activeSeat]??{x:500,y:500});}}>{t('ludoFocus')}</button>
          <button onClick={()=>setZoom(z=>Math.min(4,z*1.35))} aria-label={t('ludoZoomIn')}>+</button>
        </div>
        {boardState && <LudoBoard state={boardState} legal={animating?[]:moves.map(m=>m.tokenId)}
          onChoose={id=>{if(game.controllers[game.activeSeat]==='human' && !animating)animateMove(id);}}
          zoom={zoom} center={focus} />}
      </div>
      <div className="ludo-action-panel" aria-live="polite">
        <strong className="ludo-current" style={{color:LUDO_COLORS[game.activeSeat]}}>
          {LUDO_SYMBOLS[game.activeSeat]} {title(game.activeSeat)} · {game.controllers[game.activeSeat]==='ai'?t('aiName'):t('yourTurn')}
        </strong>
        <div className="ludo-dice-line">
          <DieFace value={tumbling ?? game.die} tumbling={tumbling!==null}
            spinKey={game.revision} label={t('ludoDice')} />
          <button className="button primary" disabled={game.phase!=='roll'||game.controllers[game.activeSeat]==='ai'||tumbling!==null||animating}
            onClick={handleRoll}>
            {game.phase==='roll'?t('ludoRoll'):t('ludoChooseToken')}
          </button>
        </div>
        {eventText && <p className="ludo-event" key={game.revision} role="status">{eventText}</p>}
        {!eventText && <p className="small-muted">{game.sixes>0?t('ludoBonus'):t('ludoStatus')}</p>}
        {game.controllers[game.activeSeat]==='human' && <button type="button" className="ludo-resign" onClick={()=>{
          if(window.confirm(t('ludoResignConfirm'))) execute(()=>resignLudo(game,game.activeSeat));
        }}>{t('resign')}</button>}
      </div>
      {notice && <p className="ludo-error" role="alert">{notice==='invalid-save'?t('ludoInvalidSave'):notice==='legacy-save'?t('ludoLegacySave'):notice}</p>}
    </div>)}
    {overlays}
  </section>,document.body);
}

/** Small static pip glyph used for the home screen's decorative dice. */
function DieGlyph({ value }: { value: number }) {
  return <span className="ludo-deco-pips" aria-hidden="true">
    {Array.from({ length: 9 }, (_, i) =>
      <i key={i} className={PIPS[value]!.includes(i) ? 'pip on' : 'pip'} />)}
  </span>;
}
