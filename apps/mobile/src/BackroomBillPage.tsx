import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  BACKROOM_SAVE, BACKROOM_STEP, createRoom, defaultBackroomProgress, MAX_DEPTH,
  MONSTERS, recordRoomDefeat, recordRoomVictory, remainingPieces,
  saveBackroomProgress, tickRoom, type BackroomProgress, type EnemyKind, type Point, type Room,
} from '../../../packages/games/backroom-bill/engine.ts';
import { paintBackroom, paintBackroomMap, VIEW_HEIGHT, VIEW_WIDTH } from './BackroomBillArt.tsx';
import { feedback, storage, type Settings } from './platform.ts';
import { useI18n } from './i18n.tsx';

const visibleData=(room:Room,progress:BackroomProgress)=>({
  depth:room.depth, remaining:remainingPieces(room),total:room.pieces.length,
  lives:room.lives,stamina:room.stamina,phase:room.phase,
  captured:room.enemies.filter(m=>!m.active).length,
  progress:progress.unlocked, catalog:progress.catalog, event:room.event,
});
type Display=ReturnType<typeof visibleData>;
const keyMap:Record<string,Point>={
  arrowup:{x:0,y:-1},w:{x:0,y:-1},z:{x:0,y:-1},
  arrowdown:{x:0,y:1},s:{x:0,y:1},
  arrowleft:{x:-1,y:0},a:{x:-1,y:0},q:{x:-1,y:0},
  arrowright:{x:1,y:0},d:{x:1,y:0},
};
const mergeKeys=(pressed:Set<string>,swipe:Point):Point=>{
  let x=swipe.x,y=swipe.y;
  if(!pressed.size)return {x,y};
  x=0;y=0;
  for(const key of pressed){
    const vector=keyMap[key];
    if(vector){x+=vector.x;y+=vector.y;}
  }
  return {x,y};
};

