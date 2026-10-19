import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { AppleWormReferenceScene } from './AppleWormReferenceScene.tsx';
import {
  APPLE_WORM_SCREENSHOT_LEVEL_COUNT, screenshotWormLevel,
  startScreenshotWorm, moveScreenshotWorm, restoreScreenshotWorm,
  type ScreenshotDirection, type ScreenshotState,
} from '../../../packages/games/apple-worm/screenshot-game.ts';
import { useI18n } from './i18n.tsx';
import { storage, type Settings } from './platform.ts';
import { enterGameLandscape, leaveGameLandscape } from './immersive-game.ts';

interface SourceSave { level:number; state:ScreenshotState; completed:number[]; visualRevision?:string }
const SAVE_KEY='apple-worm-screenshot-source-105-v1';
/** Increases when the reference rendering/initial layouts change. */
export const APPLE_WORM_VISUAL_REVISION='PDF105-R2';
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
export function AppleWormScreenshotGame({onExit,onLegacy,settings}:{
  onExit:()=>void;onLegacy:()=>void;settings:Settings;
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
  const [completed,setCompleted]=useState<number[]>([]);
  const [ready,setReady]=useState(false);
  const [group,setGroup]=useState(0);
  const [showChoose,setShowChoose]=useState(false);
  const swiping=useRef<{id:number;x:number;y:number}|null>(null);
  const board=screenshotWormLevel(level);
  const inSourceMode=true;

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
        // Retain completed stages, but do not revive an old on-board pose after
        // a reference-art/geometry update. Show the corrected PDF start frame.
        const next=resume&&saved.visualRevision===APPLE_WORM_VISUAL_REVISION
          ?resume:startScreenshotWorm(n);
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
    setHistory(h=>[...h.slice(-89),previous]);
    setState(next);
    if(next.phase==='won')setCompleted(c=>c.includes(previous.level)?c:[...c,previous.level]);
  };
  const reset=()=>{
    const next=startScreenshotWorm(level);
    stateRef.current=next;
    setState(next);setHistory([]);
  };
  const undo=()=>{
    const prev=history.at(-1);
    if(!prev)return;
    setHistory(h=>h.slice(0,-1));
    stateRef.current=prev;
    setState(prev);
  };
  const pick=(n:number)=>{
    if(!Number.isInteger(n)||n<1||n>105)return;
    setLevel(n);
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
    <main className="worm-page worm-immersive worm-source-play" dir={ar?'rtl':'ltr'} data-display="immersive-landscape"
      data-stage-origin="user-screenshot" data-pdf-reference="approved" data-source-stage-count={APPLE_WORM_SCREENSHOT_LEVEL_COUNT}
      data-visual-revision={APPLE_WORM_VISUAL_REVISION}
      style={{position:'fixed',inset:0,zIndex:1100,overflowY:'auto',padding:'env(safe-area-inset-top) 10px env(safe-area-inset-bottom)',
        boxSizing:'border-box',background:'linear-gradient(180deg,#193c59,#326181)',color:'white'}}>
      <section aria-label={t('Apple Worm original stages','مراحل دودة التفاح من الصور')}
        style={{maxWidth:1000,margin:'0 auto',display:'flex',flexDirection:'column',gap:6}}>
        <header style={{display:'flex',alignItems:'center',gap:8,justifyContent:'space-between',flexWrap:'wrap'}}>
          <button type="button" onClick={onExit} style={buttonStyle}>
            ↩ {t('Back to NAQLA','العودة لنقلة')}
          </button>
          <div style={{textAlign:'center'}}>
            <strong>{t('Apple Worm','دودة التفاح')}</strong>
            <div style={{fontSize:12,color:'#b8d7e7'}}>{t('Level','المرحلة')} {String(level).padStart(3,'0')} / 105</div>
            <div style={{fontSize:10,color:'#a6e4f0',fontWeight:700}}>{APPLE_WORM_VISUAL_REVISION}</div>
          </div>
          <button type="button" onClick={()=>setShowChoose(n=>!n)} aria-expanded={showChoose}
            style={buttonStyle}>{t('Choose stage','اختيار المرحلة')} ▦</button>
        </header>
        <div style={{fontSize:12,color:'#e8f8ff',lineHeight:1.3,textAlign:'center'}} role="note">
          {t('Reach the black exit to win · Apples are optional',
            'ادخل المخرج الأسود للفوز · التفاح اختياري')}
        </div>
        {showChoose && <div role="dialog" aria-label={t('Stage selector','اختيار المراحل')}
          style={{padding:10,background:'#1b5267',borderRadius:12,display:'flex',flexDirection:'column',gap:9}}>
          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
            {Array.from({length:7},(_,i)=>i).map(i=><button type="button" key={i}
              onClick={()=>setGroup(i)}
              aria-pressed={group===i}
              style={{...buttonStyle,background:group===i?'#1e9b7d':'#24536c',fontSize:12}}>
              {i*15+1}–{Math.min((i+1)*15,105)}
            </button>)}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:3}}>
            {Array.from({length:selectedGroupEnd-selectedGroupFrom+1},(_,i)=>i+selectedGroupFrom)
              .map(n=><button type="button" key={n} onClick={()=>pick(n)}
                aria-label={t('Stage ','المرحلة ')+n}
                aria-current={level===n?'step':undefined}
                style={{...buttonStyle,minWidth:0,padding:'8px 0',fontSize:13,
                  background:level===n?'#20a68b':completed.includes(n)?'#397e57':'#285167'}}>
                {completed.includes(n)?'✓':''}{n}
              </button>)}
          </div>
          <small style={{color:'#e7cba8'}}>{t('All 105 stages follow the numbering of the supplied PDF.',
            'المراحل الـ105 مرتبة بنفس ترتيب صور ملف PDF.')}</small>
        </div>}
        <svg role="img" aria-label={t('Swipe Apple Worm board','اسحب لتحريك الدودة')}
          viewBox="0 0 640 360" data-source-level={level}
          data-terrain-cell-count={board.rows.reduce((n,row)=>n+[...row].filter(cell=>cell==='#').length,0)}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={begin} onPointerUp={finish}
          onPointerCancel={()=>{swiping.current=null;}}
          onLostPointerCapture={()=>{swiping.current=null;}}
          style={{display:'block',width:'100%',height:'auto',maxHeight:'min(54dvh,440px)',minHeight:100,
            touchAction:'none',borderRadius:12,border:'3px solid #a6e4f0',
            background:'#89ceef',boxSizing:'border-box',flexShrink:0}}>
          <AppleWormReferenceScene board={board} body={state.body} remaining={remaining}/>
        </svg>
        <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:7,fontSize:12}}>
          <span>{t('Moves','الحركات')}: {state.moves}</span>
          <span>{t('Optional apples','التفاح الاختياري')}: {state.collected.length}/{board.apples.length}</span>
          <span>{t('Verified completions','الإنجازات المسجلة')}: {completed.length}/105</span>
          <span>{state.phase==='won'?t('Exit reached! Stage complete','وصلت للمخرج! اكتملت المرحلة'):
            state.phase==='lost'?t('Fell: restart','سقطت: أعد'):
            !board.canMove?t('Worm pose unresolved','وضع الدودة غير واضح'):
            t('Swipe or use arrows','اسحب أو استخدم الأسهم')}</span>
        </div>
        <div style={{display:'flex',gap:6,justifyContent:'center',flexWrap:'wrap',alignItems:'center'}}>
          {controls.map(([dir,glyph])=>
            <button type="button" key={dir} onClick={()=>move(dir)}
              disabled={!board.canMove||state.phase!=='playing'}
              style={{...buttonStyle,minWidth:45,fontSize:19}} aria-label={dir}>{glyph}</button>)}
          <button type="button" onClick={undo} disabled={!history.length}
            style={buttonStyle}>{t('Undo','تراجع')}</button>
          <button type="button" onClick={reset} style={buttonStyle}>{t('Restart','إعادة')}</button>
          <button type="button" onClick={()=>pick(Math.min(105,level+1))}
            disabled={level>=105} style={buttonStyle}>{t('Next','التالي')} →</button>
        </div>
        {(!board.portal||!board.canMove)&&<p role="status" style={{margin:'2px 0',textAlign:'center',
          fontSize:11,color:'#efcda5'}}>
          {!board.portal?t('Exit position not yet reconstructed for this PDF frame.',
            'لم يُحدد موقع المخرج في تنفيذ اللعبة لهذه الصورة بعد.'):
            t('Worm controls need reconstruction for this PDF frame.',
            'يحتاج موضع الدودة في تنفيذ اللعبة إلى تصحيح لهذه الصورة.')}
        </p>}
        <footer style={{display:'flex',justifyContent:'center',gap:7,flexWrap:'wrap'}}>
          <button type="button" style={buttonStyle} onClick={onLegacy}>
            {t('Legacy 40 practice maps (not video)','المراحل القديمة 40 (غير معتمدة)')}
          </button>
          <span style={{fontSize:10,color:'#bad4e3',alignSelf:'center'}}>
            {settings.sound?'♪':''} {inSourceMode?t('Screenshot-defined board','لوحة مبنية من الصورة'):''}
          </span>
        </footer>
      </section>
    </main>,document.body);
}
const buttonStyle={
  border:'1px solid #91bbcb',borderRadius:9,
  background:'#25516a',color:'#fff',cursor:'pointer',
  padding:'8px 11px',fontSize:13,fontWeight:600 as const,
};
