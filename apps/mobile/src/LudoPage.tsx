import { useEffect, useMemo, useState } from 'react';
import { useI18n } from './i18n.tsx';
import { storage } from './platform.ts';
const secureByte = (target: Uint8Array): Uint8Array => {
  target[0] = crypto.getRandomValues(new Uint8Array(1))[0]!;
  return target;
};
import {
  chooseAiToken, circuitSize, createLudo, finishProgress, isSafe,
  legalMoves, moveLudo, resignLudo, rollLudo, secureDie, secureSeat,
  restoreLudo, tokensPerSeat, type LudoState, type SeatCount,
} from '../../../packages/games/ludo/engine.ts';

import { buildLudoLayout, LudoBoard, LUDO_COLORS, LUDO_SYMBOLS, type Point } from './LudoBoard.tsx';

const VARIANTS: { count: SeatCount; name: string; symbol: string }[] = [
  { count: 4, name: 'Classic', symbol: '◇' },
  { count: 6, name: 'Hexa', symbol: '⬡' },
  { count: 8, name: 'Octa', symbol: '⯃' },
  { count: 10, name: 'Grand', symbol: '✺' },
];
export function LudoPage({onExit}:{onExit:()=>void}) {
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
  const layout=useMemo(()=>game?buildLudoLayout(game.seatCount):null,[game?.seatCount]);
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
  useEffect(()=>{
    if(!game || game.phase==='finished' || game.controllers[game.activeSeat]!=='ai') return;
    const revision=game.revision;
    const timer=setTimeout(()=>{
      setGame(current=>{
        if(!current || current.revision!==revision) return current;
        try {
          if(current.phase==='roll')
            return rollLudo(current,secureDie(secureByte));
          return moveLudo(current,chooseAiToken(current,difficulty,Math.random));
        }catch{return current;}
      });
    },280);
    return ()=>clearTimeout(timer);
  },[game,difficulty]);
  const moves=game ? legalMoves(game):[];
  const start=()=>{
    const seats=Array.from({length:count},(_,i)=>mode==='local'||i===0?'human':'ai') as ('human'|'ai')[];
    const startSeat=secureSeat(count,secureByte);
    setGame(createLudo(count,seats,profile,startSeat));
    setZoom(1);setFocus({x:500,y:500});setNotice('');
  };
  const execute=(action:()=>LudoState)=>{
    try{setGame(action());setNotice('');}
    catch(e){setNotice(e instanceof Error?e.message:'invalid-action');}
  };
  const title=(s:number)=>(ar?'لاعب ':'Player ')+(s+1);
  if(!loaded) return <section className="ludo-page"><p>{t('loading')}</p></section>;
  return <section className="ludo-page page-enter" dir={ar?'rtl':'ltr'}>
    <header className="ludo-header">
      <button type="button" className="button secondary" onClick={onExit}>{t('back')}</button>
      <div><span className="eyebrow">NAQLA • LUDO</span><h1>{t('ludo')}</h1></div>
      <button type="button" className="button secondary" onClick={()=>{setGame(null);setNotice('');}}>{t('ludoNewMatch')}</button>
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
      <div className="ludo-player-strip">
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
        <LudoBoard state={game} legal={moves.map(m=>m.tokenId)}
          onChoose={id=>{if(game.controllers[game.activeSeat]==='human')execute(()=>moveLudo(game,id));}}
          zoom={zoom} center={focus} />
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
          <div className="ludo-die" aria-label={t('ludoDice')}>{game.die??'?'}</div>
          <button className="button primary" disabled={game.phase!=='roll'||game.controllers[game.activeSeat]==='ai'}
            onClick={()=>execute(()=>rollLudo(game,secureDie(secureByte)))}>
            {game.phase==='roll'?t('ludoRoll'):t('ludoChooseToken')}
          </button>
        </div>
        {game.phase==='move' && game.controllers[game.activeSeat]==='human' && <div className="ludo-tray" aria-label={t('ludoChooseToken')}>
          {game.tokens.filter(x=>x.seat===game.activeSeat).map(token=>{
            const m=moves.find(x=>x.tokenId===token.id);
            return <button key={token.id} disabled={!m} onClick={()=>execute(()=>moveLudo(game,token.id))}>
              <b>{LUDO_SYMBOLS[token.seat]} {token.slot+1}</b>
              <small>{m?(m.finishes?t('ludoFinish'):m.captures?t('ludoCapture')+' ×'+m.captures:t('ludoMove')):t('ludoUnavailable')}</small>
            </button>;
          })}
        </div>}
        <p className="small-muted">{game.lastEvent==='third-six'?t('ludoThirdSix'):game.lastEvent==='no-move'?t('ludoNoMove'):game.sixes>0?t('ludoBonus'):t('ludoStatus')}</p>
        {game.controllers[game.activeSeat]==='human' && <button type="button" className="ludo-resign" onClick={()=>{
          if(window.confirm(t('ludoResignConfirm'))) execute(()=>resignLudo(game,game.activeSeat));
        }}>{t('resign')}</button>}
      </div>}
    </div>}
    {notice && <p className="ludo-error" role="alert">{notice==='invalid-save'?t('ludoInvalidSave'):notice==='legacy-save'?t('ludoLegacySave'):notice}</p>}
  </section>;
}
