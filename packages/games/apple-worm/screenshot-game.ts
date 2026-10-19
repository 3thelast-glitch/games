/**
 * Screenshot-defined Apple Worm playable prototype for ALL 105 archived images.
 *
 * Uses exactly the terrain, apples, visible worm cells, gray objects and
 * candidate portal from the user's still image. No 40-stage legacy fallback,
 * no manufactured apple, no made-up exit or object geometry.
 *
 * Movement, gravity and gray-object collisions remain provisional. Some source
 * frames were captured mid-play, some portal/worm detections are incomplete:
 * these stages stay playable as exploration where possible but DO NOT qualify
 * as faithfully solved original-game levels.
 */
import { appleWormVisualSnapshot, APPLE_WORM_VISUAL_SNAPSHOT_COUNT } from './video-visual-snapshots-105.ts';
import { appleWormVideoTracedStage } from './video-traced-stages.ts';

export type ScreenshotPoint = readonly [number, number];
export type ScreenshotDirection = 'up'|'right'|'down'|'left';
export type ScreenshotPhase = 'playing'|'won'|'lost';
export interface ScreenshotLevel {
  readonly number:number;
  readonly width:21;
  readonly height:9;
  readonly rows:readonly string[];
  readonly worm:readonly ScreenshotPoint[];
  readonly apples:readonly ScreenshotPoint[];
  readonly portal:ScreenshotPoint | null;
  readonly grayObjects:readonly ScreenshotPoint[];
  readonly canMove:boolean;
  readonly issues:readonly string[];
  readonly sourceGeometry:'screenshot';
  readonly exactPhysicsVerified:false;
  readonly exactVisualComparisonPassed:false;
}
export interface ScreenshotState {
  readonly level:number;
  readonly body:readonly ScreenshotPoint[];
  readonly collected:readonly number[];
  readonly phase:ScreenshotPhase;
  readonly moves:number;
}
export const APPLE_WORM_SCREENSHOT_LEVEL_COUNT=APPLE_WORM_VISUAL_SNAPSHOT_COUNT;
export const SCREENSHOT_DIRECTIONS:readonly ScreenshotDirection[]=['up','right','down','left'];
const DELTAS:Record<ScreenshotDirection,ScreenshotPoint>={
  up:[0,-1],right:[1,0],down:[0,1],left:[-1,0],
};
const eq=(a:ScreenshotPoint,b:ScreenshotPoint)=>a[0]===b[0]&&a[1]===b[1];
const key=(p:ScreenshotPoint)=>p[0]+','+p[1];
const touching=(a:ScreenshotPoint,b:ScreenshotPoint)=>
  Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])===1;

/** A screenshot supplies visible green cells, not a head-to-tail ordering.
 * Only an unambiguous non-branching chain is eligible for moving.
 * The choice of head is an unverified heuristic, never a source-fidelity claim.
 */