export function BackroomBillPage({onExit,settings}:{onExit:()=>void;settings:Settings}){
  const {t,lang}=useI18n();
  const canvas=useRef<HTMLCanvasElement>(null);
  const mapCanvas=useRef<HTMLCanvasElement>(null);
  const game=useRef(createRoom());
  const progress=useRef<BackroomProgress>(defaultBackroomProgress());
  const settingsRef=useRef(settings);
  settingsRef.current=settings;
  const pressed=useRef(new Set<string>());
  const joystick=useRef<Point>({x:0,y:0});
  const pointerId=useRef<number|null>(null);
  const pointerOrigin=useRef<Point|null>(null);
  const sprintTouch=useRef(false);
  const pausedRef=useRef(false);
  const [paused,setPaused]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [view,setView]=useState<Display>(()=>visibleData(game.current,progress.current));
  const [showFloors,setShowFloors]=useState(false);
  const [showCompendium,setShowCompendium]=useState(false);
  const [eventBanner,setEventBanner]=useState<string|null>(null);
  const uiLast=useRef(0);
  const sync=useCallback(()=>setView(visibleData(game.current,progress.current)),[]);
  const save=useCallback(()=>{void storage.set(BACKROOM_SAVE,progress.current);},[]);
  useEffect(()=>{
    let active=true;
    void storage.get<unknown>(BACKROOM_SAVE,null).then(saved=>{
      if(!active)return;
      progress.current=saveBackroomProgress(saved);
      game.current=createRoom(progress.current.unlocked);
      setLoaded(true);sync();
    });
    return ()=>{active=false;};
  },[sync]);
  const start=(depth:number)=>{
    if(depth<1||depth>progress.current.unlocked)return;
    game.current=createRoom(depth);
    joystick.current={x:0,y:0};
    pressed.current.clear();
    pointerId.current=null;
    pointerOrigin.current=null;
    pausedRef.current=false;setPaused(false);
    setShowFloors(false);setEventBanner(null);sync();
  };
  useEffect(()=>{
    if(!loaded)return;
    const handleDown=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null;
      if(target?.closest('input,textarea,select,[contenteditable="true"]'))return;
      const key=event.key.toLowerCase();
      if(keyMap[key]||key==='shift'){event.preventDefault();pressed.current.add(key);}
      if(key==='escape'&&!event.repeat){
        pausedRef.current=!pausedRef.current;
        setPaused(pausedRef.current);
      }
    };
    const handleUp=(event:KeyboardEvent)=>pressed.current.delete(event.key.toLowerCase());
    const handleBlur=()=>{pressed.current.clear();joystick.current={x:0,y:0};};
    window.addEventListener('keydown',handleDown);
    window.addEventListener('keyup',handleUp);
    window.addEventListener('blur',handleBlur);
    return ()=>{
      window.removeEventListener('keydown',handleDown);
      window.removeEventListener('keyup',handleUp);
      window.removeEventListener('blur',handleBlur);
    };
  },[loaded]);
  useEffect(()=>{
    if(!loaded||!canvas.current||!mapCanvas.current)return;
    const screen=canvas.current;
    const minimap=mapCanvas.current;
    const context=screen.getContext('2d');
    const mapContext=minimap.getContext('2d');
    if(!context||!mapContext)return;
    const pixelRatio=Math.min(2,window.devicePixelRatio||1);
    screen.width=VIEW_WIDTH*pixelRatio;screen.height=VIEW_HEIGHT*pixelRatio;
    minimap.width=165*pixelRatio;minimap.height=165*pixelRatio;
    context.setTransform(pixelRatio,0,0,pixelRatio,0,0);
    mapContext.setTransform(pixelRatio,0,0,pixelRatio,0,0);
    let frame=0,lastTime=0,accumulator=0;
    const animate=(now:number)=>{
      if(lastTime===0)lastTime=now;
      accumulator=Math.min(.07,accumulator+Math.min(.05,Math.max(0,(now-lastTime)/1000)));
      lastTime=now;
      if(!pausedRef.current&&!showFloors&&!showCompendium){
        let steps=0;
        while(accumulator>=BACKROOM_STEP&&steps++<6){
          accumulator-=BACKROOM_STEP;
          const room=game.current;
          if(room.phase==='exploring'){
            const input=mergeKeys(pressed.current,joystick.current);
            const sprint=sprintTouch.current||pressed.current.has('shift');
            tickRoom(room,input,BACKROOM_STEP,sprint);
            const message=room.event;
            if(message){
              room.event=null;
              setEventBanner(message);
              if(message==='caught'||message==='trap')feedback(settingsRef.current,'move');
              if(message==='exit')feedback(settingsRef.current,'win');
              sync();
            }
            if(room.phase==='escape'){
              progress.current=recordRoomVictory(progress.current,room);
              save();sync();
            }else if(room.phase==='dead'){
              progress.current=recordRoomDefeat(progress.current,room);
              save();sync();
            }
          }
        }
      }else accumulator=0;
      paintBackroom(context,game.current,now*.001,settingsRef.current.reduceMotion);
      paintBackroomMap(mapContext,game.current);
      if(now-uiLast.current>180){
        uiLast.current=now;sync();
      }
      frame=requestAnimationFrame(animate);
    };
    frame=requestAnimationFrame(animate);
    return ()=>cancelAnimationFrame(frame);
  },[loaded,showFloors,showCompendium,save,sync]);
  const onPointerDown=(event:PointerEvent<HTMLCanvasElement>)=>{
    if(!loaded||pausedRef.current||game.current.phase!=='exploring'||
       (event.pointerType==='mouse'&&event.button!==0)||pointerId.current!==null)return;
    pointerId.current=event.pointerId;
    pointerOrigin.current={x:event.clientX,y:event.clientY};
    joystick.current={x:0,y:0};
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const onPointerMove=(event:PointerEvent<HTMLCanvasElement>)=>{
    if(event.pointerId!==pointerId.current||!pointerOrigin.current)return;
    event.preventDefault();
    const dx=event.clientX-pointerOrigin.current.x,dy=event.clientY-pointerOrigin.current.y;
    const dist=Math.hypot(dx,dy);
    const size=75;
    const power=Math.min(1,dist/size);
    joystick.current=dist<5?{x:0,y:0}:{x:dx/dist*power,y:dy/dist*power};
  };
  const releasePointer=(event:PointerEvent<HTMLCanvasElement>)=>{
    if(pointerId.current!==event.pointerId)return;
    joystick.current={x:0,y:0};
    pointerOrigin.current=null;
    pointerId.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  if(!loaded)return <main className="backroom-page"><p>{t('loading')}</p></main>;
  const eventNames:{[key:string]:string}={
    found:'backroomBillEventFound',caught:'backroomBillEventCaught',
    trap:'backroomBillEventTrap',exit:'backroomBillEventExit',
  };
  const won=view.phase==='escape',dead=view.phase==='dead';
  return <main className="backroom-page page-enter" dir={lang==='ar'?'rtl':'ltr'}>
    <header className="backroom-heading">
      <div><span className="eyebrow">NAQLA · SURVIVAL HORROR</span><h1>{t('backroomBill')}</h1>
        <p>{t('backroomBillDesc')}</p></div>
      <button type="button" className="button secondary" onClick={onExit}>{t('backroomBillBack')}</button>
    </header>
    <section className="backroom-layout">
      <div className="backroom-machine">
        <div className="backroom-hud">
          <span>{t('backroomBillDepth')} <b>{view.depth.toString().padStart(2,'0')}</b></span>
          <span>{t('backroomBillPieces')} <b>{view.total-view.remaining}/{view.total}</b></span>
          <span className="backroom-hearts" aria-label={t('backroomBillLives')}>
            {Array.from({length:3},(_,i)=><span key={i} className={i<view.lives?'live':'lost'}>♥</span>)}
          </span>
        </div>
        <div className="backroom-stage" dir="ltr">
          <canvas ref={canvas} className="backroom-canvas" aria-label={t('backroomBillControls')}
            role="img" onPointerDown={onPointerDown} onPointerMove={onPointerMove}
            onPointerUp={releasePointer} onPointerCancel={releasePointer}
            onLostPointerCapture={e=>{
              if(pointerId.current===e.pointerId){
                pointerId.current=null;pointerOrigin.current=null;
                joystick.current={x:0,y:0};
              }
            }} />
          <div className="backroom-map" aria-label={t('backroomBillMapLabel')} role="img">
            <canvas ref={mapCanvas}/>
          </div>
          <div className="backroom-game-note" aria-hidden="true">REC · LEVEL {String(view.depth).padStart(2,'0')}</div>
          {eventBanner&&!won&&!dead&&
            <div className="backroom-event" role="status">{t(eventNames[eventBanner]??'backroomBillGoal')}</div>}
          {(won||dead||paused)&&
            <div className="backroom-overlay" role="status">
              <span className="backroom-symbol" aria-hidden="true">{won?'✦':dead?'◉':'Ⅱ'}</span>
              <h2>{t(won?'backroomBillWon':dead?'backroomBillDead':'backroomBillPaused')}</h2>
              <p>{won?t('backroomBillWonDesc'):dead?t('backroomBillDeadDesc'):t('backroomBillControls')}</p>
              <button type="button" onClick={()=>{
                if(paused){
                  pausedRef.current=false;setPaused(false);
                }else start(won?Math.min(MAX_DEPTH,view.depth+1):view.depth);
              }}>{t(won?'backroomBillNext':dead?'backroomBillRetry':'backroomBillResume')}</button>
            </div>}
        </div>
        <div className="backroom-controls">
          <div className="backroom-stamina"><strong>{t('backroomBillStamina')}</strong>
            <div role="progressbar" aria-label={t('backroomBillStamina')}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(view.stamina*100)}>
              <span style={{width:(view.stamina*100)+'%'}} />
            </div>
          </div>
          <button type="button" className="backroom-sprint"
            onPointerDown={event=>{event.preventDefault();sprintTouch.current=true;}}
            onPointerUp={()=>{sprintTouch.current=false;}}
            onPointerCancel={()=>{sprintTouch.current=false;}}
            onPointerLeave={()=>{sprintTouch.current=false;}}>
            <span aria-hidden="true">➤</span> {t('backroomBillSprint')}
          </button>
          <button type="button" className="backroom-pause" onClick={()=>{
            pausedRef.current=!pausedRef.current;setPaused(pausedRef.current);
          }}>{t(paused?'backroomBillResume':'backroomBillPause')}</button>
        </div>
      </div>
      <aside className="backroom-panel">
        <div className="backroom-panel-intro"><strong>{t('backroomBillGoal')}</strong>
          <p>{t('backroomBillHelp')}</p></div>
        <div className="backroom-panel-stats">
          <span>{t('backroomBillPieces')}<b>{view.total-view.remaining}/{view.total}</b></span>
          <span>{t('backroomBillDepth')}<b>{view.depth} / {MAX_DEPTH}</b></span>
          <span>{t('backroomBillCaptured')}<b>{view.catalog.length} / {MONSTERS.length}</b></span>
        </div>
        <div className="backroom-panel-buttons">
          <button type="button" onClick={()=>{setShowFloors(v=>!v);setShowCompendium(false);}}>
            {t('backroomBillFloors')}</button>
          <button type="button" onClick={()=>{setShowCompendium(v=>!v);setShowFloors(false);}}>
            {t('backroomBillCompendium')}</button>
          <button type="button" onClick={()=>start(view.depth)}>{t('backroomBillRestart')}</button>
        </div>
        {showFloors&&<div className="backroom-floor-grid">
          {Array.from({length:MAX_DEPTH},(_,i)=>i+1).map(depth=>
            <button type="button" key={depth} disabled={depth>progress.current.unlocked}
              className={depth===view.depth?'selected':''}
              onClick={()=>start(depth)}>{depth>progress.current.unlocked?'🔒':depth}</button>)}
        </div>}
        {showCompendium&&<div className="backroom-entries">
          {MONSTERS.map((kind:EnemyKind,index)=><div key={kind}>
            <span className="backroom-compendium-glyph">{view.catalog.includes(kind)?['◉','☻','✧'][index]:'?'}</span>
            <span>{view.catalog.includes(kind)?
              t(kind==='lurker'?'backroomBillLurker':kind==='grin'?'backroomBillGrin':'backroomBillMoth'):
              t('backroomBillUnknown')}</span>
          </div>)}
        </div>}
        <p className="backroom-saved">{t('backroomBillSaved')}</p>
      </aside>
    </section>
  </main>;
}
