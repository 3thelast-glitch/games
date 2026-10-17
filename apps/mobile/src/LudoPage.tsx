import { useEffect, useMemo, useState } from 'react';
import { useI18n } from './i18n.tsx';
import { storage } from './platform.ts';
import {
  chooseAiToken, circuitSize, createLudo, finishProgress, isSafe,
  legalMoves, moveLudo, nodeFor, resignLudo, rollLudo, secureDie, secureSeat,
  validateLudo, type LudoState, type SeatCount, type LudoToken,
} from '../../../packages/games/ludo/engine.ts';

const VARIANTS: { count: SeatCount; name: string; symbol: string }[] = [
  { count: 4, name: 'Classic', symbol: '◇' },
  { count: 6, name: 'Hexa', symbol: '⬡' },
  { count: 8, name: 'Octa', symbol: '⯃' },
  { count: 10, name: 'Grand', symbol: '✺' },
];
const COLORS = ['#D94356','#3978E8','#20A877','#F1C44B','#925CE6','#EE873D','#39BDCF','#D95BA8','#A8C94E','#DCE1EE'];
const SYMBOLS = ['●','◆','▲','■','⬟','⬡','✚','☾','✴','⬢'];
type Point = { x: number; y: number };
type Layout = { nodes: Record<string, Point>; bases: Point[]; radius: number };
function rotate(row: number, col: number, n: number): [number, number] {
  for (let i=0;i<n;i++) [row,col]=[col,14-row];
  return [row,col];
}
function buildLayout(n: SeatCount): Layout {
  const nodes: Record<string, Point> = {};
  const bases: Point[] = [];
  const C = circuitSize(n);
  if (n === 4) {
    const seed: [number, number][] = [[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8]];
    for (let s=0;s<4;s++) {
      for (let i=0;i<13;i++) {
        const [row,col] = rotate(seed[i]![0],seed[i]![1],s);
        nodes['c:'+(13*s+i)] = {x:50+60*(col+0.5),y:50+60*(row+0.5)};
      }
      for (let j=0;j<5;j++) {
        const [row,col]=rotate(7,j+1,s);
        nodes['home:'+s+':'+j]={x:50+60*(col+0.5),y:50+60*(row+0.5)};
      }
      const [r,c] = rotate(7,6,s);
      nodes['finish:'+s] = {x:50+60*(c+0.5),y:50+60*(r+0.5)};
      const [br,bc] = rotate(2.5,2.5,s);
      bases.push({x:50+60*(bc+0.5),y:50+60*(br+0.5)});
    }
  } else {
    const angle = (i: number) => -Math.PI/2 + 2*Math.PI*i/C;
    const polar = (r: number, a: number): Point => ({x:500+r*Math.cos(a),y:500+r*Math.sin(a)});
    for(let i=0;i<C;i++) nodes['c:'+i]=polar(310,angle(i));
    for(let s=0;s<n;s++){
      const a=angle(13*s+C-2);
      for(let j=0;j<5;j++) nodes['home:'+s+':'+j]=polar(310-(j+1)*35,a);
      nodes['finish:'+s]=polar(105,a);
      bases.push(polar(420,angle(13*s+5)));
    }
  }
  const offsets = [[-22,-22],[22,-22],[-22,22],[22,22]];
  bases.forEach((base,seat) => offsets.forEach(([dx,dy],slot) => {
    nodes['base:'+seat+':'+slot]={x:base.x+dx!,y:base.y+dy!};
  }));
  return {nodes,bases,radius:n===4?23:Math.min(16,450/C*3)};
}
function tokenPosition(state: LudoState, token: LudoToken, nodes: Record<string,Point>): Point | null {
  if(token.progress === -2) return null;
  const key=nodeFor(state,token);
  return nodes[key] ?? null;
}
function Board({ state, legal, onChoose, zoom, center }:{
  state:LudoState; legal:readonly string[]; onChoose:(id:string)=>void; zoom:number; center:Point;
}) {
  const { lang }=useI18n();
  const layout=useMemo(()=>buildLayout(state.seatCount),[state.seatCount]);
  const C=circuitSize(state.seatCount);
  const points=layout.nodes;
  const size=1000/zoom;
  const bounds=[center.x-size/2,center.y-size/2,size,size].join(' ');
  const used = new Map<string,number>();
  const tokens=state.tokens.map(token=>{
    const key=nodeFor(state,token);
    const offset=used.get(key) ?? 0;
    used.set(key,offset+1);
    return {token,key,offset,point:tokenPosition(state,token,points)};
  });
  const sides=state.seatCount;
  const polygon=Array.from({length:sides},(_,i)=>{
    const a=-Math.PI/2+(i+.5)*2*Math.PI/sides;
    return (500+476*Math.cos(a))+','+(500+476*Math.sin(a));
  }).join(' ');
  return <svg className="ludo-board" viewBox={bounds} role="img" aria-label={lang==='ar'?'لوحة لودو، اختر القطع من قائمة الحركات أسفلها':'Ludo board; select a token from the move tray below'} dir="ltr">
    <defs>
      <radialGradient id="ludo-shell"><stop stopColor="#33425C"/><stop offset="1" stopColor="#101A31"/></radialGradient>
      <radialGradient id="ludo-center"><stop stopColor="#314462"/><stop offset="1" stopColor="#121B2E"/></radialGradient>
    </defs>
    {sides===4 ? <rect x="17" y="17" width="966" height="966" rx="45" fill="url(#ludo-shell)" stroke="#C8A76A" strokeWidth="9" />
      : <polygon points={polygon} fill="url(#ludo-shell)" stroke="#C8A76A" strokeWidth="8" />}
    {layout.bases.map((base,s)=> <g key={'base'+s}>
      <circle cx={base.x} cy={base.y} r={sides===4?123:62} fill={COLORS[s]} fillOpacity=".14" stroke={COLORS[s]} strokeWidth="3" />
      <text x={base.x} y={base.y-(sides===4?75:40)} fontSize={sides===4?26:21} textAnchor="middle" fill="#fff" fontWeight="700">{s+1} {SYMBOLS[s]}</text>
    </g>)}
    {Array.from({length:C},(_,i)=> {
      const p=points['c:'+i]!;
      const entry=i%13===0;
      const safe=isSafe(sides,i);
      return <g key={'c'+i}>
        <circle cx={p.x} cy={p.y} r={layout.radius} fill={entry?COLORS[i/13]:'#F3EBDD'} stroke={safe?'#D0AF65':'#6C7785'} strokeWidth={safe?4:1.4} />
        {safe && <text x={p.x} y={p.y+layout.radius*.34} textAnchor="middle" fontSize={layout.radius*1.2} fill="#182237">✦</text>}
      </g>;
    })}
    {layout.bases.map((_,s)=> <g key={'home'+s}>
      {Array.from({length:6},(_,j)=>{
        const p=points[j===5?'finish:'+s:'home:'+s+':'+j]!;
        return <circle key={j} cx={p.x} cy={p.y} r={layout.radius*(j===5?1.2:1)} fill={COLORS[s]} fillOpacity=".75" stroke="#F3EBDD" strokeWidth="2" />;
      })}
    </g>)}
    <circle cx="500" cy="500" r={sides===4?38:58} fill="url(#ludo-center)" stroke="#C8A76A" strokeWidth="4" />
    <text x="500" y="509" textAnchor="middle" fontWeight="800" fontSize={sides===4?18:22} fill="#F3EBDD">NAQLA</text>
    {tokens.map(({token,key,offset,point}) => {
      if(!point) return null;
      const inStack=(used.get(key) ?? 0)>1 && token.progress>=0;
      const x=point.x+(inStack?(offset%3-1)*layout.radius*.35:0);
      const y=point.y+(inStack?(Math.floor(offset/3)-.5)*layout.radius*.35:0);
      const selectable=legal.includes(token.id);
      return <g key={token.id} className={selectable?'ludo-legal-pawn':''}>
        {selectable && <circle cx={x} cy={y} r={layout.radius*.96+7} fill="none" stroke="#83DBFF" strokeWidth="4" />}
        <circle cx={x} cy={y+4} r={layout.radius*.83} fill="#020611" opacity=".5" />
        <circle cx={x} cy={y} r={layout.radius*.78} fill={COLORS[token.seat]} stroke="#fff" strokeWidth="2.5" />
        <circle cx={x-layout.radius*.19} cy={y-layout.radius*.18} r={layout.radius*.21} fill="#fff" opacity=".35" />
        <text x={x} y={y+layout.radius*.25} textAnchor="middle" fontSize={Math.max(13,layout.radius*.87)} fill="#081124" fontWeight="900">{token.slot+1}</text>
        {selectable && <circle cx={x} cy={y} r={layout.radius*1.1} fill="transparent" role="button"
          aria-label={'Token '+(token.slot+1)} onClick={()=>onChoose(token.id)} />}
      </g>;
    })}
  </svg>;
}
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
  const layout=useMemo(()=>game?buildLayout(game.seatCount):null,[game?.seatCount]);
  useEffect(()=>{
    let alive=true;
    void storage.get<LudoState|null>('ludo-offline-v1',null).then(saved=>{
      if(!alive) return;
      if(saved) {
        try {validateLudo(saved);setGame(saved);} catch {setNotice('invalid-save');}
      }
    }).finally(()=>{if(alive)setLoaded(true);});
    return ()=>{alive=false;};
  },[]);
  useEffect(()=>{ if(loaded) void storage.set('ludo-offline-v1',game); },[game,loaded]);
  useEffect(()=>{
    if(!game || game.phase==='finished' || game.controllers[game.activeSeat]!=='ai') return;
    const revision=game.revision;
    const timer=setTimeout(()=>{
      setGame(current=>{
        if(!current || current.revision!==revision) return current;
        try {
          if(current.phase==='roll')
            return rollLudo(current,secureDie(array=>crypto.getRandomValues(array)));
          return moveLudo(current,chooseAiToken(current,difficulty,Math.random));
        }catch{return current;}
      });
    },280);
    return ()=>clearTimeout(timer);
  },[game,difficulty]);
  const moves=game ? legalMoves(game):[];
  const start=()=>{
    const seats=Array.from({length:count},(_,i)=>mode==='local'||i===0?'human':'ai') as ('human'|'ai')[];
    const startSeat=secureSeat(count,a=>crypto.getRandomValues(a));
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
          <span>{v.count} {t('ludoPlayers')} · {4*v.count} {t('ludoTokens')}</span>
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
    </div> : <div className="ludo-play">
      <div className="ludo-player-strip">
        {game.controllers.map((controller,s)=>{
          const place=game.placements.find(x=>x.seat===s);
          const finished=game.tokens.filter(x=>x.seat===s && x.progress===finishProgress(game.seatCount)).length;
          return <span key={s} className={game.activeSeat===s && game.phase!=='finished'?'current':''}
            style={{borderColor:COLORS[s]}}>
            <b style={{color:COLORS[s]}}>{SYMBOLS[s]} {s+1}</b>
            <span>{controller==='ai'?t('aiName'):title(s)}</span>
            <small>{place?'#'+place.rank:finished+'/4'}</small>
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
        <Board state={game} legal={moves.map(m=>m.tokenId)}
          onChoose={id=>{if(game.controllers[game.activeSeat]==='human')execute(()=>moveLudo(game,id));}}
          zoom={zoom} center={focus} />
      </div>
      {game.phase==='finished' ? <div className="ludo-action-panel" aria-live="polite">
        <h2>{t('ludoResults')}</h2>
        {[...game.placements].sort((a,b)=>a.rank-b.rank).map(p=><p key={p.seat}>
          <strong>#{p.rank}</strong> {SYMBOLS[p.seat]} {title(p.seat)} — {t('ludo'+(p.reason==='completed'?'Completed':p.reason==='resigned'?'Resigned':'Remaining'))}
        </p>)}
        <button className="button primary" onClick={start}>{t('rematch')}</button>
      </div> : <div className="ludo-action-panel" aria-live="polite">
        <strong className="ludo-current" style={{color:COLORS[game.activeSeat]}}>
          {SYMBOLS[game.activeSeat]} {title(game.activeSeat)} · {game.controllers[game.activeSeat]==='ai'?t('aiName'):t('yourTurn')}
        </strong>
        <div className="ludo-dice-line">
          <div className="ludo-die" aria-label={t('ludoDice')}>{game.die??'?'}</div>
          <button className="button primary" disabled={game.phase!=='roll'||game.controllers[game.activeSeat]==='ai'}
            onClick={()=>execute(()=>rollLudo(game,secureDie(a=>crypto.getRandomValues(a))))}>
            {game.phase==='roll'?t('ludoRoll'):t('ludoChooseToken')}
          </button>
        </div>
        {game.phase==='move' && game.controllers[game.activeSeat]==='human' && <div className="ludo-tray" aria-label={t('ludoChooseToken')}>
          {game.tokens.filter(x=>x.seat===game.activeSeat).map(token=>{
            const m=moves.find(x=>x.tokenId===token.id);
            return <button key={token.id} disabled={!m} onClick={()=>execute(()=>moveLudo(game,token.id))}>
              <b>{SYMBOLS[token.seat]} {token.slot+1}</b>
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
    {notice && <p className="ludo-error" role="alert">{notice==='invalid-save'?t('ludoInvalidSave'):notice}</p>}
  </section>;
}
