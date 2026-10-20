import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { AppleWormReferenceScene } from './AppleWormReferenceScene.tsx';
import {
  APPLE_WORM_SCREENSHOT_LEVEL_COUNT, screenshotWormLevel,
  startScreenshotWorm, moveScreenshotWorm, restoreScreenshotWorm,
  type ScreenshotDirection, type ScreenshotState, type ScreenshotPoint,
} from '../../../packages/games/apple-worm/screenshot-game.ts';
import { APPLE_WORM_VIDEO_START_POSES } from '../../../packages/games/apple-worm/video-start-poses-selected-33.ts';
import { APPLE_WORM_VIDEO_BATCH_TWO_STARTS } from '../../../packages/games/apple-worm/video-start-poses-batch-2.ts';
import { APPLE_WORM_VIDEO_BATCH_THREE_STARTS } from '../../../packages/games/apple-worm/video-start-poses-batch-3.ts';
import { useI18n } from './i18n.tsx';
import { storage, type Settings } from './platform.ts';
import { enterGameLandscape, leaveGameLandscape } from './immersive-game.ts';

interface SourceSave { level:number; state:ScreenshotState; completed:number[]; visualRevision?:string }
const SAVE_KEY='apple-worm-screenshot-source-105-v1';
/** Increases when the reference rendering/initial layouts change. */
export const APPLE_WORM_VISUAL_REVISION='PDF105-R11';
const keyMap:Record<string,ScreenshotDirection>={
  arrowup:'up',w:'up',arrowdown:'down',s:'down',
  arrowleft:'left',a:'left',arrowright:'right',d:'right',
};
const controls:readonly [ScreenshotDirection,string][]=[
  ['left','←'],['up','↑'],['down','↓'],['right','→'],
];

/** The actual NAQLA gameplay entry for ALL 105 screenshot-derived positions.
 * Geometry and visible objects come only from the source archive. Where head,
 * portal or gray-object behavior is unclear, call it provisional, never solved.
 */
