import { useCallback,useEffect,useRef,useState,type PointerEvent } from 'react';
import {
  addFloor,aimDefense,armorCost,captureDefense,clearAim,continueDefense,
  FIXED_DT,launchDefense,MAX_STAGE,newDefense,powerCost,readDefenseProgress,
  retryDefense,specialDefense,speedCost,TOWER_HEIGHT,TOWER_SAVE_KEY,TOWER_WIDTH,
  tickDefense,upgradeDefense,upgradeFloor,weaponCost,weaponUpgradeCost,
  WEAPONS,type DefenseProgress,type DefenseState,type Weapon,
} from '../../../packages/games/tower-destiny/engine.ts';
import {paintTowerDefense} from './TowerDestinyArt.tsx';
import {feedback,storage,type Settings} from './platform.ts';
import {useI18n} from './i18n.tsx';

const SNAPSHOT_INTERVAL=130;
const snapshot=(s:DefenseState):DefenseState=>({
  ...s,modules:s.modules.map(m=>({...m})),enemies:s.enemies.map(e=>({...e})),
  effects:s.effects.map(e=>({...e})),aim:s.aim?{...s.aim}:null,
});
export function TowerDestinyPage({onExit,settings}:{onExit:()=>void;settings:Settings}){
  const {t,lang}=useI18n();
  const game=useRef<DefenseState>(newDefense());
  const canvas=useRef<HTMLCanvasElement>(null);
  const [view,setView]=useState<DefenseState>(()=>snapshot(game.current));
  const [loaded,setLoaded]=useState(false);
  const [weapon,setWeapon]=useState<Weapon>('flame');
  const [info,setInfo]=useState(false);
  const [paused,setPaused]=useState(false);
  const pausedRef=useRef(false);
  const settingsRef=useRef(settings);
  settingsRef.current=settings;
  const lastDisplay=useRef(0);
  const sync=useCallback(()=>setView(snapshot(game.current)),[]);
  const save=useCallback(()=>{void storage.set(TOWER_SAVE_KEY,captureDefense(game.current));},[]);
  useEffect(()=>{
    let active=true;
    void storage.get<unknown>(TOWER_SAVE_KEY,null).then(raw=>{
      if(!active)return;
      game.current=newDefense(readDefenseProgress(raw));
      sync();setLoaded(true);
    });
    return ()=>{active=false;};
  },[sync]);
  useEffect(()=>{
    if(!loaded||!canvas.current)return;
    const element=canvas.current,ctx=element.getContext('2d');
    if(!ctx)return;
    const dpr=Math.min(2,window.devicePixelRatio||1);
    element.width=TOWER_WIDTH*dpr;
    element.height=TOWER_HEIGHT*dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    let frame=0,last=0,carry=0;
    const animate=(now:number)=>{
      if(!last)last=now;
      const delta=Math.min(50,Math.max(0,now-last));
      last=now;
      if(document.visibilityState==='visible'&&!pausedRef.current&&game.current.phase==='battle'){
        carry=Math.min(80,carry+delta);
        let steps=0;
        while(carry>=FIXED_DT*1000&&steps++<5&&game.current.phase==='battle'){
          const phase=tickDefense(game.current,FIXED_DT);
          carry-=FIXED_DT*1000;
          if(phase!=='battle'){
            feedback(settingsRef.current,phase==='won'?'win':'move');
            save();sync();
          }
        }
      }else carry=0;
      paintTowerDefense(ctx,game.current,settingsRef.current.reduceMotion);
      if(now-lastDisplay.current>SNAPSHOT_INTERVAL){
        lastDisplay.current=now;sync();
      }
      frame=requestAnimationFrame(animate);
    };
    frame=requestAnimationFrame(animate);
    const visibility=()=>{
      if(document.visibilityState==='hidden')save();
      pausedRef.current=document.visibilityState==='hidden';
      setPaused(pausedRef.current);
    };
    document.addEventListener('visibilitychange',visibility);
    return ()=>{
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange',visibility);
      save();
    };
  },[loaded,save,sync]);
  const mutate=(action:(s:DefenseState)=>boolean)=>{
    const ok=action(game.current);
    if(ok){
      feedback(settingsRef.current,'move');
      sync();save();
    }
  };
  const start=()=>mutate(launchDefense);
  const advance=()=>{
    if(game.current.phase!=='won')return;
    game.current=continueDefense(game.current);
    pausedRef.current=false;setPaused(false);
    save();sync();
  };
  const retry=()=>{
    if(game.current.phase!=='lost')return;
    game.current=retryDefense(game.current);
    pausedRef.current=false;setPaused(false);
    save();sync();
  };
  const onPointerDown=(e:PointerEvent<HTMLCanvasElement>)=>{
    if(!loaded||game.current.phase!=='battle')return;
    if(e.pointerType==='mouse'&&e.button!==0)return;
    const rect=e.currentTarget.getBoundingClientRect();
    const x=(e.clientX-rect.left)/Math.max(1,rect.width)*TOWER_WIDTH;
    const y=(e.clientY-rect.top)/Math.max(1,rect.height)*TOWER_HEIGHT;
    if(aimDefense(game.current,x,y))sync();
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove=(e:PointerEvent<HTMLCanvasElement>)=>{
    if(!e.currentTarget.hasPointerCapture(e.pointerId))return;
    const rect=e.currentTarget.getBoundingClientRect();
    const x=(e.clientX-rect.left)/Math.max(1,rect.width)*TOWER_WIDTH;
    const y=(e.clientY-rect.top)/Math.max(1,rect.height)*TOWER_HEIGHT;
    aimDefense(game.current,x,y);
  };
  const onPointerUp=(e:PointerEvent<HTMLCanvasElement>)=>{
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    clearAim(game.current);sync();
  };
  const weaponName=(value:Weapon)=>t('towerDestinyWeapon'+value[0]!.toUpperCase()+value.slice(1));
  const isReady=view.phase==='ready',won=view.phase==='won',lost=view.phase==='lost';
  const finishedGame=won&&view.stage===MAX_STAGE;
  const stageProgress=Math.max(0,Math.min(100,view.spawned/Math.max(1,view.targetCount)*100));
  const damage=(value:number,max:number)=>Math.max(0,Math.min(100,value/max*100));
  if(!loaded)return <main className="tower-destiny-page"><p>{t('loading')}</p></main>;
  return <main className="tower-destiny-page page-enter" dir={lang==='ar'?'rtl':'ltr'}>
    <header className="tower-destiny-heading">
      <div><span className="eyebrow">NAQLA · MOBILE TOWER DEFENSE</span>
        <h1>{t('towerDestiny')}</h1><p>{t('towerDestinyDesc')}</p></div>
      <button type="button" className="button secondary" onClick={onExit}>{t('towerDestinyBack')}</button>
    </header>
    <div className="tower-destiny-layout">
      <section className="tower-destiny-machine">
        <div className="tower-destiny-hud">
          <span>🪙 <b>{view.coins}</b></span>
          <span>{t('towerDestinyStage')} <b>{view.stage}/{MAX_STAGE}</b></span>
          <span>⚡ <b>{Math.floor(view.energy)}/{view.maxEnergy}</b></span>
          <span>☠ <b>{view.kills}</b></span>
        </div>
        <div className="tower-destiny-world">
          <canvas ref={canvas} className="tower-destiny-canvas" role="img"
            aria-label={t('towerDestinyBoard')} onPointerDown={onPointerDown}
            onPointerMove={onPointerMove} onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp} onLostPointerCapture={()=>{clearAim(game.current);}}
          />
          <div className="tower-destiny-vitals">
            <span>{t('towerDestinyHealth')}</span>
            <div role="progressbar" aria-label={t('towerDestinyHealth')} aria-valuemin={0}
              aria-valuemax={view.maxHull} aria-valuenow={Math.round(view.hull)}>
              <span style={{width:damage(view.hull,view.maxHull)+'%'}}/>
            </div>
            <b>{Math.ceil(view.hull)} / {view.maxHull}</b>
          </div>
          {view.phase==='battle'&&<div className="tower-destiny-stage-progress">
            <span>{t('towerDestinyWave')}</span>
            <div><span style={{width:stageProgress+'%'}}/></div>
          </div>}
          {(isReady||won||lost||paused)&&
            <div className="tower-destiny-overlay" role="status">
              <span className="tower-destiny-overlay-icon" aria-hidden="true">
                {won?'🏆':lost?'☠':paused?'Ⅱ':'🛠️'}</span>
              <h2>{t(won?'towerDestinyWin':lost?'towerDestinyLost':paused?
                'towerDestinyPause':'towerDestinyReady')}</h2>
              <p>{t(won?'towerDestinyWinDesc':lost?'towerDestinyLostDesc':paused?
                'towerDestinyPauseDesc':'towerDestinyStartDesc')}</p>
              {isReady&&<div className="tower-destiny-prep-summary">
                <span>{t('towerDestinyFloors')}: {view.modules.length}</span>
                <span>{t('towerDestinyCoins')}: {view.coins}</span>
              </div>}
              <button type="button" onClick={()=>{
                if(isReady)start();
                else if(won){if(finishedGame)advance();else advance();}
                else if(lost)retry();
                else{pausedRef.current=false;setPaused(false);}
              }}>{t(isReady?'towerDestinyStart':won?finishedGame?'towerDestinyReplay':
                'towerDestinyNext':lost?'towerDestinyRetry':'towerDestinyResume')}</button>
            </div>}
        </div>
        <div className="tower-destiny-energy">
          <span>⚡ {t('towerDestinyEnergy')}</span>
          <div role="progressbar" aria-label={t('towerDestinyEnergy')} aria-valuemin={0}
            aria-valuemax={view.maxEnergy} aria-valuenow={Math.round(view.energy)}>
            <span style={{width:damage(view.energy,view.maxEnergy)+'%'}}/>
          </div>
          <b>{Math.floor(view.energy)}</b>
        </div>
        <div className="tower-destiny-specials">
          <button type="button" disabled={view.phase!=='battle'||view.energy<35}
            onClick={()=>mutate(s=>specialDefense(s,'blast'))}>
            <span aria-hidden="true">💥</span><strong>{t('towerDestinyBlast')}</strong><small>35 ⚡</small></button>
          <button type="button" disabled={view.phase!=='battle'||view.energy<40||view.hull>=view.maxHull}
            onClick={()=>mutate(s=>specialDefense(s,'repair'))}>
            <span aria-hidden="true">🛡️</span><strong>{t('towerDestinyRepair')}</strong><small>40 ⚡</small></button>
          <button type="button" disabled={view.phase!=='battle'||view.energy<55}
            onClick={()=>mutate(s=>specialDefense(s,'overdrive'))}>
            <span aria-hidden="true">⚡</span><strong>{t('towerDestinyOverdrive')}</strong><small>55 ⚡</small></button>
          <button type="button" className="tower-destiny-pause" disabled={view.phase!=='battle'}
            onClick={()=>{pausedRef.current=!pausedRef.current;setPaused(pausedRef.current);}}>
            {t('towerDestinyPauseButton')}</button>
        </div>
      </section>
      <aside className="tower-destiny-side">
        <div className="tower-destiny-card">
          <h2>🏗️ {t('towerDestinyYourTower')}</h2>
          <p>{t('towerDestinyStrategy')}</p>
          <div className="tower-destiny-floors">
            {view.modules.map((mod,i)=><div className="tower-destiny-floor" key={i}>
              <span className="tower-destiny-floor-icon">
                {mod.weapon==='rifle'?'🔫':mod.weapon==='flame'?'🔥':mod.weapon==='saw'?'⚙️':'✨'}</span>
              <span className="tower-destiny-floor-info">
                <strong>{i+1}. {weaponName(mod.weapon)}</strong>
                <small>LV {mod.level}</small>
              </span>
              <button type="button" disabled={!isReady||view.coins<weaponUpgradeCost(view,i)||mod.level>=20}
                onClick={()=>mutate(s=>upgradeFloor(s,i))}>
                ⬆ {weaponUpgradeCost(view,i)} 🪙
              </button>
            </div>)}
          </div>
          <div className="tower-destiny-add-floor">
            <label htmlFor="tower-destiny-weapon">{t('towerDestinyNewWeapon')}</label>
            <select id="tower-destiny-weapon" value={weapon} disabled={!isReady}
              onChange={e=>setWeapon(e.target.value as Weapon)}>
              {WEAPONS.map(w=><option key={w} value={w}>{weaponName(w)}</option>)}
            </select>
            <button type="button" disabled={!isReady||view.modules.length>=5||view.coins<weaponCost(view)}
              onClick={()=>mutate(s=>addFloor(s,weapon))}>
              {t('towerDestinyAddFloor')} · {weaponCost(view)} 🪙</button>
          </div>
        </div>
        <div className="tower-destiny-card">
          <h2>🪙 {t('towerDestinyUpgrades')}</h2>
          <div className="tower-destiny-upgrades">
            {(['armor','speed','power'] as const).map(upgrade=>{
              const cost=upgrade==='armor'?armorCost(view):
                upgrade==='speed'?speedCost(view):powerCost(view);
              const level=upgrade==='armor'?view.armorTech:upgrade==='speed'?view.speedTech:view.tech;
              return <button type="button" key={upgrade}
                disabled={!isReady||level>=20||view.coins<cost}
                onClick={()=>mutate(s=>upgradeDefense(s,upgrade))}>
                <strong>{t('towerDestiny'+upgrade[0]!.toUpperCase()+upgrade.slice(1))}</strong>
                <small>LV {level}</small><b>{cost} 🪙</b>
              </button>;
            })}
          </div>
        </div>
        <div className="tower-destiny-card">
          <button type="button" className="tower-destiny-help-toggle" onClick={()=>setInfo(v=>!v)}
            aria-expanded={info}>{t('towerDestinyHow')}</button>
          {info&&<p className="tower-destiny-help">{t('towerDestinyRules')}</p>}
          <p className="tower-destiny-offline">{t('towerDestinyOffline')}</p>
        </div>
      </aside>
    </div>
  </main>;
}
