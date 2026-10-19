import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { App as NativeApp } from '@capacitor/app';
import { useI18n } from './i18n.tsx';
import { feedback, storage, type Settings } from './platform.ts';
import { enterGameLandscape, leaveGameLandscape } from './immersive-game.ts';
import { AppleWormScreenshotBoard } from './AppleWormScreenshotBoard.tsx';
import { screenshotStage, SCREENSHOT_GROUPS, type SourceDirection } from '../../../packages/games/apple-worm/screenshot-stages.ts';
import { startScreenshotWorm, moveScreenshotWorm, replayScreenshotWorm,
  type ScreenshotState } from '../../../packages/games/apple-worm/screenshot-engine.ts';
import './apple-worm-screenshots.css';

const SAVE_KEY='apple-worm-screenshots-105-v1';
interface Session { state:ScreenshotState; route:SourceDirection[]; history:ScreenshotState[] }
interface Save { version:1; level:number; route:SourceDirection[]; completed:number[] }
const begin=(level:number):Session=>({state:startScreenshotWorm(level),route:[],history:[]});
const arrows:Record<SourceDirection,string>={left:'←',up:'↑',down:'↓',right:'→'};
const keys:Record<string,SourceDirection>={ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',ArrowUp:'up',w:'up',ArrowDown:'down',s:'down'};

export function AppleWormScreenshotPage({onExit,onLegacy,settings,onToggleSound}:{
  onExit:()=>void;onLegacy:()=>void;settings:Settings;onToggleSound:()=>void;
}) {
  const {lang}=useI18n();const ar=lang==='ar';
  const text=(en:string,arabic:string)=>ar?arabic:en;
  const [session,setSession]=useState<Session>(()=>begin(1));
  const current=useRef(session);current.current=session;
  const [loaded,setLoaded]=useState(false);
  const [completed,setCompleted]=useState<number[]>([]);
  const [choose,setChoose]=useState(false);
  const [group,setGroup]=useState(0);
  const [practice,setPractice]=useState(false);
  const [menu,setMenu]=useState(false);
  const [saveError,setSaveError]=useState(false);
  const {state}=session;const stage=screenshotStage(state.level);
  const unlocked=Array.from({length:105},(_,i)=>i+1).find(n=>!completed.includes(n))??105;
  const saveQueue=useRef(Promise.resolve());

  useEffect(()=>{
    let active=true;
    void storage.get<Save|null>(SAVE_KEY,null).then(saved=>{
      if(!active)return;
      if(saved?.version===1) {
        const level=Number.isInteger(saved.level)&&saved.level>=1&&saved.level<=105?saved.level:1;
        const restored=replayScreenshotWorm(level,saved.route);
        if(restored) {
          let before=startScreenshotWorm(level);const history:ScreenshotState[]=[];
          for(const d of saved.route){history.push(before);before=moveScreenshotWorm(before,d);}
          setSession({state:restored,route:saved.route,history});
        }
        setCompleted(Array.isArray(saved.completed)?[...new Set(saved.completed.filter(n=>Number.isInteger(n)&&n>=1&&n<=105))]:[]);
      }
      setLoaded(true);
    });
    return ()=>{active=false;};
  },[]);
  useEffect(()=>{
    if(!loaded)return;
    const save:Save={version:1,level:state.level,route:session.route,completed};
    // Ordered writes prevent a slow earlier native Preferences write winning.
    saveQueue.current=saveQueue.current.catch(()=>{}).then(()=>storage.set(SAVE_KEY,save)).catch(()=>setSaveError(true));
  },[loaded,state.level,session.route,completed]);
  useEffect(()=>{
    if(state.phase==='won')setCompleted(old=>old.includes(state.level)?old:[...old,state.level]);
  },[state.phase,state.level]);
  useEffect(()=>{
    void enterGameLandscape();let active=true;let remove:(()=>void)|undefined;
    void NativeApp.addListener('backButton',onExit).then(h=>{
      if(active)remove=()=>{void h.remove();};else void h.remove();
    }).catch(()=>{});
    return ()=>{active=false;remove?.();void leaveGameLandscape();};
  },[onExit]);
  const update=(next:Session)=>{current.current=next;setSession(next);};
  const move=(d:SourceDirection)=>{
    if(!loaded||choose||menu||current.current.route.length>=5000)return;
    const old=current.current;const next=moveScreenshotWorm(old.state,d);
    if(next===old.state)return;
    update({state:next,route:[...old.route,d],history:[...old.history,old.state]});
    feedback(settings,next.phase==='won'?'win':'move');
  };
  const undo=()=>{
    const old=current.current,prior=old.history.at(-1);if(!prior)return;
    update({state:prior,route:old.route.slice(0,-1),history:old.history.slice(0,-1)});
  };
  const restart=()=>update(begin(current.current.state.level));
  const select=(n:number)=>{update(begin(n));setChoose(false);};
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      if(e.altKey||e.ctrlKey||e.metaKey||e.repeat)return;
      if(e.target instanceof HTMLElement&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
      if(e.key==='Escape'){setChoose(false);setMenu(false);return;}
      if(choose||menu)return;
      if(keys[e.key]){e.preventDefault();move(keys[e.key]!);}
      else if(e.key==='z'){e.preventDefault();undo();}
      else if(e.key==='r'){e.preventDefault();restart();}
    };
    window.addEventListener('keydown',handler);return ()=>window.removeEventListener('keydown',handler);
  });

  return createPortal(<main className="worm-page screenshot-worm-page" dir={ar?'rtl':'ltr'} data-phase={state.phase} data-stage-origin="user-screenshot" data-pdf-reference="approved" data-source-stage-count="105">
    <header className="screenshot-worm-header">
      <button className="source-exit" onClick={onExit} aria-label={text('Back to games','العودة للألعاب')}>↩</button>
      <div className="source-title"><strong>{text('Apple Worm','دودة التفاح')}</strong>
        <small>{text('105 Screenshot-Based Stages','105 مراحل مبنية على الصور')}</small></div>
      <button onClick={()=>{setGroup(Math.floor((state.level-1)/15));setChoose(true);setMenu(false);}}
        aria-label={text('Choose stage','اختيار المرحلة')} aria-expanded={choose}>▦ <span>{state.level}/105</span></button>
      <button onClick={()=>setMenu(!menu)} aria-label={text('Game options','خيارات اللعبة')}>☰</button>
    </header>
    <section className="source-playfield" aria-label={text('Apple Worm board','لوحة دودة التفاح')}>
      <AppleWormScreenshotBoard state={state} onMove={move} label={text('Swipe or use arrow keys to move','اسحب أو استخدم الأسهم للتحريك')}/>
    </section>
    <footer className="screenshot-worm-footer">
      <div className="source-stats" aria-live="polite">
        <strong>{text('Stage','المرحلة')} {state.level}</strong>
        <span>{text('Moves','الحركات')}: <b className="source-moves">{state.moves}</b></span>
        <span>🍎 {stage.apples.filter((_,i)=>Boolean(state.eaten&2**i)).length}/{stage.apples.length}</span>
      </div>
      <div className="source-actions">
        <button onClick={undo} disabled={!session.history.length} aria-label={text('Undo','تراجع')}>↶</button>
        <button onClick={restart} aria-label={text('Restart','إعادة المرحلة')}>⟳</button>
        <div className="source-dpad" dir="ltr">
          {(['left','up','down','right'] as const).map(d=><button key={d} onClick={()=>move(d)} disabled={state.phase!=='playing'||!loaded}
            aria-label={ar?({left:'يسار',right:'يمين',up:'أعلى',down:'أسفل'}[d]):d}>{arrows[d]}</button>)}
        </div>
      </div>
      {!stage.portal&&<small className="source-note">
        {text('No exit is visible in this reference. Movement practice is available.','لا يظهر مخرج في هذا المرجع. يمكنك تجربة الحركة.')}</small>}
      {saveError&&<small role="alert">{text('Progress could not be saved on this device.','تعذر حفظ التقدم على هذا الجهاز.')}</small>}
    </footer>
    {menu&&<div className="source-modal-backdrop"><section role="dialog" aria-modal="true" aria-label={text('Game options','خيارات اللعبة')} className="source-modal">
      <h2>{text('Game options','خيارات اللعبة')}</h2>
      <button onClick={onToggleSound} aria-pressed={settings.sound}>{text('Sound','الصوت')}: {settings.sound?'🔊':'🔇'}</button>
      <p>{text('The screenshot is the starting position. Push gray blocks, avoid spikes and saws, and reach the black exit. Apples are optional.','الصورة هي وضع البداية. ادفع الصناديق الرمادية، وتجنب الأشواك والمناشير، وادخل المخرج الأسود. التفاح اختياري.')}</p>
      <p>{text('This reconstruction is under review. Saws stay at their photographed positions; some stages may remain unsolved.','هذه النسخة قيد المراجعة. تبقى المناشير في مواقعها المصورة؛ وقد تبقى بعض المراحل بلا حل مؤكد.')}</p>
      <button onClick={onLegacy}>{text('Legacy practice — 40 independent puzzles','تدريب قديم — 40 لغزًا مستقلًا')}</button>
      <button onClick={()=>setMenu(false)} autoFocus>{text('Close','إغلاق')}</button>
    </section></div>}
    {choose&&<div className="source-modal-backdrop"><section role="dialog" aria-modal="true" aria-label={text('Choose stage','اختيار المرحلة')} className="source-modal source-levels">
      <div className="source-modal-heading"><h2>{text('105 Screenshot-Based Stages','105 مراحل مبنية على الصور')}</h2><button onClick={()=>setChoose(false)} aria-label={text('Close','إغلاق')} autoFocus>×</button></div>
      <div className="source-group-tabs" role="tablist" aria-label={text('Stage groups','مجموعات المراحل')}>
        {SCREENSHOT_GROUPS.map((p,i)=><button key={i} role="tab" aria-selected={group===i} onClick={()=>setGroup(i)}>{p.start}–{p.end}</button>)}
      </div>
      <label className="source-practice"><input type="checkbox" checked={practice} onChange={e=>setPractice(e.target.checked)}/>
        {text('Practice: try any stage','تدريب: جرّب أي مرحلة')}</label>
      <div className="source-stage-grid" role="tabpanel">
        {Array.from({length:15},(_,i)=>group*15+i+1).map(n=><button key={n} disabled={!practice&&n>unlocked}
          aria-label={`${text('Stage','المرحلة')} ${n}${completed.includes(n)?text(' completed',' مكتملة'):''}`}
          aria-current={n===state.level?'step':undefined} onClick={()=>select(n)}>
          <b>{n}</b><span>{completed.includes(n)?'✓':n>unlocked&&!practice?'🔒':''}</span>
        </button>)}
      </div>
      <p>{text('Reconstructed from the supplied screenshots. Visual and gameplay review is ongoing.','أُعيد بناؤها من الصور المرفقة. مراجعة المطابقة وقابلية الحل مستمرة.')}</p>
    </section></div>}
    {state.phase!=='playing'&&!choose&&!menu&&<div className="source-result" role="status">
      <strong>{state.phase==='won'?text('Stage complete','اكتملت المرحلة'):text('Try again','حاول مجددًا')}</strong>
      <button onClick={undo} disabled={!session.history.length}>{text('Undo','تراجع')}</button>
      <button onClick={()=>state.phase==='won'&&state.level<105?select(state.level+1):restart()}>
        {state.phase==='won'&&state.level<105?text('Next stage','المرحلة التالية'):text('Restart','إعادة')}</button>
    </div>}
  </main>,document.body);
}
