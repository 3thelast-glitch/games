/**
 * PROVISIONAL-ENGINE solvability checker for the ONE approved 105-stage game.
 *
 * Only a real replay from startScreenshotWorm -> moveScreenshotWorm -> 'won'
 * counts as a verified route. Never label "budget exceeded" unsolvable.
 * Exhaustive search refers strictly to the *current* screenshot engine,
 * not the original commercial game's physics/video.
 */
import {
  APPLE_WORM_SCREENSHOT_LEVEL_COUNT,
  SCREENSHOT_DIRECTIONS,
  screenshotWormLevel,
  startScreenshotWorm,
  moveScreenshotWorm,
  type ScreenshotDirection,
  type ScreenshotState,
} from './screenshot-game.ts';

export type SolvabilityStatus='won'|'missing-exit'|'exhausted'|'budget';
export interface AppleWormSolvability {
  level:number;
  status:SolvabilityStatus;
  explored:number;
  discovered:number;
  route:readonly ScreenshotDirection[]|null;
  routeLength:number|null;
  elapsedMs:number;
  portal:readonly [number,number]|null;
  maxStates:number;
}
interface SearchNode {
  state:ScreenshotState;
  parent:number;
  via:ScreenshotDirection|null;
}
const stateKey=(s:ScreenshotState)=>
  s.body.map(p=>p[0]+','+p[1]).join(';')+'|'+s.collected.join(',')+
  '|'+(s.grayPositions?.map(p=>p[0]+','+p[1]).join(';')??'');
const delta:Record<ScreenshotDirection,readonly[number,number]>={
  up:[0,-1],right:[1,0],down:[0,1],left:[-1,0],
};
function reconstruct(nodes:SearchNode[],nodeIndex:number,direction:ScreenshotDirection){
  const path:ScreenshotDirection[]=[direction];
  while(nodeIndex>0){
    const n=nodes[nodeIndex]!;
    if(n.via)path.push(n.via);
    nodeIndex=n.parent;
  }
  path.reverse();
  return path;
}
export function replayAppleWormRoute(level:number,route:readonly ScreenshotDirection[]):{
  won:boolean;state:ScreenshotState;legalMoves:number;
} {
  const stage=screenshotWormLevel(level);
  let state=startScreenshotWorm(level),legalMoves=0;
  for(const direction of route){
    const next=moveScreenshotWorm(state,direction,stage);
    if(next===state)return {won:false,state,legalMoves};
    legalMoves++;
    state=next;
  }
  return {won:state.phase==='won',state,legalMoves};
}

/**
 * Bounded breadth-first search through the EXACT current game transition.
 *
 * - "won" includes a step-by-step replayable route.
 * - "missing-exit" can never win under the current implementation.
 * - "exhausted" explored every reachable state using the current engine.
 * - "budget" means UNDETERMINED; it is NOT proof of impossibility.
 */
export function solveAppleWormLevel(level:number,options:{
  maxStates?:number;
  maxMillis?:number;
}={}):AppleWormSolvability {
  const stage=screenshotWormLevel(level);
  const started=Date.now();
  const maxStates=options.maxStates??8000;
  const maxMillis=options.maxMillis??500;
  if(!Number.isInteger(maxStates)||maxStates<1)throw new RangeError('maxStates must be positive');
  if(!stage.portal)return {
    level,status:'missing-exit',explored:0,discovered:0,route:null,
    routeLength:null,elapsedMs:Date.now()-started,maxStates,portal:null,
  };
  const initial=startScreenshotWorm(level);
  if(initial.phase==='won')return {
    level,status:'won',explored:0,discovered:1,route:[],
    routeLength:0,elapsedMs:Date.now()-started,maxStates,portal:stage.portal,
  };
  const nodes:SearchNode[]=[{state:initial,parent:-1,via:null}];
  const seen=new Set<string>([stateKey(initial)]);
  let explored=0;
  const target=stage.portal;
  while(explored<nodes.length){
    if(explored>=maxStates||(
      explored%64===0&&Date.now()-started>=maxMillis
    ))break;
    const index=explored++;
    const current=nodes[index]!.state;
    // Searching toward the portal first reduces early tie differences but
    // does not compromise breadth-first completeness for explored layers.
    const directions=[...SCREENSHOT_DIRECTIONS].sort((a,b)=>{
      const [ax,ay]=delta[a], [bx,by]=delta[b];
      const h=current.body[0]!;
      return (Math.abs(h[0]+ax-target[0])+Math.abs(h[1]+ay-target[1]))-
        (Math.abs(h[0]+bx-target[0])+Math.abs(h[1]+by-target[1]));
    });
    for(const direction of directions){
      const next=moveScreenshotWorm(current,direction,stage);
      if(next===current||next.phase==='lost')continue;
      if(next.phase==='won'){
        const route=reconstruct(nodes,index,direction);
        const checked=replayAppleWormRoute(level,route);
        if(!checked.won||checked.legalMoves!==route.length)
          throw new Error('solver found an invalid winning route for stage '+level);
        return {
          level,status:'won',explored,discovered:seen.size,
          route,routeLength:route.length,elapsedMs:Date.now()-started,
          maxStates,portal:stage.portal,
        };
      }
      const k=stateKey(next);
      if(seen.has(k))continue;
      seen.add(k);
      nodes.push({state:next,parent:index,via:direction});
    }
  }
  return {
    level,status:explored<nodes.length?'budget':'exhausted',
    explored,discovered:seen.size,route:null,routeLength:null,
    elapsedMs:Date.now()-started,maxStates,portal:stage.portal,
  };
}
export function auditAppleWormLevels(
  first=1,last=APPLE_WORM_SCREENSHOT_LEVEL_COUNT,
  options:{maxStates?:number;maxMillis?:number}={},
):AppleWormSolvability[] {
  if(!Number.isInteger(first)||!Number.isInteger(last)||
    first<1||last>APPLE_WORM_SCREENSHOT_LEVEL_COUNT||last<first)
    throw new RangeError('invalid audit range');
  return Array.from({length:last-first+1},(_,index)=>
    solveAppleWormLevel(first+index,options));
}
