import { useId, useRef, type PointerEvent } from 'react';
import { cellContour } from './AppleWormArt.tsx';
import { finishWormGesture, startWormGesture, type WormGesture } from './apple-worm-gestures.ts';
import { screenshotStage, type Cell, type SourceDirection } from '../../../packages/games/apple-worm/screenshot-stages.ts';
import type { ScreenshotState } from '../../../packages/games/apple-worm/screenshot-engine.ts';

const xy=([x,y]:Cell):Cell=>[33+x*30,13+y*30];
const cellPath=(points:readonly Cell[], radius:number)=>cellContour(points.map(([x,y])=>({x,y})),30,radius);

/** Original vectors, never embedded reference frames or extracted third-party sprites.
 * Fixed 640×360 composition with the source grid at (33,13). RTL cannot mirror it.
 */
export function AppleWormScreenshotBoard({state,onMove,label}:{
  state:ScreenshotState;onMove?:(d:SourceDirection)=>void;label:string;
}) {
  const stage=screenshotStage(state.level);
  const id='source-worm-'+useId().replace(/[^a-zA-Z0-9]/g,'');
  const gesture=useRef<WormGesture|null>(null);
  const down=(e:PointerEvent<SVGSVGElement>)=>{
    if(!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0)||gesture.current)return;
    gesture.current=startWormGesture(e.pointerId,e.clientX,e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const up=(e:PointerEvent<SVGSVGElement>)=>{
    if(gesture.current?.pointerId!==e.pointerId)return;
    const d=finishWormGesture(gesture.current,e.pointerId,e.clientX,e.clientY);
    gesture.current=null;
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    if(d)onMove?.(d);
  };
  const terrain=cellPath(stage.terrain,.025);
  const head=state.body[0]!,neck=state.body[1]!;
  const angle=state.level===2&&state.moves===0?0:Math.atan2(head[1]-neck[1],head[0]-neck[0])*180/Math.PI;
  return <svg className="screenshot-worm-board" viewBox="0 0 640 360" role="img"
    aria-label={label} data-level={state.level} data-source-level={state.level} data-moves={state.moves}
    preserveAspectRatio="xMidYMid meet" style={{direction:"ltr"}} onPointerDown={down} onPointerUp={up}
    onPointerCancel={()=>{gesture.current=null;}} onLostPointerCapture={()=>{gesture.current=null;}}
    xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id={id+'sky'} x2="0" y2="1"><stop stopColor="#5eb0e8"/><stop offset="1" stopColor="#83d0f3"/></linearGradient>
      <pattern id={id+'brick'} width="30" height="30" patternUnits="userSpaceOnUse">
        <rect width="30" height="30" fill="#a65327"/>
        <path d="M0 0H30M0 10H30M0 20H30M0 30H30M0 0V10M15 10V20M0 20V30M30 0V30" stroke="#3a251d" strokeWidth="1.2"/>
        <path d="M2 2H28M2 12H13M17 12H28M2 22H28" stroke="#cd8141" strokeWidth=".7"/>
      </pattern>
    </defs>
    <rect width="640" height="360" fill={`url(#${id}sky)`}/>
    <g fill="#c2e7fc" opacity=".12">
      {Array.from({length:11},(_,i)=><path key={i} d="M320 290L-80 -100L20 -100Z" transform={`rotate(${i*16-35} 320 290)`}/>)}
    </g>
    <path d="M0 263Q15 239 41 250Q62 221 99 246Q123 233 150 268Q180 247 205 271Q236 248 264 278Q301 253 333 277Q368 245 400 271Q435 239 466 268Q488 239 518 253Q550 224 579 248Q609 238 640 259V360H0Z" fill="#d5effa" opacity=".72"/>
    <path d="M0 298Q23 291 31 286T59 301Q96 315 127 311Q151 302 174 321T218 323Q241 312 268 329T316 328Q350 316 386 326Q414 313 433 302T473 314Q506 298 534 305Q553 280 579 296Q614 276 640 282V360H0Z" fill="#83b76d"/>
    <path d="M0 334Q90 316 157 339T315 342T475 329T640 326V360H0Z" fill="#70a77b" opacity=".6"/>
    <g transform="translate(18 -2)" data-layer="terrain">
      {stage.terrainStyle==='earth'?<>
        <path d={terrain} transform="translate(0 -5)" fill="#92613c" stroke="#382719" strokeWidth="2"/>
        <path d={terrain} transform="translate(9 7)" fill="#633b22" stroke="#382719" strokeWidth="2.5" strokeLinejoin="round"/>
        <path d={terrain} transform="translate(9 7)" fill="none" stroke="#b27a4c" strokeWidth=".8"/>
      </>:<path d={terrain} fill={`url(#${id}brick)`} stroke="#3c251d" strokeWidth="1.5"/>}
    </g>
    {stage.portal&&<g data-layer="portal" data-source-portal transform={`translate(${(stage.portalPixel??xy(stage.portal)).join(' ')})`}>
      <circle r="16" fill="#15232d" stroke="#182128" strokeWidth="2"/>
      <path d="M13 0A13 13 0 1 0 0 13A10 10 0 1 0 -10 3A7 7 0 1 0 3 -6A4 4 0 1 0 3 2" stroke="#445263" strokeWidth="1.5" fill="none"/>
    </g>}
    {stage.hazards.map((h,i)=>{const [x,y]=xy(h.position);return <g key={'h'+i} data-layer={h.kind} transform={`translate(${x} ${y})`}>
      {h.kind==='saw'?<>
        <path d={Array.from({length:48},(_,j)=>{const a=j*Math.PI/24,r=j%2?12:15;return `${j?'L':'M'}${Math.cos(a)*r} ${Math.sin(a)*r}`;}).join(' ')+'Z'} fill="#a8b9cc" stroke="#d9e5e8" strokeWidth=".8"/>
        <circle r="11.5" fill="#7189a7" stroke="#566c87" strokeWidth="1"/>
        <circle r="2" fill="#a6bbd0" stroke="#475d7d"/>
      </>:<g transform={`rotate(${{up:0,right:90,down:180,left:270}[h.direction??'up']})`}>
        <path d="M-14 14L-12 -12L-7 9L-3 -15L1 9L7 -13L10 10L14 -9L14 14Z" fill="#243b31" stroke="#171f1b" strokeWidth="1.3"/>
        <path d="M-11 10L-11 -4M-2 10L-2 -6M8 11L8 -3" stroke="#82875a" strokeWidth="1"/>
      </g>}
    </g>;})}
    {stage.apples.map((p,i)=>!(state.eaten&2**i)&&<g key={'a'+i} data-layer="apple" data-source-apple transform={`translate(${xy(p).join(' ')})`}>
      <path d="M0 -11C-21 -17 -18 4 -10 15Q0 22 10 14C20 -5 17 -16 0 -11Z" fill="#c10e06" stroke="#632d10" strokeWidth="1.8"/>
      <path d="M-10 -8Q-15 -2 -8 10Q-12 -4 -3 -6" fill="#f76c0b"/>
      <path d="M0 -10L3 -20" stroke="#51351c" strokeWidth="3"/>
      <path d="M2 -16Q12 -25 19 -19Q12 -10 2 -16Z" fill="#29813d" stroke="#1c5532" strokeWidth="1"/>
    </g>)}
    {state.boxes.map((p,i)=><g key={'b'+i} data-layer="box" data-source-gray-object transform={`translate(${xy(p).join(' ')})`}>
      <rect x="-15" y="-15" width="30" height="30" rx="5" fill="#758a95" stroke="#344958" strokeWidth="2"/>
      <path d="M-12 -9L-5 -12L5 -10L11 -12L13 -5L10 9L1 11L-11 8Z" fill="#617580"/>
      <path d="M-11 -9L-4 -11L5 -9L11 -11" stroke="#afbfca" strokeWidth="2" fill="none"/>
    </g>)}
    <g data-layer="worm" transform="translate(18 -2)">
      <path d={cellPath(state.body,.4)} fill="#68a600" stroke="#164413" strokeWidth="2"/>
      {state.body.map(([x,y],i)=><rect key={i} x={x*30+1} y={y*30+1} width="28" height="23" rx="10" fill={i%2?'#138d00':'#168100'}/>)}
    </g>
    <g data-layer="head" data-source-worm transform={`translate(${xy(head).join(' ')}) rotate(${angle})`}>
      <ellipse cx="6" cy="-7" rx="6" ry="5" fill="#fff" stroke="#18231b" strokeWidth="1.2"/>
      <ellipse cx="15" cy="-7" rx="5" ry="5" fill="#fff" stroke="#18231b" strokeWidth="1.2"/>
      <circle cx="8" cy="-6" r="2.5" fill="#111"/><circle cx="17" cy="-6" r="2.3" fill="#111"/>
      <path d="M4 -10H20" stroke="#344f1d" strokeWidth="2"/>
      <path d="M6 3H20V11H6Q0 7 6 3Z" fill="#bb0fb1" stroke="#4b174b" strokeWidth="1.5"/>
      <path d="M5 7H19" stroke="#e64ede" strokeWidth="1"/>
    </g>
  </svg>;
}
