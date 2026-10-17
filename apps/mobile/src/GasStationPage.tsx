import {useCallback,useEffect,useRef,useState} from 'react';
import {
  applyOfflineEarnings,buyFacility,buyStaff,buyUpgrade,captureGas,claimMission,
  clearJunk,dismissStaff,FACILITIES,facilityCost,GAS_SAVE_KEY,interactCar,
  isNear,JOBS,MISSIONS,moveTo,newGasStation,restock,restoreGas,
  startRace,TARGETS,tickGas,upgradeCost,UPGRADES,workerCost,workGarage,
  type Facility,type Mission,type SavedGas,type StaffJob,type State,type Upgrade,
} from '../../../packages/games/gas-station/engine.ts';
import {GasStationWorld} from './GasStationArt.tsx';
import {feedback,storage,type Settings} from './platform.ts';
import {useI18n} from './i18n.tsx';

type Tab='overview'|'build'|'employees'|'missions';
type QueuedAction={kind:'car'|'junk'|'garage';id:number}|null;
const copy=(s:State):State=>({...s,player:{...s.player},facilities:{...s.facilities},
 upgrades:{...s.upgrades},cars:s.cars.map(x=>({...x})),
 debris:s.debris.map(x=>({...x})),staff:s.staff.map(x=>({...x})),
 missions:{...s.missions},event:{...s.event},claimed:[...s.claimed]});
