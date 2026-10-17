import { useCallback, useEffect, useRef, useState } from 'react';
import {
  answerMathRun, beginMathRun, defaultMathRecord, INITIAL_TIME_MS,
  makeQuestion, MAX_TIME_MS, pauseMathRun, readMathRecord,
  SAVE_KEY, startMathRun, summarizeMathRun, tickMathRun,
  type MathRecord, type MathRun,
} from '../../../packages/games/arithmetica/engine.ts';
import { feedback, storage, type Settings } from './platform.ts';
import { useI18n } from './i18n.tsx';

const formatTime = (ms: number) => (Math.max(0, ms) / 1000).toFixed(1);
const keys = new Map([['1',0],['2',1],['arrowleft',0],['arrowright',1],['a',0],['d',1]]);
export function ArithmeticaPage({ onExit, settings }: {onExit:()=>void; settings:Settings}) {
  const {t,lang} = useI18n();
  const run = useRef<MathRun>(startMathRun());
  const record = useRef<MathRecord>(defaultMathRecord());
  const [loaded,setLoaded] = useState(false);
  const [view,setView] = useState<MathRun>(run.current);
  const [stats,setStats] = useState<MathRecord>(record.current);
  const [showHelp,setShowHelp] = useState(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const processed = useRef(false);
  const lastUpdate = useRef(0);
  const sync = useCallback(()=>{
    setView(run.current);
    setStats({...record.current});
  },[]);
  const complete = useCallback(()=>{
    if (run.current.phase !== 'gameover' || processed.current) return;
    processed.current = true;
    record.current = summarizeMathRun(record.current,run.current);
    void storage.set(SAVE_KEY,record.current);
    sync();
    feedback(settingsRef.current,'win');
  },[sync]);
  useEffect(()=>{
    let active=true;
    void storage.get<unknown>(SAVE_KEY,null).then(saved=>{
      if(!active)return;
      record.current=readMathRecord(saved);
      setLoaded(true);
      sync();
    });
    return ()=>{active=false;};
  },[sync]);
  useEffect(()=>{
    if(!loaded)return;
    let frame=0,last=0,carry=0;
    const animate=(now:number)=>{
      if(last===0)last=now;
      const raw = Math.max(0,(now-last));
      last=now;
      // A returning tab does not consume the whole timer in a single frame.
      if(document.visibilityState==='visible' && raw<2000 && run.current.phase==='playing'){
        carry+=Math.min(raw,200);
        if(carry>=30){
          const dt=carry;carry=0;
          run.current=tickMathRun(run.current,Math.min(1000,dt));
          if(now-lastUpdate.current>50 || run.current.phase==='gameover'){
            lastUpdate.current=now;sync();
          }
          if(run.current.phase==='gameover')complete();
        }
      } else carry=0;
      frame=requestAnimationFrame(animate);
    };
    frame=requestAnimationFrame(animate);
    const visibility=()=>{
      if(document.visibilityState==='hidden'&&run.current.phase==='playing'){
        run.current=pauseMathRun(run.current);sync();
      }
    };
    document.addEventListener('visibilitychange',visibility);
    return ()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);};
  },[loaded,sync,complete]);
  const answer=useCallback((index:number)=>{
    if(!loaded || run.current.phase!=='playing')return;
    const correct=run.current.question.correctIndex===index;
    run.current=answerMathRun(run.current,index);
    if(correct)feedback(settingsRef.current,'move');
    sync();
    if(run.current.phase==='gameover')complete();
  },[loaded,sync,complete]);
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if(e.altKey||e.ctrlKey||e.metaKey||e.repeat)return;
      if((e.target as HTMLElement | null)?.closest('input,textarea,select,[contenteditable="true"]'))return;
      const index=keys.get(e.key.toLowerCase());
      if(index!==undefined && run.current.phase==='playing'){
        e.preventDefault();answer(index);
      } else if(e.key==='Escape'&&['playing','paused'].includes(run.current.phase)){
        e.preventDefault();run.current=pauseMathRun(run.current);sync();
      } else if(e.key===' ' && run.current.phase==='ready'){
        e.preventDefault();run.current=beginMathRun(run.current);sync();
      }
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[answer,sync]);
  const restart=()=>{
    run.current=startMathRun(Date.now());
    processed.current=false;
    setShowHelp(false);
    sync();
  };
  const play=()=>{
    if(run.current.phase==='ready')run.current=beginMathRun(run.current);
    else if(run.current.phase==='paused')run.current=pauseMathRun(run.current);
    sync();
  };
  const togglePause=()=>{
    run.current=pauseMathRun(run.current);
    sync();
  };
  if(!loaded)return <main className="arithmetica-page"><p>{t('loading')}</p></main>;
  const chalkStars=Array.from({length:5},(_,i)=>i<view.stars);
  const timePercent=Math.max(0,view.timeMs/MAX_TIME_MS*100);
  const ended=view.phase==='gameover',paused=view.phase==='paused';
  return <main className="arithmetica-page page-enter" dir={lang==='ar'?'rtl':'ltr'}>
    <header className="arithmetica-heading">
      <div><span className="eyebrow">NAQLA · MENTAL MATH</span>
        <h1>{t('arithmetica')}</h1><p>{t('arithmeticaDesc')}</p></div>
      <button className="button secondary" type="button" onClick={onExit}>
        {t('arithmeticaBack')}
      </button>
    </header>
    <section className="arithmetica-layout">
      <div className="arithmetica-wood" dir="ltr">
        <div className="arithmetica-blackboard" aria-label={t('arithmeticaBoard')}>
          <div className="arithmetica-chalk-noise" aria-hidden="true"/>
          <div className="arithmetica-board-header">
            <strong className="arithmetica-level">{t('arithmeticaLevel')} {view.level}</strong>
            <div className="arithmetica-time" role="progressbar"
              aria-label={t('arithmeticaTime')}
              aria-valuemin={0} aria-valuemax={MAX_TIME_MS}
              aria-valuenow={Math.round(view.timeMs)}>
              <div className="arithmetica-time-fill" style={{width:timePercent+'%'}}/>
            </div>
          </div>
          <div className="arithmetica-stars" aria-label={view.stars+' / 5'}>
            {chalkStars.map((filled,i)=><span key={i}
              className={filled?'earned':''} aria-hidden="true">{filled?'★':'☆'}</span>)}
          </div>
          <div className={'arithmetica-question '+(view.feedback??'')} aria-live="polite">
            <span>{view.question.left}</span><span className="arithmetica-operation">{view.question.op}</span>
            <span>{view.question.right}</span><span>=</span><span>?</span>
          </div>
          <div className="arithmetica-answer-grid">
            {view.question.choices.map((value,index)=>
              <button type="button" key={view.question.id+'-'+index}
                onClick={()=>answer(index)} disabled={view.phase!=='playing'}
                className="arithmetica-answer" aria-label={String(value)}>
                {value}
              </button>)}
          </div>
          <div className="arithmetica-chalk-footer">
            <span>{t('arithmeticaScore')}: <b>{view.score}</b></span>
            <span>{formatTime(view.timeMs)}s</span>
          </div>
          {(view.phase==='ready'||paused||ended) &&
          <div className="arithmetica-overlay" role="status">
            <span className="arithmetica-overlay-icon" aria-hidden="true">
              {ended?'✩':paused?'Ⅱ':'✦'}
            </span>
            <h2>{t(ended?'arithmeticaGameOver':paused?'arithmeticaPaused':'arithmeticaReady')}</h2>
            <p>{t(ended?'arithmeticaOverDesc':paused?'arithmeticaPauseDesc':'arithmeticaStartDesc')}</p>
            {ended&&<div className="arithmetica-result-stats">
              <span>{t('arithmeticaScore')}<b>{view.score}</b></span>
              <span>{t('arithmeticaCorrect')}<b>{view.correct}</b></span>
              <span>{t('arithmeticaLevel')}<b>{view.level}</b></span>
            </div>}
            <button type="button" onClick={ended?restart:play}>
              {t(ended?'arithmeticaRetry':paused?'arithmeticaResume':'arithmeticaStart')}
            </button>
          </div>}
        </div>
      </div>
      <aside className="arithmetica-sidebar">
        <div className="arithmetica-info">
          <strong>{t('arithmeticaHow')}</strong>
          <p>{t('arithmeticaHelp')}</p>
        </div>
        <div className="arithmetica-stats">
          <span>{t('arithmeticaBest')}<b>{stats.bestScore}</b></span>
          <span>{t('arithmeticaBestLevel')}<b>{stats.bestLevel}</b></span>
          <span>{t('arithmeticaSolved')}<b>{stats.totalSolved}</b></span>
          <span>{t('arithmeticaStreak')}<b>{view.streak}</b></span>
        </div>
        <div className="arithmetica-actions">
          <button type="button" onClick={togglePause}
            disabled={view.phase==='ready'||ended}>
            {t(paused?'arithmeticaResume':'arithmeticaPause')}
          </button>
          <button type="button" onClick={restart}>{t('arithmeticaRetry')}</button>
          <button type="button" onClick={()=>setShowHelp(v=>!v)}
            aria-expanded={showHelp}>{t('arithmeticaHow')}</button>
        </div>
        {showHelp&&<p className="arithmetica-help-expanded">{t('arithmeticaRules')}</p>}
        <p className="arithmetica-offline">{t('arithmeticaOffline')}</p>
      </aside>
    </section>
  </main>;
}
