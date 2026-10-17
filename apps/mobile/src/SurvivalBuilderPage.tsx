import { useCallback, useEffect, useRef, useState } from 'react';
import {
  bagCapacity, beginConstruction, blueprintFor, carried, finishIsland, hireWorker,
  JOBS, MAX_ISLANDS, MATERIALS, newIsland, readyToBuild, refineBrick,
  remaining, sanitizeIsland, SURVIVAL_SAVE_KEY, tapCollect,
  tickIsland, upgradeCost, upgradeWorkers, workerCost, assignWorker,
  type IslandState, type Job, type Material,
} from '../../../packages/games/survival-builder/engine.ts';
import { SurvivalIslandScene } from './SurvivalBuilderArt.tsx';
import { feedback, storage, type Settings } from './platform.ts';
import { useI18n } from './i18n.tsx';

const materialKey=(m:Material)=>'survivalBuilder'+m[0]!.toUpperCase()+m.slice(1);
const jobName=(j:Job)=>j==='builder'?'survivalBuilderJobBuilder':materialKey(j);
const copy=(s:IslandState):IslandState=>({
  ...s,inventory:{...s.inventory},workers:s.workers.map(w=>({...w})),
  builtHistory:[...s.builtHistory],
});
export function SurvivalBuilderPage({onExit,settings}:{onExit:()=>void;settings:Settings}){
  const {t,lang}=useI18n();
  const world=useRef(newIsland());
  const settingsRef=useRef(settings);
  settingsRef.current=settings;
  const [state,setState]=useState<IslandState>(()=>copy(world.current));
  const [loaded,setLoaded]=useState(false);
  const [notice,setNotice]=useState<string|null>(null);
  const lastSave=useRef(0);
  const lastPaint=useRef(0);
  const lastPhase=useRef(world.current.phase);
  const sync=useCallback(()=>setState(copy(world.current)),[]);
  const save=useCallback(()=>{void storage.set(SURVIVAL_SAVE_KEY,copy(world.current));},[]);
  useEffect(()=>{
    let active=true;
    void storage.get<unknown>(SURVIVAL_SAVE_KEY,null).then(raw=>{
      if(!active)return;
      world.current=sanitizeIsland(raw);
      lastPhase.current=world.current.phase;
      sync();setLoaded(true);
    });
    return ()=>{active=false;};
  },[sync]);
  useEffect(()=>{
    if(!loaded)return;
    let frame=0,last=0;
    const update=(now:number)=>{
      if(!last)last=now;
      const delta=Math.min(.1,Math.max(0,(now-last)/1000));
      last=now;
      if(document.visibilityState==='visible'){
        tickIsland(world.current,delta);
        if(lastPhase.current!=='completed'&&world.current.phase==='completed'){
          feedback(settingsRef.current,'win');
          setNotice('survivalBuilderFinished');
          save();sync();
        }
        lastPhase.current=world.current.phase;
        if(now-lastPaint.current>210){lastPaint.current=now;sync();}
        if(now-lastSave.current>5500){lastSave.current=now;save();}
      }
      frame=requestAnimationFrame(update);
    };
    const persist=()=>{if(document.visibilityState==='hidden')save();};
    document.addEventListener('visibilitychange',persist);
    frame=requestAnimationFrame(update);
    return ()=>{
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange',persist);
      save();
    };
  },[loaded,save,sync]);
  const mutate=(action:(s:IslandState)=>boolean,noticeKey?:string)=>{
    const ok=action(world.current);
    if(ok){
      feedback(settingsRef.current,'move');
      sync();save();
      if(noticeKey)setNotice(noticeKey);
    }else if(noticeKey)setNotice('survivalBuilderNotEnough');
  };
  const advance=()=>{
    if(finishIsland(world.current)){
      lastPhase.current=world.current.phase;
      setNotice(null);sync();save();
      feedback(settingsRef.current,'move');
    }else if(world.current.phase==='completed')setNotice('survivalBuilderAllDone');
  };
  const bp=blueprintFor(state.island);
  const needs=MATERIALS.map(key=>({
    key,count:bp.requirements[key],have:state.inventory[key],
    missing:remaining(state,key),
  }));
  const allDone=state.phase==='completed'&&state.island>=MAX_ISLANDS;
  if(!loaded)return <main className="survival-builder-page"><p>{t('loading')}</p></main>;
  return <main className="survival-builder-page page-enter" dir={lang==='ar'?'rtl':'ltr'}>
    <header className="survival-builder-heading">
      <div><span className="eyebrow">NAQLA · ISLAND TYCOON</span>
        <h1>{t('survivalBuilder')}</h1><p>{t('survivalBuilderDesc')}</p></div>
      <button className="button secondary" type="button" onClick={onExit}>
        {t('survivalBuilderBack')}</button>
    </header>
    <div className="survival-builder-layout">
      <section className="survival-builder-game">
        <div className="survival-builder-hud">
          <span>🏝️ {t('survivalBuilderIsland')} <b>{state.island}/{MAX_ISLANDS}</b></span>
          <span>🪙 <b>{state.inventory.coins}</b></span>
          <span>👷 <b>{state.workers.length}</b></span>
          <span>🎒 <b>{carried(state)}/{bagCapacity(state)}</b></span>
        </div>
        <div className="survival-builder-landscape">
          <SurvivalIslandScene state={state} onCollect={key=>mutate(s=>tapCollect(s,key))}/>
          <div className="survival-builder-goal" role="status">
            <span className="survival-builder-goal-name">{t('survivalBuilderProject')}: {t('survivalBuilderFeature'+bp.feature[0]!.toUpperCase()+bp.feature.slice(1))}</span>
            <div className="survival-builder-progress" role="progressbar"
              aria-label={t('survivalBuilderBuildProgress')} aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={Math.floor(state.buildProgress)}>
              <span style={{width:state.buildProgress+'%'}}/>
            </div>
            <span className="survival-builder-goal-progress">{Math.floor(state.buildProgress)}%</span>
          </div>
        </div>
        <div className="survival-builder-collect">
          {MATERIALS.filter((m):m is Exclude<Material,'brick'>=>m!=='brick').map((key)=>{
            const icon:{[k:string]:string}={bamboo:'🎋',wood:'🪵',clay:'🟤',stone:'🪨'};
            return <button type="button" key={key} disabled={state.phase==='completed'}
              onClick={()=>mutate(s=>tapCollect(s,key))}
              aria-label={t('survivalBuilderCollect')+' '+t(materialKey(key))}>
              <span aria-hidden="true">{icon[key]}</span>
              <small>{t(materialKey(key))}</small>
              <strong>{state.inventory[key]}</strong>
              {state.phase==='collecting'&&bp.requirements[key]>0&&
                <em>{Math.min(state.inventory[key],bp.requirements[key])}/{bp.requirements[key]}</em>}
            </button>;
          })}
          <button type="button" onClick={()=>mutate(refineBrick)}
            disabled={state.phase==='completed'||state.inventory.clay<2}>
            <span aria-hidden="true">🧱</span>
            <small>{t('survivalBuilderBrick')}</small>
            <strong>{state.inventory.brick}</strong>
            {state.phase==='collecting'&&bp.requirements.brick>0&&
              <em>{Math.min(state.inventory.brick,bp.requirements.brick)}/{bp.requirements.brick}</em>}
          </button>
        </div>
        <div className="survival-builder-action-row">
          {state.phase==='collecting'&&
            <button className="survival-builder-main-action" type="button"
              disabled={!readyToBuild(state)||!state.workers.some(w=>w.job==='builder')}
              onClick={()=>mutate(beginConstruction,'survivalBuilderBuilding')}>
              <span>🏗️</span> {t('survivalBuilderBuild')}
            </button>}
          {state.phase==='building'&&<div className="survival-builder-working">
            <span aria-hidden="true">⚒️</span> {t('survivalBuilderWorking')}
            <b>{Math.floor(state.buildProgress)}%</b>
          </div>}
          {state.phase==='completed'&&<button className="survival-builder-main-action"
              type="button" onClick={advance}>
              <span>⭐</span> {t(allDone?'survivalBuilderAllDone':'survivalBuilderNext')}
            </button>}
          <span className="survival-builder-phase-hint">
            {t(state.phase==='collecting'?'survivalBuilderGatherHint':
              state.phase==='building'?'survivalBuilderBuildingHint':'survivalBuilderCompletionHint')}
          </span>
        </div>
        {notice&&<p className="survival-builder-notice" role="status">{t(notice)}</p>}
      </section>
      <aside className="survival-builder-side">
        <div className="survival-builder-card">
          <h2>🏠 {t('survivalBuilderBlueprint')}</h2>
          <p>{t('survivalBuilderGoal')}</p>
          <div className="survival-builder-requirements">
            {needs.filter(n=>n.count>0).map(n=><div key={n.key}
              className={n.missing===0?'survival-builder-ready':''}>
              <span>{t(materialKey(n.key))}</span>
              <strong>{state.phase==='collecting'?
                Math.min(n.have,n.count)+' / '+n.count:
                state.phase==='building'?'✓':'✓'}</strong>
            </div>)}
          </div>
          <div className="survival-builder-reward">🏅 +{bp.reward} {t('survivalBuilderCoins')}</div>
        </div>
        <div className="survival-builder-card">
          <h2>👷 {t('survivalBuilderWorkers')}</h2>
          <div className="survival-builder-workers">
            {state.workers.map(w=><div key={w.id} className="survival-builder-worker">
              <span className="survival-builder-helmet">👷</span>
              <label htmlFor={'survival-job-'+w.id}>
                <span>{t('survivalBuilderWorker')} {w.id}</span>
                <select id={'survival-job-'+w.id} value={w.job}
                  onChange={e=>mutate(s=>assignWorker(s,w.id,e.target.value as Job))}>
                  {JOBS.map(job=><option key={job} value={job}>{t(jobName(job))}</option>)}
                </select>
              </label>
              <small>LV {1+Math.floor(w.experience/40)}</small>
            </div>)}
          </div>
          <div className="survival-builder-upgrades">
            <button type="button" disabled={state.workers.length>=12||state.inventory.coins<workerCost(state)}
              onClick={()=>mutate(hireWorker)}>{t('survivalBuilderHire')} · 🪙 {workerCost(state)}</button>
            <button type="button" disabled={state.productivity>=6||state.inventory.coins<upgradeCost(state)}
              onClick={()=>mutate(upgradeWorkers)}>{t('survivalBuilderUpgrade')} · 🪙 {upgradeCost(state)}</button>
          </div>
          <p className="survival-builder-level-note">{t('survivalBuilderSpeed')} ×{state.productivity.toFixed(2)}</p>
        </div>
        <div className="survival-builder-card survival-builder-tips">
          <h2>🌴 {t('survivalBuilderTipsTitle')}</h2>
          <p>{t('survivalBuilderInstructions')}</p>
          <p className="survival-builder-save">{t('survivalBuilderOffline')}</p>
        </div>
      </aside>
    </div>
  </main>;
}
