import { useEffect, useMemo, useState } from 'react';
import { aiTurn, attack, at, capture, COST, createBattle, finishTurn, move, moves, siteAt, STATS, targets, tileAt, train, type Battle, type Kind, type Unit } from '../../../packages/games/naqla-tactics/engine.ts';
import './naqla-tactics.css';

type Locale = 'ar' | 'en';
type Mode = 'campaign' | 'local';
const storageKey='naqla-tactics-native-v1';
const names:Record<Locale,Record<string,string>>={
 ar:{title:'تكتيكات نقلة',subtitle:'معارك تبادلية • حملة أصلية',back:'العودة للمكتبة',campaign:'الحملة',local:'لاعبان محليًا',reset:'مباراة جديدة',round:'الجولة',blue:'الأزرق',red:'الأحمر',turn:'الدور',credits:'الرصيد',end:'إنهاء الدور',recruit:'تجنيد من القاعدة',capture:'السيطرة',hint:'حدد وحدتك، ثم اختر مربعًا للتحرك أو عدوًا للهجوم.',ready:'جاهزة',used:'تحركت',won:'الفائز',next:'المهمة التالية',mission:'المهمة',independent:'محتوى أصلي لنقلة، ليس أصول Athena Crisis التجارية',infantry:'مشاة',scout:'استطلاع',tank:'دبابة',artillery:'مدفعية',full:'ملء الشاشة'},
 en:{title:'NAQLA Tactics',subtitle:'Turn-based battles • original campaign',back:'Back to library',campaign:'Campaign',local:'Local two-player',reset:'New match',round:'Round',blue:'Blue',red:'Red',turn:'Turn',credits:'Credits',end:'End turn',recruit:'Recruit at base',capture:'Capture',hint:'Select a unit, then a destination or enemy to attack.',ready:'Ready',used:'Moved',won:'Winner',next:'Next mission',mission:'Mission',independent:'Original NAQLA content, not commercial Athena Crisis assets',infantry:'Infantry',scout:'Scout',tank:'Tank',artillery:'Artillery',full:'Fullscreen'}
};
const glyph:Record<Kind,string>={infantry:'♟',scout:'◆',tank:'▰',artillery:'✹'};
function restore():Battle|null {
 try{const b=JSON.parse(localStorage.getItem(storageKey)??'null') as Battle|null;
 if(b?.version===1&&Array.isArray(b.tiles)&&b.tiles.length===8&&Array.isArray(b.units)&&Array.isArray(b.sites)&&[1,2].includes(b.turn))return b;}
 catch{/* corrupted or blocked storage should never prevent opening the game */}return null;
}
function Sprite({unit}:{unit:Unit}) {return <span className={`tactics-sprite ${unit.side===1?'blue':'red'} ${unit.kind}`} aria-hidden="true"><span className="tactics-sprite-icon">{glyph[unit.kind]}</span><small>{unit.hp}</small></span>;}
export function NaqlaTacticsPage({onExit,language='ar'}:{onExit:()=>void;language?:Locale}) {
 const t=names[language], [battle,setBattle]=useState<Battle>(()=>restore()??createBattle()),
 [selection,setSelection]=useState<number|null>(null),[error,setError]=useState(''),[lastAction,setLastAction]=useState(''),
 [mode,setMode]=useState<Mode>(()=>restore()?.mode==='local'?'local':'campaign');
 const active=battle.units.find(u=>u.id===selection);
 const paths=useMemo(()=>new Set(active?moves(battle,active.id).map(p=>p.x+','+p.y):[]),[battle,active]);
 const possibleTargets=useMemo(()=>new Set(active?targets(battle,active.id).map(u=>u.id):[]),[battle,active]);
 const friendlyUnits=battle.units.filter(u=>u.side===battle.turn);
 useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify(battle));}catch{/* storage optional */}},[battle]);
 useEffect(()=>{if(battle.mode!=='ai'||battle.turn!==2||battle.winner)return;
 const timer=setTimeout(()=>{setBattle(previous=>{if(previous.mode!=='ai'||previous.turn!==2||previous.winner)return previous;const next=structuredClone(previous);aiTurn(next);return next;});setSelection(null);},360);
 return ()=>clearTimeout(timer);},[battle]);
 function change(update:(next:Battle)=>void, action='') {try{const next=structuredClone(battle);update(next);setBattle(next);setSelection(null);setError('');setLastAction(action);}catch(err){setError(err instanceof Error?err.message:String(err));}}
 function clickTile(x:number,y:number){
 if(battle.winner||(battle.mode==='ai'&&battle.turn===2))return;
 const u=at(battle,x,y);
 if(u?.side===battle.turn){setSelection(u.id);setError('');return;}
 if(!active)return;
 if(u&&possibleTargets.has(u.id))return change(next=>attack(next,active.id,u.id),'attack');
 if(paths.has(x+','+y))return change(next=>move(next,active.id,x,y),'move');
 setError('');setSelection(null);
 }
 function newGame(newMode:Mode=mode,mission=battle.mission){setMode(newMode);setSelection(null);setError('');setLastAction('');setBattle(createBattle(mission,newMode==='local'?'local':'ai'));}
 const base=battle.sites.find(p=>p.kind==='base'&&p.side===battle.turn&&!at(battle,p.x,p.y));
 const canCapture=!!active&&active.kind==='infantry'&&!active.acted&&!!siteAt(battle,active.x,active.y)&&siteAt(battle,active.x,active.y)?.side!==active.side;
 const isAr=language==='ar';
 return <section className="naqla-tactics-root" dir={isAr?'rtl':'ltr'} aria-label={t.title}>
 <header className="naqla-tactics-header">
  <button className="naqla-tactics-exit" onClick={onExit}>← {t.back}</button>
  <div className="naqla-tactics-heading"><b>{t.title}</b><small>{t.subtitle}</small></div>
  <button className="naqla-tactics-exit" onClick={()=>{const node=document.querySelector('.naqla-tactics-root');if(node&&'requestFullscreen' in node)void node.requestFullscreen().catch(()=>{});}}>{t.full} ⛶</button>
 </header>
 <div className="naqla-tactics-layout">
  <aside className="naqla-tactics-panel">
   <div className="naqla-tactics-choice" role="group" aria-label="Game mode">
    <button aria-pressed={mode==='campaign'} onClick={()=>newGame('campaign',0)}>{t.campaign}</button>
    <button aria-pressed={mode==='local'} onClick={()=>newGame('local',0)}>{t.local}</button>
   </div>
   <div className="naqla-tactics-stat"><span>{t.mission}</span><strong>{battle.mission+1} / 3</strong></div>
   <div className="naqla-tactics-missions">{[0,1,2].map(n=><button key={n} aria-pressed={battle.mission===n} onClick={()=>newGame(mode,n)}>{n+1}</button>)}</div>
   <div className="naqla-tactics-stat"><span>{t.round}</span><strong>{battle.round}</strong></div>
   <div className="naqla-tactics-stat"><span>{t.turn}</span><strong className={battle.turn===1?'tactics-blue':'tactics-red'}>{battle.turn===1?t.blue:t.red}</strong></div>
   <div className="naqla-tactics-stat"><span>{t.credits}</span><strong>{battle.gold[battle.turn]}</strong></div>
   <p className="naqla-tactics-help">{t.hint}</p>
   <button className="naqla-tactics-primary" disabled={!!battle.winner||battle.mode==='ai'&&battle.turn===2} onClick={()=>change(finishTurn,'turn')}>{t.end} ⇢</button>
   <button className="naqla-tactics-secondary" onClick={()=>newGame()}>{t.reset}</button>
  </aside>
  <div className="naqla-tactics-field">
   <div className="naqla-tactics-topline"><span>{t.blue} <b>{battle.units.filter(u=>u.side===1).length}</b></span><span>VS</span><span>{t.red} <b>{battle.units.filter(u=>u.side===2).length}</b></span></div>
   <div className="naqla-tactics-grid" role="grid" aria-label={isAr?'الخريطة التكتيكية':'Tactical board'}>{Array.from({length:80},(_,i)=>{
    const x=i%10,y=Math.floor(i/10),tile=tileAt(battle,x,y),u=at(battle,x,y),p=siteAt(battle,x,y);
    const moveTo=paths.has(x+','+y),enemy=!!u&&possibleTargets.has(u.id);
    return <button key={i} type="button" role="gridcell" className={`tactics-tile terrain-${tile==='F'?'forest':tile==='M'?'mountain':tile==='~'?'water':'grass'} ${moveTo?'can-move':''} ${enemy?'can-attack':''} ${u?.id===selection?'selected':''}`}
     aria-label={`${String.fromCharCode(65+x)}${y+1}: ${u?t[u.kind]+' '+(u.side===1?t.blue:t.red):p?.kind==='base'?'Base':p?.kind==='city'?'City':tile}`}
     onClick={()=>clickTile(x,y)}>
     {p&&<span className={`tactics-property ${p.kind} owner-${p.side}`}>{p.kind==='base'?'⌂':'▤'}</span>}
     {u&&<Sprite unit={u}/>}
     {moveTo&&!u&&<span className="tactics-highlight"/>}
    </button>;
   })}</div>
   {battle.winner!==0&&<div className="naqla-tactics-winner" role="status"><b>{t.won}: {battle.winner===1?t.blue:t.red}</b>{mode==='campaign'&&battle.winner===1&&battle.mission<2&&<button onClick={()=>newGame('campaign',battle.mission+1)}>{t.next} →</button>}</div>}
   {error&&<p className="naqla-tactics-error" role="alert">{error}</p>}
   <div className="naqla-tactics-caption">{lastAction==='attack'?'⚔':lastAction==='move'?'➜':'◆'} {t.hint}</div>
  </div>
  <aside className="naqla-tactics-panel">
    <h3>{active?t[active.kind]:t.recruit}</h3>
    {active&&<div className="naqla-tactics-unitinfo"><Sprite unit={active}/><span>HP {active.hp}/{STATS[active.kind].hp} · {active.acted?t.used:t.ready}</span></div>}
    <button className="naqla-tactics-primary" disabled={!canCapture} onClick={()=>active&&change(next=>capture(next,active.id),'capture')}>{t.capture}</button>
    <h3>{t.recruit}</h3>
    <div className="naqla-tactics-shop">{(Object.keys(COST) as Kind[]).map(kind=><button key={kind} disabled={!base||!!battle.winner||battle.gold[battle.turn]<COST[kind]||battle.mode==='ai'&&battle.turn===2}
     onClick={()=>base&&change(next=>train(next,kind,base.x,base.y),'recruit')}><span>{glyph[kind]} {t[kind]}</span><b>{COST[kind]}</b></button>)}</div>
    <p className="naqla-tactics-legal">{t.independent}</p>
  </aside>
 </div>
 </section>;
}
