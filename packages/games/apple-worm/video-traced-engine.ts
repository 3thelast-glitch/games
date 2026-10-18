/** Experimental pure physics harness for source-traced Apple Worm stages 1–10.
 * Does NOT replace NAQLA's live 40-stage engine. Source routes and exact physics
 * remain subject to frame-by-frame verification, so do not ship this as final.
 */
import { appleWormVideoTracedStage, type VideoGridPoint } from './video-traced-stages.ts';

export type VideoWormDirection = 'up'|'right'|'down'|'left';
export type VideoWormPhase = 'playing'|'won'|'lost';
export interface VideoWormState {
  level: number;
  body: VideoGridPoint[];
  applesBitmask: number;
  phase: VideoWormPhase;
  moves: number;
}
const DELTA: Record<VideoWormDirection, VideoGridPoint> = {
  up:[0,-1],right:[1,0],down:[0,1],left:[-1,0],
};
const DIRECTIONS: VideoWormDirection[]=['right','up','left','down'];
const equals=(a:VideoGridPoint,b:VideoGridPoint)=>a[0]===b[0]&&a[1]===b[1];
const coordinateKey=([x,y]:VideoGridPoint)=>x+','+y;

export function startVideoWorm(level=1):VideoWormState {
  const stage=appleWormVideoTracedStage(level);
  return {level,body:stage.worm.map(([x,y])=>[x,y]),applesBitmask:0,phase:'playing',moves:0};
}

export function moveVideoWorm(state:VideoWormState, direction:VideoWormDirection):VideoWormState {
  if(state.phase!=='playing'||!Object.prototype.hasOwnProperty.call(DELTA,direction))return state;
  const stage=appleWormVideoTracedStage(state.level);
  const obstacles=new Set(stage.blocks.map(coordinateKey));
  const [dx,dy]=DELTA[direction];
  const [hx,hy]=state.body[0]!;
  const nextHead:VideoGridPoint=[hx+dx,hy+dy];
  if(nextHead[0]<0||nextHead[0]>=stage.width||nextHead[1]<0||nextHead[1]>=stage.height||
    obstacles.has(coordinateKey(nextHead))||equals(nextHead,state.body[1]!))return state;

  const fruitIndex=stage.apples.findIndex((apple,i)=>
    !(state.applesBitmask&(1<<i)) && equals(apple,nextHead));
  const applesBitmask=fruitIndex===-1?state.applesBitmask:state.applesBitmask|(1<<fruitIndex);
  const grow=fruitIndex>=0;
  if((grow?state.body:state.body.slice(0,-1)).some(p=>equals(p,nextHead)))return state;
  let body:VideoGridPoint[]=[nextHead,...state.body.map(([x,y]):VideoGridPoint=>[x,y])];
  if(!grow)body=body.slice(0,-1);
  const allEaten=applesBitmask===(1<<stage.apples.length)-1;
  const wins=(parts:VideoGridPoint[])=>allEaten&&equals(parts[0]!,stage.exit);
  const remaining=stage.apples.filter((_,i)=>!(applesBitmask&(1<<i)));
  const supported=(parts:VideoGridPoint[])=>parts.some(([x,y])=>
    obstacles.has(coordinateKey([x,y+1])) || remaining.some(a=>equals(a,[x,y+1])));
  let phase:VideoWormPhase=wins(body)?'won':'playing';
  if(phase==='playing') {
    for(let n=0;n<stage.height+2 && !supported(body);n++) {
      const falling=body.map(([x,y]):VideoGridPoint=>[x,y+1]);
      if(remaining.some(a=>falling.some(p=>equals(p,a))))break;
      if(falling.some(([x,y])=>x<0||x>=stage.width||y>=stage.height)) {
        phase='lost';body=falling;break;
      }
      body=falling;
      if(wins(body)){phase='won';break;}
    }
  }
  return {level:state.level,body,applesBitmask,phase,moves:state.moves+1};
}

/** Candidate-solver only; these routes do NOT assert that on-video input replay matched. */
export function solveVideoWorm(level:number,limit=100000):VideoWormDirection[]|null {
  const initial=startVideoWorm(level);
  const key=(s:VideoWormState)=>s.applesBitmask+':'+s.body.map(coordinateKey).join('|');
  const queue:{state:VideoWormState; path:VideoWormDirection[]}[]=[{state:initial,path:[]}];
  const seen=new Set([key(initial)]);
  for(let idx=0;idx<queue.length&&seen.size<limit;idx++) {
    const {state,path}=queue[idx]!;
    for(const direction of DIRECTIONS) {
      const next=moveVideoWorm(state,direction);
      if(next===state||next.phase==='lost')continue;
      const candidate=[...path,direction];
      if(next.phase==='won')return candidate;
      const signature=key(next);
      if(!seen.has(signature)){seen.add(signature);queue.push({state:next,path:candidate});}
    }
  }
  return null;
}