const abbreviate=(v:number)=>v>=1e6?(v/1e6).toFixed(1)+'m':v>=1e4?(v/1000).toFixed(1)+'k':String(Math.floor(v));
const facilityLabel=(key:Facility)=>'gasFacility'+key[0]!.toUpperCase()+key.slice(1);
const upgradeLabel=(key:Upgrade)=>'gasUpgrade'+key[0]!.toUpperCase()+key.slice(1);
const workerLabel=(key:StaffJob)=>'gasWorker'+key[0]!.toUpperCase()+key.slice(1);
const missionLabel=(key:Mission)=>'gasMission'+key[0]!.toUpperCase()+key.slice(1);
const orderKeys:Facility[]=['pump','shop','garage','wash','tires'];
export function GasStationPage({onExit,settings}:{onExit:()=>void;settings:Settings}){
 const {t,lang}=useI18n();
 const game=useRef<State>(newGasStation());
 const [view,setView]=useState<State>(()=>copy(game.current));
 const [loaded,setLoaded]=useState(false);
 const [tab,setTab]=useState<Tab>('overview');
 const [recovery,setRecovery]=useState(0);
 const [fast,setFast]=useState(false);
 const [paused,setPaused]=useState(false);
 const settingsRef=useRef(settings);settingsRef.current=settings;
 const pending=useRef<QueuedAction>(null);
 const keys=useRef(new Set<string>());
 const pointer=useRef<{x:number;y:number}|null>(null);
 const pausedRef=useRef(false);
 const lastPaint=useRef(0),lastSave=useRef(0);
 const sync=useCallback(()=>setView(copy(game.current)),[]);
 const save=useCallback(()=>{
  const payload:SavedGas=captureGas(game.current);
  void storage.set(GAS_SAVE_KEY,payload);
 },[]);
 useEffect(()=>{
  let active=true;
  void storage.get<unknown>(GAS_SAVE_KEY,null).then(value=>{
   if(!active)return;
   const {state,savedAt}=restoreGas(value);
   const bonus=applyOfflineEarnings(state,Date.now(),savedAt);
   game.current=state;setRecovery(bonus);sync();setLoaded(true);
  });
  return ()=>{active=false;};
 },[sync]);
 useEffect(()=>{
  if(!loaded)return;
  const onDown=(e:KeyboardEvent)=>{
   if(e.ctrlKey||e.altKey||e.metaKey)return;
   if((e.target as HTMLElement|null)?.closest('input,textarea,select,[contenteditable="true"]'))return;
   const key=e.key.toLowerCase();
   if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){
    keys.current.add(key);e.preventDefault();
   }
   if(key==='escape'&&!e.repeat){pausedRef.current=!pausedRef.current;setPaused(pausedRef.current);}
   if(key==='e'&&!e.repeat){
    const s=game.current;
    const ready=s.cars.find(c=>c.status==='waiting'&&isNear(s,c,115));
    if(ready)interactCar(s,ready.id);
    else if(isNear(s,TARGETS.garage,135))workGarage(s);
    else{
     const junk=s.debris.find(item=>!item.cleared&&isNear(s,item,72));
     if(junk)clearJunk(s,junk.id);
    }
    sync();save();e.preventDefault();
   }
  };
  const onUp=(e:KeyboardEvent)=>keys.current.delete(e.key.toLowerCase());
  const onBlur=()=>{keys.current.clear();pointer.current=null;};
  window.addEventListener('keydown',onDown);
  window.addEventListener('keyup',onUp);
  window.addEventListener('blur',onBlur);
  return ()=>{window.removeEventListener('keydown',onDown);
   window.removeEventListener('keyup',onUp);window.removeEventListener('blur',onBlur);};
 },[loaded,sync,save]);
 useEffect(()=>{
  if(!loaded)return;
  let frame=0,last=0;
  const animate=(now:number)=>{
   if(!last)last=now;
   const dt=Math.min(.09,Math.max(0,(now-last)/1000));last=now;
   if(!pausedRef.current&&document.visibilityState==='visible'){
    const s=game.current;
    const inputs=keys.current;
    const x=Number(inputs.has('d')||inputs.has('arrowright'))-
      Number(inputs.has('a')||inputs.has('arrowleft'))+(pointer.current?.x??0);
    const y=Number(inputs.has('s')||inputs.has('arrowdown'))-
      Number(inputs.has('w')||inputs.has('arrowup'))+(pointer.current?.y??0);
    if(x||y){
     pending.current=null;s.player.tx=null;s.player.ty=null;
     const len=Math.max(1,Math.hypot(x,y));
     s.player.x=Math.max(20,Math.min(940,s.player.x+dt*185*x/len));
     s.player.y=Math.max(70,Math.min(620,s.player.y+dt*185*y/len));
    }
    tickGas(s,dt*(fast?2:1));
    const p=pending.current;
    if(p){
     const obj=p.kind==='junk'?s.debris.find(d=>d.id===p.id):
      p.kind==='car'?s.cars.find(c=>c.id===p.id):TARGETS.garage;
     if(!obj){pending.current=null;}
     else if(isNear(s,obj,p.kind==='garage'?135:p.kind==='car'?112:69)){
      if(p.kind==='junk')clearJunk(s,p.id);
      if(p.kind==='car')interactCar(s,p.id);
      if(p.kind==='garage')workGarage(s);
      pending.current=null;save();
     }
    }
    if(now-lastPaint.current>110){lastPaint.current=now;sync();}
    if(now-lastSave.current>5200){lastSave.current=now;save();}
   }
   frame=requestAnimationFrame(animate);
  };
  const visibility=()=>{
   if(document.visibilityState==='hidden'){
    keys.current.clear();pointer.current=null;save();
   }
  };
  document.addEventListener('visibilitychange',visibility);
  frame=requestAnimationFrame(animate);
  return ()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);save();};
 },[loaded,sync,save,fast]);
 const mutate=(fn:(s:State)=>boolean)=>{
  const result=fn(game.current);
  if(result){feedback(settingsRef.current,'move');sync();save();}
  return result;
 };
 const walk=(x:number,y:number)=>{pending.current=null;moveTo(game.current,x,y);sync();};
 const actionCar=(id:number)=>{
  const car=game.current.cars.find(x=>x.id===id);
  if(!car||car.status!=='waiting')return;
  if(isNear(game.current,car,115)){mutate(s=>interactCar(s,id));return;}
  moveTo(game.current,car.x,car.y);pending.current={kind:'car',id};sync();
 };
 const actionJunk=(id:number)=>{
  const item=game.current.debris.find(x=>x.id===id&&!x.cleared);if(!item)return;
  if(isNear(game.current,item,69)){mutate(s=>clearJunk(s,id));return;}
  moveTo(game.current,item.x,item.y);pending.current={kind:'junk',id};sync();
 };
 const actionFacility=(key:Facility)=>{
  const loc=TARGETS[key];walk(loc.x,loc.y);
 };
 const garageAction=()=>{
  if(isNear(game.current,TARGETS.garage,135)){mutate(workGarage);return;}
  moveTo(game.current,TARGETS.garage.x,TARGETS.garage.y);
  pending.current={kind:'garage',id:0};sync();
 };
 const activeCars=view.cars.filter(c=>c.status==='waiting'||c.status==='servicing');
 const junk=view.debris.filter(d=>!d.cleared);
 const missionKeys=Object.keys(MISSIONS) as Mission[];
 const fuelFraction=Math.round(view.fuel/view.maxFuel*100),shopFraction=Math.round(view.goods/view.maxGoods*100);
 const hour=Math.floor(view.clock/60)%24,minute=Math.floor(view.clock%60);
 const clock=String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0');
 const nav:[Tab,string][]=[['overview','gasTabOverview'],['build','gasTabBuild'],
  ['employees','gasTabStaff'],['missions','gasTabMissions']];
 if(!loaded)return <main className="gas-page"><p>{t('loading')}</p></main>;
 return <main className="gas-page page-enter" dir={lang==='ar'?'rtl':'ltr'}>
  <header className="gas-heading">
   <div><span className="eyebrow">NAQLA · ROADSIDE BUSINESS SIMULATOR</span>
    <h1>{t('gasStation')}</h1><p>{t('gasStationDesc')}</p></div>
   <button className="button secondary" type="button" onClick={onExit}>{t('gasBack')}</button>
  </header>
  <div className="gas-layout">
   <section className="gas-game">
    <div className="gas-hud">
     <span>💵 <b>{abbreviate(view.cash)}</b></span>
     <span>⭐ <b>LV {view.level}</b></span>
     <span>🧭 <b>{clock}</b></span>
     <span>❤️ <b>{view.rating.toFixed(1)}</b></span>
     <span>🚙 <b>{view.served}</b></span>
    </div>
    <div className="gas-map" dir="ltr">
     <GasStationWorld state={view} onWalk={walk} onJunk={actionJunk}
      onService={actionCar} onFacility={actionFacility}/>
     <div className="gas-map-missions">
      <b>{t('gasCurrentGoal')}</b>
      <span>{junk.length>0?t('gasCleanGoal')+' '+(view.debris.length-junk.length)+'/'+view.debris.length:
       t('gasGrowGoal')}</span>
     </div>
     {view.event.active&&<div className="gas-race-banner">
      🏎️ {t('gasRace')} {Math.ceil(view.event.time)}s · {view.event.completed}/{view.event.goal}
     </div>}
     {paused&&<div className="gas-paused"><h2>{t('gasPaused')}</h2>
      <button type="button" onClick={()=>{pausedRef.current=false;setPaused(false);}}>
       {t('gasResume')}</button></div>}
     <div className="gas-map-tip">{t('gasMapHint')}</div>
    </div>
    <div className="gas-controlbar">
     <div className="gas-dpad" aria-label={t('gasMove')} dir="ltr">
      {[['↖',-.72,-.72],['↑',0,-1],['↗',.72,-.72],
       ['←',-1,0],['●',0,0],['→',1,0],
       ['↙',-.72,.72],['↓',0,1],['↘',.72,.72]].map(([label,x,y],i)=>
       <button key={i} type="button" aria-label={t('gasMove')+' '+label}
        onPointerDown={e=>{e.preventDefault();pointer.current={x:Number(x),y:Number(y)};e.currentTarget.setPointerCapture(e.pointerId);}}
        onPointerUp={()=>{pointer.current=null;}}
        onPointerCancel={()=>{pointer.current=null;}}
        onLostPointerCapture={()=>{pointer.current=null;}}
       >{label}</button>)}
     </div>
     <div className="gas-quick">
      <div className="gas-supplies">
       <div><span>⛽ {t('gasFuel')}</span><b>{view.fuel}/{view.maxFuel}</b>
        <progress value={fuelFraction} max={100}/></div>
       <div><span>📦 {t('gasGoods')}</span><b>{view.goods}/{view.maxGoods}</b>
        <progress value={shopFraction} max={100}/></div>
       <div><span>🔧 {t('gasParts')}</span><b>{view.parts}</b></div>
      </div>
      <div className="gas-actions">
       <button type="button" className="gas-action" onClick={()=>{
        const ready=game.current.cars.find(c=>c.status==='waiting'&&isNear(game.current,c,115));
        if(ready)actionCar(ready.id);
        else if(isNear(game.current,TARGETS.garage,135))garageAction();
        else{
         const nearest=game.current.debris.find(d=>!d.cleared&&isNear(game.current,d,72));
         if(nearest)actionJunk(nearest.id);
        }
       }}>{t('gasInteract')}</button>
       <button type="button" onClick={()=>{pausedRef.current=!pausedRef.current;setPaused(pausedRef.current);}}>
        {t(paused?'gasResume':'gasPause')}</button>
       <button type="button" aria-pressed={fast} onClick={()=>setFast(v=>!v)}>
        {fast?'2×':'1×'} {t('gasSpeed')}</button>
      </div>
     </div>
    </div>
    {recovery>0&&<p className="gas-toast" role="status">💰 {t('gasOfflineBonus')} +{recovery}</p>}
    {view.notice&&<p className="gas-toast" role="status">{t(view.notice)}</p>}
   </section>
   <aside className="gas-sidebar">
    <div className="gas-tabs" role="tablist">
     {nav.map(([key,label])=><button type="button" role="tab" key={key}
      aria-selected={tab===key} onClick={()=>setTab(key)} className={tab===key?'active':''}>
      {t(label)}</button>)}
    </div>
    {tab==='overview'&&<div className="gas-panel">
     <h2>🚗 {t('gasCars')}</h2>
     <p>{t('gasCarsHint')}</p>
     <div className="gas-queue">
      {activeCars.length===0&&<p className="gas-empty">{t('gasWaitingCars')}</p>}
      {activeCars.map(car=><div className="gas-order" key={car.id}>
       <span className="gas-order-icon" style={{background:car.color}}>🚘</span>
       <span className="gas-order-details">
        <strong>{t(facilityLabel(car.facility))}{car.event?' 🏎️':''}</strong>
        <small>{car.status==='servicing'?t('gasInService'):
         t('gasPatience')+' '+Math.ceil(car.patience)+'s'}</small>
        <progress max={car.status==='servicing'?car.needs:48}
         value={car.status==='servicing'?car.progress:car.patience}/>
       </span>
       <button type="button" disabled={car.status!=='waiting'}
        onClick={()=>actionCar(car.id)}>{t('gasServe')}</button>
      </div>)}
     </div>
     {view.facilities.garage>0&&<div className="gas-garage-steps">
      <h3>🔧 {t('gasGarageMinigame')}</h3>
      <p>{t('gasGarageStep'+view.garageStep[0]!.toUpperCase()+view.garageStep.slice(1))}</p>
      <button type="button" onClick={garageAction}>{t('gasRepairNext')}</button>
     </div>}
     <h3>📦 {t('gasStock')}</h3>
     <div className="gas-restock">
      {(['fuel','goods','parts'] as const).map(type=><div key={type}>
       <span>{t('gas'+type[0]!.toUpperCase()+type.slice(1))}</span>
       <div>{([20,50,100] as const).map(count=><button type="button" key={count}
        onClick={()=>mutate(s=>restock(s,type,count))}>+{count}</button>)}</div>
      </div>)}
     </div>
     <div className="gas-statrow"><span>{t('gasTotalIncome')}</span>
      <strong>💵 {abbreviate(view.totalIncome)}</strong></div>
     <div className="gas-statrow"><span>{t('gasMissed')}</span><strong>{view.missed}</strong></div>
    </div>}
    {tab==='build'&&<div className="gas-panel">
     <h2>🏗️ {t('gasFacilities')}</h2>
     <p>{t('gasBuildHint')}</p>
     <div className="gas-shop-grid">
      {orderKeys.map(key=><div key={key} className="gas-shop-option">
       <span className="gas-shop-icon">{key==='pump'?'⛽':key==='shop'?'🛒':
        key==='garage'?'🔧':key==='wash'?'💦':'🛞'}</span>
       <div><strong>{t(facilityLabel(key))}</strong>
        <small>{t('gasOwned')}: {view.facilities[key]} / {key==='pump'?3:1}</small></div>
       <button type="button"
        disabled={key==='pump'?view.facilities.pump>=3:!!view.facilities[key]}
        onClick={()=>mutate(s=>buyFacility(s,key))}>
        {key!=='pump'&&view.facilities[key]?'✓':'💵 '+Math.ceil(facilityCost(view,key))}
       </button>
      </div>)}
     </div>
     <h2>⬆️ {t('gasUpgrades')}</h2>
     <div className="gas-shop-grid">
      {UPGRADES.map(key=><div key={key} className="gas-shop-option">
       <span className="gas-shop-icon">{key==='pumpSpeed'?'⚡':key==='tankSize'?'🛢️':
        key==='shopMargin'?'💰':key==='serviceSpeed'?'⚙️':'📣'}</span>
       <div><strong>{t(upgradeLabel(key))}</strong><small>LV {view.upgrades[key]}/6</small></div>
       <button type="button" disabled={view.upgrades[key]>=6}
        onClick={()=>mutate(s=>buyUpgrade(s,key))}>💵 {Math.ceil(upgradeCost(view,key))}</button>
      </div>)}
     </div>
    </div>}
    {tab==='employees'&&<div className="gas-panel">
     <h2>👷 {t('gasStaff')}</h2>
     <p>{t('gasStaffHint')}</p>
     <div className="gas-statrow"><span>{t('gasHired')}</span>
      <strong>{view.staff.length}/9</strong></div>
     <div className="gas-shop-grid">
      {JOBS.map(job=><div key={job} className="gas-shop-option">
       <span className="gas-shop-icon">👤</span><div><strong>{t(workerLabel(job))}</strong>
        <small>{view.staff.filter(w=>w.job===job).length} {t('gasHired')}</small></div>
       <button type="button" onClick={()=>mutate(s=>buyStaff(s,job))}
        disabled={view.staff.length>=9}>+ 💵 {workerCost(view)}</button>
      </div>)}
     </div>
     {view.staff.map(worker=><div key={worker.id} className="gas-staff-row">
      <span>👷 {t(workerLabel(worker.job))} #{worker.id}</span>
      <button type="button" onClick={()=>mutate(s=>dismissStaff(s,worker.id))}>
       {t('gasDismiss')}</button></div>)}
    </div>}
    {tab==='missions'&&<div className="gas-panel">
     <h2>🏅 {t('gasMissions')}</h2>
     <p>{t('gasMissionsHint')}</p>
     <div className="gas-mission-grid">
      {missionKeys.map(key=>{
       const mission=MISSIONS[key];
       const done=view.claimed.includes(key);
       return <div className="gas-mission" key={key}>
        <div><strong>{t(missionLabel(key))}</strong>
         <small>{Math.min(mission.target,view.missions[key])}/{mission.target}</small>
         <progress max={mission.target} value={view.missions[key]}/></div>
        <button type="button" disabled={done||view.missions[key]<mission.target}
         onClick={()=>mutate(s=>claimMission(s,key))}>
         {done?'✓':'+'+mission.reward+' 💵'}</button>
       </div>;
      })}
     </div>
     <div className="gas-race-card"><h3>🏁 {t('gasRace')}</h3>
      <p>{t('gasRaceExplain')}</p>
      <button type="button" onClick={()=>mutate(startRace)}
       disabled={view.level<5||view.event.active}>
       {t(view.event.active?'gasRaceActive':'gasRaceStart')}
      </button></div>
     <div className="gas-statrow"><span>{t('gasDay')}</span><strong>{view.day}</strong></div>
    </div>}
    <p className="gas-offline">{t('gasSaveNote')}</p>
   </aside>
  </div>
 </main>;
}
