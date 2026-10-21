import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { AppleWormClassicBoard } from './AppleWormClassicBoard.tsx';
import { AppleWormForest } from './AppleWormForest.tsx';
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
export type WormScreen='home'|'levels'|'game';
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
export function AppleWormScreenshotGame({onExit,settings,onToggleSound}:{
  onExit:()=>void;settings:Settings;onToggleSound?:()=>void;
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
  const [screen,setScreen]=useState<WormScreen>('home');
  const [showOptions,setShowOptions]=useState(false);
  const [showHelp,setShowHelp]=useState(false);
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
    // Opening the same in-progress level from the new selector must preserve
    // the saved worm location; replaying a completed/lost level restarts.
    const preserve=n===level&&stateRef.current.phase==='playing';
    setLevel(n);
    setBiteFx(null);
    if(!preserve){
      const next=startScreenshotWorm(n);
      stateRef.current=next;
      setState(next);
      setHistory([]);
    }
    setGroup(Math.floor((n-1)/15));
    setScreen('game');setShowOptions(false);setShowHelp(false);
  };
  useEffect(()=>{
    const callback=(e:KeyboardEvent)=>{
      if(e.repeat||e.altKey||e.ctrlKey||e.metaKey||screen!=='game'||showOptions||
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
  const unlocked=Math.min(105,Math.max(10,level,...completed.map(n=>n+1)));
  const getStars=(n:number)=>completed.includes(n)?'★★★':n<=unlocked?'☆☆☆':'';
  const toLevels=()=>{setGroup(Math.floor((level-1)/15));setShowOptions(false);setScreen('levels');};
  const toHome=()=>{setShowOptions(false);setScreen('home');};
  const goNext=()=>{if(level<105&&level+1<=unlocked)pick(level+1);};

  return createPortal(
    <main className="worm-page worm-immersive worm-source-play worm3"
      dir={ar?'rtl':'ltr'}
      data-display="immersive-landscape" data-stage-origin="user-screenshot"
      data-source-stage-count={APPLE_WORM_SCREENSHOT_LEVEL_COUNT}
      data-visual-revision={APPLE_WORM_VISUAL_REVISION}
      data-worm-screen={screen}>
      <AppleWormForest/>
      {screen==='home'&&<section className="worm3-home"
        aria-label={t('Apple Worm start screen','شاشة بداية دودة التفاح')}>
        <div className="worm3-top-left">
          <button className="worm3-icon-button" type="button"
            aria-label={t('Back to NAQLA','العودة إلى نقلة')} title={t('Back to NAQLA','العودة إلى نقلة')}
            onClick={onExit}>⌂</button>
          <button className="worm3-icon-button" type="button"
            aria-label={t('Settings','الإعدادات')} onClick={()=>setShowOptions(v=>!v)}>⚙️</button>
        </div>
        <div className="worm3-title-logo" aria-label="Apple Worm">
          <span className="worm3-title-apple">Apple</span>
          <span className="worm3-title-worm">Worm</span>
          <span className="worm3-logo-leaf" aria-hidden="true">🍃</span>
        </div>
        <button type="button" className="worm3-play-button" disabled={!ready}
          onClick={()=>{setShowOptions(false);setScreen('levels');}}
          aria-label={t('Play Apple Worm','العب دودة التفاح')}>
          <span aria-hidden="true">▶</span>
        </button>
        {showOptions&&<div className="worm3-options worm3-home-options" role="dialog"
          aria-label={t('Options','الخيارات')}>
          {onToggleSound&&<button type="button" onClick={onToggleSound}>
            {settings.sound?'🔊':'🔇'} {t('Sound','الصوت')}</button>}
          <button type="button" onClick={onExit}>{t('Back to NAQLA','العودة إلى نقلة')}</button>
          <button type="button" onClick={()=>setShowOptions(false)}>{t('Close','إغلاق')}</button>
        </div>}
      </section>}
      {screen==='levels'&&<section className="worm3-levels"
        aria-label={t('Level Select','اختيار المرحلة')}>
        <div className="worm3-top-left">
          <button type="button" className="worm3-icon-button"
            onClick={toHome} aria-label={t('Main menu','القائمة الرئيسية')}>⌂</button>
        </div>
        <div className="worm3-level-panel">
          <div className="worm3-level-heading">{t('Level Select','اختيار المرحلة')}</div>
          <button className="worm3-page-arrow worm3-page-prev"
            type="button" aria-label={t('Previous level page','صفحة المراحل السابقة')}
            disabled={group===0} onClick={()=>setGroup(g=>Math.max(0,g-1))}>◀</button>
          <div className="worm3-level-grid">
            {Array.from({length:Math.min(15,105-group*15)},(_,i)=>group*15+i+1).map(n=>{
              const locked=n>unlocked;
              return <button className="worm3-level-tile" type="button" key={n}
                disabled={locked} onClick={()=>pick(n)}
                aria-label={t('Level','المرحلة')+' '+n+(locked?t(' locked',' مغلقة'):'')}
                aria-current={n===level?'step':undefined}
                data-locked={locked?'true':'false'}>
                {locked?<span className="worm3-padlock" aria-hidden="true">🔒</span>:
                  <span className="worm3-tile-stars" aria-hidden="true">{getStars(n)}</span>}
                <span className="worm3-tile-number">{n}</span>
              </button>;
            })}
          </div>
          <button className="worm3-page-arrow worm3-page-next"
            type="button" aria-label={t('Next level page','صفحة المراحل التالية')}
            disabled={group===6} onClick={()=>setGroup(g=>Math.min(6,g+1))}>▶</button>
        </div>
        <div className="worm3-page-label">{group+1} / 7</div>
      </section>}
      {screen==='game'&&<section className="worm3-game"
        aria-label={t('Apple Worm gameplay','لعبة دودة التفاح')}>
        <div className="worm3-top-left">
          <button className="worm3-icon-button" type="button" onClick={toLevels}
            aria-label={t('Choose a level','اختيار المرحلة')} title={t('Choose a level','اختيار المرحلة')}>⌂</button>
          {onToggleSound&&<button className="worm3-icon-button" type="button"
            onClick={onToggleSound} aria-label={t('Sound','الصوت')}>{settings.sound?'🔊':'🔇'}</button>}
        </div>
        <div className="worm3-top-right">
          <button className="worm3-icon-button" type="button"
            onClick={()=>setShowHelp(v=>!v)} aria-label={t('Help','مساعدة')}>💡</button>
          <button className="worm3-icon-button" type="button"
            onClick={reset} aria-label={t('Restart stage','إعادة المرحلة')}>↻</button>
          <button className="worm3-icon-button" type="button"
            onClick={()=>setShowOptions(v=>!v)} aria-label={t('Game menu','قائمة اللعبة')}>☰</button>
        </div>
        <div className="worm3-goal" aria-hidden="true">🐛 → 🌀</div>
        <div className="worm3-board-zone">
          <svg role="img" aria-label={t('Swipe Apple Worm board','اسحب لتحريك الدودة')}
            viewBox="0 0 630 270" data-source-level={level}
            data-terrain-cell-count={board.rows.reduce((n,row)=>
              n+[...row].filter(cell=>cell==='#').length,0)}
            preserveAspectRatio="xMidYMid meet"
            onPointerDown={begin} onPointerUp={finish}
            onPointerCancel={()=>{swiping.current=null;}}
            onLostPointerCapture={()=>{swiping.current=null;}}
            style={{display:'block',width:'100%',height:'100%',touchAction:'none',direction:'ltr'}}>
            <AppleWormClassicBoard board={board} body={state.body}
              remaining={remaining} grayPositions={state.grayPositions}
              biteFx={biteFx}/>
          </svg>
        </div>
        <div className="worm3-move-pad" aria-label={t('Movement controls','أزرار التحريك')}>
          {controls.map(([dir,glyph])=><button type="button" key={dir}
            className={'worm3-pad-'+dir} onClick={()=>move(dir)}
            disabled={!board.canMove||state.phase!=='playing'}
            aria-label={t(dir==='up'?'Move up':dir==='down'?'Move down':
              dir==='left'?'Move left':'Move right',dir==='up'?'أعلى':dir==='down'?'أسفل':
              dir==='left'?'يسار':'يمين')}>{glyph}</button>)}
        </div>
        <span className="worm3-current-level">{String(level).padStart(2,'0')}</span>
        {showHelp&&<div className="worm3-help" role="status">
          {t('Swipe on the puzzle to move the worm. Reach the spiral exit. Some source objects are still under verification.',
             'اسحب على اللوحة لتحريك الدودة والوصول إلى الدوامة. بعض عناصر المراحل الأصلية لا تزال قيد التحقق.')}
          <button type="button" onClick={()=>setShowHelp(false)}>✕</button>
        </div>}
        {!board.portal&&<div className="worm3-help worm3-unknown" role="status">
          {t('Exit location not yet verified for this stage',
            'مكان المخرج لم يُتحقق منه لهذه المرحلة بعد')}</div>}
        {showOptions&&<div className="worm3-options worm3-game-options" role="dialog"
          aria-label={t('Game menu','قائمة اللعبة')}>
          <button type="button" onClick={toLevels}>{t('Level Select','اختيار المرحلة')}</button>
          <button type="button" onClick={reset}>{t('Restart','إعادة')}</button>
          <button type="button" onClick={undo} disabled={!history.length}>{t('Undo','تراجع')}</button>
          <button type="button" onClick={toHome}>{t('Main menu','القائمة الرئيسية')}</button>
          <button type="button" onClick={onExit}>{t('Back to NAQLA','العودة إلى نقلة')}</button>
          <button type="button" onClick={()=>setShowOptions(false)}>{t('Close','إغلاق')}</button>
        </div>}
        {state.phase!=='playing'&&<div className="worm3-result" role="status">
          <div className="worm3-result-card">
            <h2>{state.phase==='won'?t('Level Complete!','اكتملت المرحلة!'):
              t('Try Again','حاول مرة أخرى')}</h2>
            {state.phase==='won'&&<span className="worm3-result-stars">★★★</span>}
            <div className="worm3-result-actions">
              <button type="button" onClick={reset}>{t('Retry','إعادة')}</button>
              <button type="button" onClick={toLevels}>{t('Levels','المراحل')}</button>
              {state.phase==='won'&&level<105&&
                <button type="button" onClick={goNext}>{t('Next','التالي')}</button>}
            </div>
          </div>
        </div>}
      </section>}
    </main>,document.body
  );
}