function traceVisibleWorm(points:readonly ScreenshotPoint[]):ScreenshotPoint[]|null {
  if(!points.length)return null;
  const unique=new Map(points.map(p=>[key(p),p]));
  if(unique.size!==points.length)return null;
  if(points.length===1)return [points[0]!];
  const endpoints=points.filter(p=>points.filter(q=>touching(p,q)).length===1);
  if(endpoints.length!==2 ||
    points.some(p=>points.filter(q=>touching(p,q)).length>2))return null;
  // Prefer the extreme right-most endpoint (a guess; direction must be audited).
  const candidates=endpoints.sort((a,b)=>b[0]-a[0]||a[1]-b[1]);
  const chain:ScreenshotPoint[]=[candidates[0]!];
  const visited=new Set([key(chain[0]!)]);
  while(chain.length<points.length){
    const last=chain.at(-1)!;
    const next=points.find(p=>!visited.has(key(p))&&touching(last,p));
    if(!next)return null;
    chain.push(next);
    visited.add(key(next));
  }
  return chain;
}
export function screenshotWormLevel(level:number):ScreenshotLevel {
  const source=appleWormVisualSnapshot(level);
  const worm=traceVisibleWorm(source.wormVisible);
  // The first 10 exits were manually traced from the walkthrough, and are
  // more reliable than the still-image portal detector when it misses a swirl.
  const portal=source.probablePortal??(level<=10?appleWormVideoTracedStage(level).exit:null);
  const issues:string[]=[];
  if(!worm)issues.push('worm-shape-unresolved');
  else if(worm.length===1)issues.push('single-segment-snapshot');
  if(!portal)issues.push('portal-unresolved');
  if(portal && (portal[1]<0||portal[1]>=9))issues.push('portal-outside-play-grid');
  if(source.grayObjectsVisible.length)issues.push('gray-object-mechanics-unresolved');
  if(!source.applesVisible.length)issues.push('no-apples-visible-in-frame');
  issues.push('starting-head-and-physics-unverified');
  return {
    number:level,width:21,height:9,
    rows:source.terrain,
    worm:worm??source.wormVisible,
    apples:source.applesVisible,
    portal,
    grayObjects:source.grayObjectsVisible,
    canMove:worm!==null,
    issues,
    sourceGeometry:'screenshot',
    exactPhysicsVerified:false,exactVisualComparisonPassed:false,
  };
}
export function startScreenshotWorm(level=1):ScreenshotState {
  const map=screenshotWormLevel(level);
  return {
    level,body:map.worm.map(([x,y]):ScreenshotPoint=>[x,y]),
    collected:[],phase:'playing',moves:0,
  };
}
const onBoard=([x,y]:ScreenshotPoint)=>x>=0&&x<21&&y>=-2&&y<9;
export function moveScreenshotWorm(state:ScreenshotState,direction:ScreenshotDirection):ScreenshotState {
  if(state.phase!=='playing'||!Object.prototype.hasOwnProperty.call(DELTAS,direction))return state;
  const stage=screenshotWormLevel(state.level);
  if(!stage.canMove||!state.body.length)return state;
  const solid=new Set<string>();
  stage.rows.forEach((row,y)=>[...row].forEach((t,x)=>{if(t==='#')solid.add(key([x,y]));}));
  // Untyped gray elements are collision blockers; never label saw/crate without evidence.
  stage.grayObjects.forEach(p=>solid.add(key(p)));
  const [dx,dy]=DELTAS[direction], [hx,hy]=state.body[0]!;
  const head:ScreenshotPoint=[hx+dx,hy+dy];
  if(!onBoard(head)||solid.has(key(head))||state.body[1]&&eq(head,state.body[1]))return state;
  const fruitIndex=stage.apples.findIndex((p,i)=>!state.collected.includes(i)&&eq(p,head));
  const grow=fruitIndex>=0;
  const occupied=grow?state.body:state.body.slice(0,-1);
  if(occupied.some(p=>eq(p,head)))return state;
  const collected=grow?[...state.collected,fruitIndex].sort((a,b)=>a-b):[...state.collected];
  let body:ScreenshotPoint[]=[head,...(grow?state.body:state.body.slice(0,-1))]
    .map(([x,y]):ScreenshotPoint=>[x,y]);
  // The black exit is always active. Fruit is optional growth, not a gate.
  const win=()=>stage.portal!==null&&eq(body[0]!,stage.portal);
  let phase:ScreenshotPhase=win()?'won':'playing';
  const remaining=stage.apples.filter((_,i)=>!collected.includes(i));
  const supported=()=>body.some(([x,y])=>solid.has(key([x,y+1]))||
    remaining.some(p=>eq(p,[x,y+1])));
  // Gravity starts only after a legal move; the untouched screenshot is never changed.
  if(phase==='playing'){
    while(!supported()){
      const falling:ScreenshotPoint[]=body.map(([x,y]):ScreenshotPoint=>[x,y+1]);
      if(remaining.some(p=>falling.some(b=>eq(b,p))))break;
      if(falling.some(p=>p[1]>=9||p[0]<0||p[0]>=21)){
        // Keep the last in-bounds pose so losing states still restore safely.
        phase='lost';break;
      }
      body=falling;
      if(win()){phase='won';break;}
    }
  }
  return {level:state.level,body,collected,phase,moves:state.moves+1};
}
/** Strict restoring: never accept arbitrary saved worm pixels or completed flags. */
export function restoreScreenshotWorm(value:unknown):ScreenshotState|null {
  if(!value||typeof value!=='object')return null;
  const s=value as Partial<ScreenshotState>;
  if(!Number.isInteger(s.level)||s.level!<1||s.level!>105||
    !Number.isSafeInteger(s.moves)||s.moves!<0||
    !Array.isArray(s.body)||!s.body.length||s.body.length>30||
    !Array.isArray(s.collected)||!['playing','won','lost'].includes(s.phase??''))return null;
  const board=screenshotWormLevel(s.level!);
  if(!board.canMove||s.body.some(p=>!Array.isArray(p)||p.length!==2||
     !Number.isInteger(p[0])||!Number.isInteger(p[1])||!onBoard([p[0],p[1]])))return null;
  if(new Set(s.body.map(key)).size!==s.body.length)return null;
  if(s.body.some((p,i)=>i>0&&!touching(p,s.body![i-1]!)))return null;
  if(s.collected.some(i=>!Number.isInteger(i)||i<0||i>=board.apples.length)||
    new Set(s.collected).size!==s.collected.length)return null;
  if(s.phase==='won'&&(!board.portal||!eq(s.body[0]!,board.portal)))return null;
  return {level:s.level!,body:s.body.map(([x,y]):ScreenshotPoint=>[x,y]),
    collected:[...s.collected],moves:s.moves!,phase:s.phase!};
}
