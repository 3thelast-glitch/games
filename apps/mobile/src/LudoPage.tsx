import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from './i18n.tsx';
import { feedback, storage, type Settings } from './platform.ts';
const secureByte = (target: Uint8Array): Uint8Array => {
  target[0] = crypto.getRandomValues(new Uint8Array(1))[0]!;
  return target;
};
import {
  chooseAiToken, circuitSize, createLudo, finishProgress, isSafe,
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

export function LudoPage({onExit,settings}:{onExit:()=>void;settings:Settings}) {
  const {lang,t}=useI18n();
  const ar=lang==='ar';
  const [count,setCount]=useState<SeatCount>(4);
  const [mode,setMode]=useState<'local'|'ai'>('ai');
  const [difficulty,setDifficulty]=useState<'easy'|'medium'|'hard'>('medium');
  const [profile,setProfile]=useState<'classic'|'fast'>('classic');
  const [game,setGame]=useState<LudoState|null>(null);
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
          setGame(saved);
          setCount(saved.seatCount);
          setProfile(saved.profile);
          setMode(saved.controllers.every(c=>c==='human')?'local':'ai');
        } catch(e) {
          setNotice(e instanceof Error && e.message==='legacy-board-requires-new-match'?'legacy-save':'invalid-save');
        }
      }
    }).finally(()=>{if(alive)setLoaded(true);});
    return ()=>{alive=false;};
  },[]);
  useEffect(()=>{ if(loaded) void storage.set('ludo-offline-v2',game); },[game,loaded]);
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

  useEffect(()=>{
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
  },[game,difficulty,animating]);

  const moves=game && !animating ? legalMoves(game):[];
  const start=()=>{
    stopAnimation();stopTumble();
    const seats=Array.from({length:count},(_,i)=>mode==='local'||i===0?'human':'ai') as ('human'|'ai')[];
    const startSeat=secureSeat(count,secureByte);
    setGame(createLudo(count,seats,profile,startSeat));
    setZoom(1);setFocus({x:500,y:500});setNotice('');
  };
  const execute=(action:()=>LudoState)=>{
    try{setGame(action());setNotice('');}
    catch(e){setNotice(e instanceof Error?e.message:'invalid-action');}
  };
  /** Human roll: the die tumbles through faces, then the real roll commits. */
  const handleRoll=()=>{
    const current=gameRef.current;
    if(!current || current.phase!=='roll' || tumbling!==null || animating) return;
    if(current.controllers[current.activeSeat]!=='human') return;
    setTumbling(1+Math.floor(Math.random()*6));
    tumbleInterval.current=setInterval(()=>setTumbling(1+Math.floor(Math.random()*6)),75);
    tumbleTimer.current=setTimeout(()=>{
      stopTumble();
      execute(()=>rollLudo(current,secureDie(secureByte)));
      feedback(settingsRef.current,'move');
    },540);
  };
  const title=(s:number)=>(ar?'لاعب ':'Player ')+(s+1);
  if(!loaded) return <section className="ludo-page"><p>{t('loading')}</p></section>;
  const boardState=display ?? game;
  const eventText=!game?'':
    game.lastEvent.startsWith('captured:')?`${t('ludoCapture')} ×${game.lastEvent.slice(9)}`:
    game.lastEvent==='token-finished'?t('ludoFinish'):
    game.lastEvent==='third-six'?t('ludoThirdSix'):
    game.lastEvent==='no-move'?t('ludoNoMove'):'';
  return <section className="ludo-page page-enter" dir={ar?'rtl':'ltr'}>
    <header className="ludo-header">
      <button type="button" className="button secondary" onClick={onExit}>{t('back')}</button>
      <div><span className="eyebrow">NAQLA • LUDO</span><h1>{t('ludo')}</h1></div>
      <button type="button" className="button secondary" onClick={()=>{stopAnimation();stopTumble();setGame(null);setNotice('');}}>{t('ludoNewMatch')}</button>
    </header>
    {!game ? <div className="ludo-setup">
      <h2>{t('ludoSelectVariant')}</h2>
      <div className="ludo-variants">
        {VARIANTS.map(v=><button type="button" key={v.count} className={count===v.count?'chosen':''}
          aria-pressed={count===v.count} onClick={()=>setCount(v.count)}>
          <strong className="ludo-variant-symbol">{v.symbol}</strong><strong>{v.name}</strong>
          <span>{v.count} {t('ludoPlayers')} · {v.count*tokensPerSeat(v.count)} {t('ludoTokens')}</span>
          <span>{tokensPerSeat(v.count)} {t('ludoPerPlayer')}</span>
        </button>)}
      </div>
      <h3>{t('ludoMode')}</h3>
      <div className="ludo-options">
        <button className={mode==='ai'?'chosen':''} onClick={()=>setMode('ai')}>{t('ludoVsAi')}</button>
        <button className={mode==='local'?'chosen':''} onClick={()=>setMode('local')}>{t('ludoLocal')}</button>
      </div>
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
      <p className="small-muted">{t('ludoRules')}</p>
      <p className="ludo-offline-note">{t('ludoOnlineUnavailable')}</p>
      <button type="button" className="button primary ludo-start" onClick={start}>{t('start')}</button>
    </div> : <div className="ludo-play" data-ludo-revision={game.revision} data-ludo-phase={game.phase} data-ludo-token-count={game.tokens.length}>
      <div className="ludo-player-strip" style={{gridTemplateColumns:`repeat(${Math.min(game.seatCount,5)},minmax(0,1fr))`}}>
        {game.controllers.map((controller,s)=>{
          const place=game.placements.find(x=>x.seat===s);
          const finished=game.tokens.filter(x=>x.seat===s && x.progress===finishProgress(game.seatCount)).length;
          return <span key={s} className={game.activeSeat===s && game.phase!=='finished'?'current':''}
            style={{borderColor:LUDO_COLORS[s]}}>
            <b style={{color:LUDO_COLORS[s]}}>{LUDO_SYMBOLS[s]} {s+1}</b>
            <span>{controller==='ai'?t('aiName'):title(s)}</span>
            <small>{place?'#'+place.rank:finished+'/'+tokensPerSeat(game.seatCount)}</small>
          </span>;
        })}
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
      {game.phase==='finished' ? <div className="ludo-action-panel" aria-live="polite">
        <h2>{t('ludoResults')}</h2>
        {[...game.placements].sort((a,b)=>a.rank-b.rank).map(p=><p key={p.seat}>
          <strong>#{p.rank}</strong> {LUDO_SYMBOLS[p.seat]} {title(p.seat)} — {t('ludo'+(p.reason==='completed'?'Completed':p.reason==='resigned'?'Resigned':'Remaining'))}
        </p>)}
        <button className="button primary" onClick={start}>{t('rematch')}</button>
      </div> : <div className="ludo-action-panel" aria-live="polite">
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
        {game.phase==='move' && game.controllers[game.activeSeat]==='human' && <div className="ludo-tray" aria-label={t('ludoChooseToken')}>
          {game.tokens.filter(x=>x.seat===game.activeSeat).map(token=>{
            const m=moves.find(x=>x.tokenId===token.id);
            return <button key={token.id} disabled={!m||animating} onClick={()=>animateMove(token.id)}>
              <b>{LUDO_SYMBOLS[token.seat]} {token.slot+1}</b>
              <small>{m?(m.finishes?t('ludoFinish'):m.captures?t('ludoCapture')+' ×'+m.captures:t('ludoMove')):t('ludoUnavailable')}</small>
            </button>;
          })}
        </div>}
        {!eventText && <p className="small-muted">{game.sixes>0?t('ludoBonus'):t('ludoStatus')}</p>}
        {game.controllers[game.activeSeat]==='human' && <button type="button" className="ludo-resign" onClick={()=>{
          if(window.confirm(t('ludoResignConfirm'))) execute(()=>resignLudo(game,game.activeSeat));
        }}>{t('resign')}</button>}
      </div>}
    </div>}
    {notice && <p className="ludo-error" role="alert">{notice==='invalid-save'?t('ludoInvalidSave'):notice==='legacy-save'?t('ludoLegacySave'):notice}</p>}
  </section>;
}