export function AppleWormScreenshotGame({onExit,settings}:{
  onExit:()=>void;settings:Settings;
}) {
  const {lang}=useI18n();
  const ar=lang==='ar';
  const t=(en:string,arabic:string)=>ar?arabic:en;
  const [level,setLevel]=useState(1);
  const [state,setState]=useState<ScreenshotState>(()=>startScreenshotWorm());
  // Keep movement side effects out of React state-updater functions (Strict Mode).
  const stateRef=useRef(state);
  stateRef.current=state;
  const [history,setHistory]=useState<ScreenshotState[]>([]);
  const biteSequence=useRef(0);
  const [biteFx,setBiteFx]=useState<{key:number;apple:ScreenshotPoint}|null>(null);
  const [completed,setCompleted]=useState<number[]>([]);
  const [ready,setReady]=useState(false);
  const [group,setGroup]=useState(0);
  const [showChoose,setShowChoose]=useState(false);
  const swiping=useRef<{id:number;x:number;y:number}|null>(null);
  const board=screenshotWormLevel(level);

  // Cosmetic one-shot feedback; never persists or changes stage state.
  useEffect(()=>{
    if(!biteFx)return;
    const key=biteFx.key;
    const timer=window.setTimeout(()=>setBiteFx(current=>
      current?.key===key?null:current),720);
    return ()=>window.clearTimeout(timer);
  },[biteFx?.key]);

  useEffect(()=>{
    void enterGameLandscape();
    return ()=>{void leaveGameLandscape();};
  },[]);
  useEffect(()=>{
    let mounted=true;
    void storage.get<SourceSave|null>(SAVE_KEY,null).then(saved=>{
      if(!mounted)return;
      if(saved && Number.isInteger(saved.level)&&saved.level>=1&&saved.level<=105){
        const resume=restoreScreenshotWorm(saved.state);
        const n=resume?.level??saved.level;
        setLevel(n);
        setGroup(Math.floor((n-1)/15));
        // A visual-only release MUST NOT reset the player's in-progress worm.
        // The geometry/logic/source maps are unchanged; resume as before.
        // Real source-video starts were reconstructed for selected stages.
        // Do not resurrect an outdated two-/one-cell worm on those levels.
        // Preserve completion history and unmodified levels' saved positions.
        // Only reset an in-progress level whose SOURCE opening pose was
        // added after the saved revision. Previous completed/source stages
        // must NOT be silently reset just because the cosmetic marker changed.
        const savedRevision=Number(saved.visualRevision?.match(/^PDF105-R(\d+)$/)?.[1]??0);
        const needsVideoStartMigration=
          (!!APPLE_WORM_VIDEO_START_POSES[n]&&savedRevision<9)||
          (!!APPLE_WORM_VIDEO_BATCH_TWO_STARTS[n]&&savedRevision<10)||
          (!!APPLE_WORM_VIDEO_BATCH_THREE_STARTS[n]&&savedRevision<11);
        const next=resume&&!needsVideoStartMigration?resume:startScreenshotWorm(n);
        stateRef.current=next;
        setState(next);
        if(Array.isArray(saved.completed))
          setCompleted(saved.completed.filter(x=>Number.isInteger(x)&&x>=1&&x<=105));
      }
      setReady(true);
    }).catch(()=>{if(mounted)setReady(true);});
    return ()=>{mounted=false;};
  },[]);
  useEffect(()=>{
    if(ready)void storage.set(SAVE_KEY,{level,state,completed,
      visualRevision:APPLE_WORM_VISUAL_REVISION} satisfies SourceSave);
  },[ready,level,state,completed]);

  const move=(direction:ScreenshotDirection)=>{
    const previous=stateRef.current;
    const next=moveScreenshotWorm(previous,direction);
    if(next===previous)return;
    stateRef.current=next;
    const justCollected=next.collected.find(i=>!previous.collected.includes(i));
    if(justCollected!==undefined){
      const apple=screenshotWormLevel(previous.level).apples[justCollected];
      if(apple)setBiteFx({key:++biteSequence.current,apple});
    }
    setHistory(h=>[...h.slice(-89),previous]);
    setState(next);
    if(next.phase==='won')setCompleted(c=>c.includes(previous.level)?c:[...c,previous.level]);
  };
  const reset=()=>{
    const next=startScreenshotWorm(level);
    stateRef.current=next;
    setBiteFx(null);
    setState(next);setHistory([]);
  };
  const undo=()=>{
    const prev=history.at(-1);
    if(!prev)return;
    setHistory(h=>h.slice(0,-1));
    stateRef.current=prev;
    setBiteFx(null);
    setState(prev);
  };
  const pick=(n:number)=>{
    if(!Number.isInteger(n)||n<1||n>105)return;
    setLevel(n);
    setBiteFx(null);
    const next=startScreenshotWorm(n);
    stateRef.current=next;
    setState(next);
    setGroup(Math.floor((n-1)/15));
    setHistory([]);
    setShowChoose(false);
  };
  useEffect(()=>{
    const callback=(e:KeyboardEvent)=>{
      if(e.repeat||e.altKey||e.ctrlKey||e.metaKey||showChoose||
         (e.target as HTMLElement|null)?.closest('input,textarea,select,[contenteditable="true"]'))return;
      const k=e.key.toLowerCase(), direction=keyMap[k];
      if(direction){e.preventDefault();move(direction);}
      else if(k==='r'){e.preventDefault();reset();}
      else if(k==='z'){e.preventDefault();undo();}
    };
    window.addEventListener('keydown',callback);
    return ()=>window.removeEventListener('keydown',callback);
  });
  const begin=(event:PointerEvent<SVGSVGElement>)=>{
    if(swiping.current||!event.isPrimary||
       (event.pointerType==='mouse'&&event.button!==0))return;
    swiping.current={id:event.pointerId,x:event.clientX,y:event.clientY};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const finish=(event:PointerEvent<SVGSVGElement>)=>{
    const gesture=swiping.current;
    if(!gesture||gesture.id!==event.pointerId)return;
    swiping.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;
    move(Math.abs(dx)>=Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');
  };
  const remaining=board.apples.filter((_,i)=>!state.collected.includes(i));
  const selectedGroupFrom=group*15+1;
  const selectedGroupEnd=Math.min(105,selectedGroupFrom+14);

  return createPortal(
    <main className="worm-page worm-immersive worm-source-play" dir={ar?'rtl':'ltr'}
      data-display="immersive-landscape" data-stage-origin="user-screenshot"
      data-pdf-reference="approved" data-source-stage-count={APPLE_WORM_SCREENSHOT_LEVEL_COUNT}
      data-visual-revision={APPLE_WORM_VISUAL_REVISION} data-renderer="premium-gallery-game">
      <section className="worm-source-page"
        aria-label={t('Approved Apple Worm stages','مراحل دودة التفاح المعتمدة')}>
        <header className="worm-source-heading">
          <button type="button" onClick={onExit} style={buttonStyle}>
            ↩ {t('Back to NAQLA','العودة لنقلة')}
          </button>
          <div className="worm-source-title">
            <h2>{t('105 original video stages','105 مراحل من الفيديو الأصلي')}</h2>
            <p>{t('Approved game stages • one playable Apple Worm game',
              'المراحل المعتمدة • لعبة دودة التفاح واحدة')}</p>
            <small>{APPLE_WORM_VISUAL_REVISION}</small>
          </div>
          <button type="button" onClick={()=>setShowChoose(open=>!open)}
            aria-expanded={showChoose} aria-controls="worm-source-levels"
            style={buttonStyle}>{t('Choose stage','اختيار المرحلة')} ▦</button>
        </header>
        <div className="worm-source-board-frame">
          <svg role="img" aria-label={t('Swipe Apple Worm board','اسحب لتحريك الدودة')}
            viewBox="0 0 630 270" data-source-level={level}
            data-terrain-cell-count={board.rows.reduce((n,row)=>
              n+[...row].filter(cell=>cell==='#').length,0)}
            preserveAspectRatio="xMidYMid meet"
            onPointerDown={begin} onPointerUp={finish}
            onPointerCancel={()=>{swiping.current=null;}}
            onLostPointerCapture={()=>{swiping.current=null;}}
            style={{display:'block',width:'100%',height:'auto',touchAction:'none',direction:'ltr'}}>
            <AppleWormReferenceScene board={board} body={state.body}
              remaining={remaining} grayPositions={state.grayPositions}
              phase={state.phase} biteFx={biteFx}/>
          </svg>
        </div>
        <div className="worm-source-stats" role="status">
          <strong>{t('Stage','المرحلة')} {level}/{APPLE_WORM_SCREENSHOT_LEVEL_COUNT}</strong>
          <span>{t('Visible apples','التفاح الظاهر')}: {remaining.length}</span>
          <span>{t('Worm segments','أجزاء الدودة')}: {state.body.length}</span>
          <span>{t('Gray obstacles','العوائق الرمادية')}: {board.grayObjects.length}</span>
          <span>{t('Moves','الحركات')}: {state.moves}</span>
          <span>{state.phase==='won'?t('Stage completed!','اكتملت المرحلة!'):
            state.phase==='lost'?t('Restart to retry','أعد المحاولة'):
            t('Enter the exit to win • apples optional',
              'ادخل المخرج للفوز • التفاح اختياري')}</span>
        </div>
        {!board.portal&&<p className="worm-source-caveat" role="status">
          {t('This stage is part of the approved 105-stage set. Its exit is not yet located in the available video frame.',
            'هذه المرحلة من المراحل الـ105 المعتمدة، لكن مكان المخرج لم يُحدد بعد من لقطة الفيديو المتاحة.')}
        </p>}
        <nav className="worm-source-transport" aria-label={t('Stage and movement controls','التحكم بالمرحلة والدودة')}>
          <button type="button" disabled={level<=1} onClick={()=>pick(level-1)} style={buttonStyle}>
            {t('Previous','السابق')}</button>
          <strong>{level}</strong>
          <button type="button" disabled={level>=105} onClick={()=>pick(level+1)} style={buttonStyle}>
            {t('Next','التالي')}</button>
          <button type="button" onClick={undo} disabled={!history.length} style={buttonStyle}>
            {t('Undo','تراجع')}</button>
          <button type="button" onClick={reset} style={buttonStyle}>
            {t('Restart','إعادة')}</button>
          {controls.map(([dir,glyph])=><button type="button" key={dir}
            onClick={()=>move(dir)} disabled={!board.canMove||state.phase!=='playing'}
            style={buttonStyle} aria-label={dir}>{glyph}</button>)}
        </nav>
        <nav id="worm-source-levels" className="worm-source-levels"
          data-open={showChoose?'true':'false'}
          aria-label={t('Approved stages 1 to 105','المراحل المعتمدة من 1 إلى 105')}>
          <div className="worm-source-packs">
            {Array.from({length:7},(_,i)=>i).map(i=><button type="button" key={i}
              onClick={()=>setGroup(i)} aria-pressed={group===i}
              style={{...buttonStyle,background:group===i?'#178f79':'#28546c'}}>
              {i*15+1}–{Math.min((i+1)*15,105)}
            </button>)}
          </div>
          <div className="worm-source-level-grid">
            {Array.from({length:selectedGroupEnd-selectedGroupFrom+1},(_,i)=>i+selectedGroupFrom)
              .map(n=><button type="button" key={n} onClick={()=>pick(n)}
                aria-label={t('Stage ','المرحلة ')+n}
                aria-current={level===n?'step':undefined}
                style={{...buttonStyle,background:level===n?'#178f79':
                  completed.includes(n)?'#367958':'#28546c'}}>
                {completed.includes(n)?'✓ ':''}{n}
              </button>)}
          </div>
        </nav>
      </section>
    </main>,document.body);
}
const buttonStyle={
  border:'1px solid #86aab8',borderRadius:8,
  background:'#28546c',color:'#fff',cursor:'pointer',
  padding:'8px 12px',fontSize:13,fontWeight:600 as const,
};
