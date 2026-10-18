import { useRef, useState, type PointerEvent } from 'react';
import {
  startVideoWorm, moveVideoWorm, solveVideoWorm,
  type VideoWormDirection, type VideoWormState,
} from '../../../packages/games/apple-worm/video-traced-engine.ts';
import { appleWormVideoTracedStage, APPLE_WORM_VIDEO_TRACED_COUNT }
  from '../../../packages/games/apple-worm/video-traced-stages.ts';

/**
 * Optional original-video geometry PLAYTEST for stages 1–10.
 *
 * Source layout comes from the author's verified screenshot transcription,
 * while gravity, controls and solution are still PROVISIONAL. No claim of
 * faithful video route. Does NOT change the existing 40-stage save namespace.
 */
export function AppleWormVideoPlaytest({level,lang}:{level:number;lang:'ar'|'en'}) {
  const stage=appleWormVideoTracedStage(level);
  const [state,setState]=useState<VideoWormState>(()=>startVideoWorm(level));
  const [history,setHistory]=useState<VideoWormState[]>([]);
  const gesture=useRef<{pointerId:number;x:number;y:number}|null>(null);
  const ar=lang==='ar';
  const label=(english:string,arabic:string)=>ar?arabic:english;
  const move=(direction:VideoWormDirection)=>{
    setState(previous=>{
      const next=moveVideoWorm(previous,direction);
      if(next!==previous)setHistory(items=>[...items.slice(-99),previous]);
      return next;
    });
  };
  const onDown=(event:PointerEvent<SVGSVGElement>)=>{
    if(!event.isPrimary || gesture.current)return;
    gesture.current={pointerId:event.pointerId,x:event.clientX,y:event.clientY};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onUp=(event:PointerEvent<SVGSVGElement>)=>{
    if(gesture.current?.pointerId!==event.pointerId)return;
    const {x,y}=gesture.current;
    gesture.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    const dx=event.clientX-x,dy=event.clientY-y;
    if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;
    move(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));
  };
  const width=stage.width*30,height=stage.height*30;
  const allApples=stage.apples.every((_,i)=>state.applesBitmask&(1<<i));

  return <section role="region" aria-label={label('Experimental source-map playtest','تجربة خريطة الفيديو')}
    style={{width:'min(100%,930px)',display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
    <p role="note" style={{margin:0,fontSize:12,color:'#ffdea0'}}>
      {label(
        'EXPERIMENTAL: actual video map, provisional physics. A computer-found win is not video-verified.',
        'تجريبي: الخريطة مأخوذة من الفيديو، لكن الفيزياء وطريقة الحل لم تتطابق مع المقطع نهائيًا.',
      )}
    </p>
    <svg role="img" aria-label={label('Swipe to test source map','اسحب لاختبار خريطة الفيديو')}
      viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet"
      onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={()=>{gesture.current=null;}}
      onLostPointerCapture={()=>{gesture.current=null;}}
      style={{display:'block',width:'100%',height:'auto',maxHeight:'42dvh',
        background:'#a7e9fa',touchAction:'none',borderRadius:12,border:'2px solid #94cce3'}}>
      <rect width={width} height={height} fill="#9de3f7"/>
      <path d={`M0 ${height-34}Q90 ${height-90} 160 ${height-35}T320 ${height-33}T480 ${height-35}T700 ${height-33}V${height}H0Z`} fill="#e6faff"/>
      {stage.blocks.map(([x,y],i)=><rect key={'b'+i}
        x={30*x} y={30*y} width={30} height={30} fill="#795032"
        stroke="#4d3225" strokeWidth="2"/>)}
      {stage.apples.map(([x,y],i)=>!(state.applesBitmask&(1<<i))&&
        <g key={'a'+i} transform={`translate(${x*30+15} ${y*30+15})`}>
          <circle r="12" cy="1" fill="#e5362e" stroke="#aa1b25" strokeWidth="2"/>
          <path d="M0 -9q2 -7 8 -9" fill="none" stroke="#328a43" strokeWidth="3"/>
        </g>)}
      <g transform={`translate(${stage.exit[0]*30+15} ${stage.exit[1]*30+15})`}>
        <circle r="16" fill={allApples?'#273552':'#525763'} stroke="#aaa8c0" strokeWidth="3"/>
        <path d="M-9 -2C-7 -15 12 -14 9 0S-7 11 -2 1" fill="none" stroke="#cdd3f6" strokeWidth="2"/>
      </g>
      {state.body.map(([x,y],i)=><g key={'w'+i}>
        <circle cx={x*30+15} cy={y*30+15} r="14"
          fill={i===0?'#78e54c':'#54c736'} stroke="#2d9b2b" strokeWidth="2"/>
        {i===0&&<g><circle cx={x*30+20} cy={y*30+9} r="4" fill="#fff"/>
          <circle cx={x*30+21} cy={y*30+9} r="2" fill="#172d1c"/></g>}
      </g>)}
    </svg>
    <p role="status" style={{margin:0,fontSize:13,color:'#fff'}}>
      {label('Moves','الحركات')}: {state.moves} · {label('Apples','التفاح')}:
      {stage.apples.filter((_,i)=>Boolean(state.applesBitmask&(1<<i))).length}/{stage.apples.length}
      {' · '}{state.phase==='won'?label('Candidate route complete','اكتمل الحل التجريبي'):
        state.phase==='lost'?label('Fell off: restart','سقطت الدودة: أعد المحاولة'):
          label('Swipe on board','اسحب فوق الخريطة')}
    </p>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center'}}>
      <button type="button" onClick={()=>move('left')}>←</button>
      <button type="button" onClick={()=>move('up')}>↑</button>
      <button type="button" onClick={()=>move('down')}>↓</button>
      <button type="button" onClick={()=>move('right')}>→</button>
      <button type="button" onClick={()=>{
        setState(startVideoWorm(level));setHistory([]);
      }}>{label('Restart','إعادة')}</button>
      <button type="button" disabled={!history.length} onClick={()=>{
        const prior=history.at(-1);
        if(prior)setState(prior);
        setHistory(items=>items.slice(0,-1));
      }}>{label('Undo','تراجع')}</button>
      <button type="button" onClick={()=>{
        const route=solveVideoWorm(level,100000);
        // A shortest route computed by provisional physics; cannot be called
        // the source video's documented solution.
        if(route) {
          let next=startVideoWorm(level);
          for(const d of route)next=moveVideoWorm(next,d);
          setState(next);setHistory([]);
        }
      }}>{label('Test provisional solver','اختبار الحل التجريبي')}</button>
    </div>
  </section>;
}

export const APPLE_WORM_VIDEO_PLAYTEST_LEVEL_COUNT = APPLE_WORM_VIDEO_TRACED_COUNT;
