import { cellKey, sameCell, screenshotStage, type Cell, type ScreenshotStage,
  type SourceDirection } from './screenshot-stages.ts';

export interface ScreenshotState {
  level: number;
  body: readonly Cell[];
  boxes: readonly Cell[];
  eaten: number;
  moves: number;
  phase: 'playing' | 'won' | 'lost';
  loss?: 'fall' | 'hazard';
}
export const SOURCE_DIRECTIONS: readonly SourceDirection[] = ['right', 'up', 'left', 'down'];
const delta: Record<SourceDirection, Cell> = { right:[1,0],up:[0,-1],left:[-1,0],down:[0,1] };
const shift = (p: Cell, d: Cell): Cell => [p[0]+d[0], p[1]+d[1]];
const inside = (p: Cell, s: ScreenshotStage) => p[0]>=0 && p[0]<s.width && p[1]>=0 && p[1]<s.height;
const models = new WeakMap<ScreenshotStage, { ground: Set<string>; danger: Set<string> }>();
function model(stage: ScreenshotStage) {
  let m = models.get(stage);
  if (!m) {
    m = { ground: new Set(stage.terrain.map(cellKey)),
      danger: new Set(stage.hazards.map(h => cellKey(h.position))) };
    models.set(stage, m);
  }
  return m;
}

/** No initialization gravity: the provided screenshot is the visible start. */
export function startScreenshotWorm(level = 1, stage = screenshotStage(level)): ScreenshotState {
  return { level, body: stage.worm.map(p=>[...p] as Cell),
    boxes: stage.movableObjects.map(p=>[...p] as Cell), eaten:0, moves:0, phase:'playing' };
}

/** Documented still-image adaptation: static saws, rigid worm, gravity boxes.
 * This never asserts the original game's time-dependent saw trajectories.
 */
export function moveScreenshotWorm(state: ScreenshotState, direction: SourceDirection,
  stage = screenshotStage(state.level)): ScreenshotState {
  if (state.phase !== 'playing' || !Object.hasOwn(delta, direction)) return state;
  const { ground, danger } = model(stage);
  const d = delta[direction];
  const head = shift(state.body[0]!, d);
  if (!inside(head,stage) || ground.has(cellKey(head)) || sameCell(head,state.body[1]!)) return state;
  const fruit = stage.apples.findIndex((p,i)=>!(state.eaten & 2**i) && sameCell(p,head));
  if ((fruit>=0 ? state.body : state.body.slice(0,-1)).some(p=>sameCell(p,head))) return state;
  let boxes = state.boxes.map(p=>[...p] as Cell);
  const pushed = boxes.findIndex(p=>sameCell(p,head));
  if (pushed >= 0) {
    const moving = new Set<number>();
    const push = (i: number): boolean => {
      if (moving.has(i)) return false;
      moving.add(i);
      const dest = shift(boxes[i]!,d);
      if (!inside(dest,stage) || ground.has(cellKey(dest)) ||
          state.body.some(p=>sameCell(p,dest)) || stage.apples.some((p,j)=>!(state.eaten&2**j)&&sameCell(p,dest))) return false;
      const other = boxes.findIndex((p,j)=>j!==i&&sameCell(p,dest));
      if (other>=0 && !push(other)) return false;
      boxes[i]=dest;return true;
    };
    if (!push(pushed)) return state;
  }
  const eaten = fruit < 0 ? state.eaten : state.eaten | 2**fruit;
  let body: Cell[] = [head,...state.body];
  if (fruit < 0) body.pop();
  const remaining = new Set(stage.apples.filter((_,i)=>!(eaten&2**i)).map(cellKey));
  // Preserve the approved rule on main: portal entry wins; fruit is optional.
  const won = () => stage.portal !== null && sameCell(body[0]!,stage.portal);
  const result = (phase: ScreenshotState['phase'], loss?: ScreenshotState['loss']): ScreenshotState =>
    ({level:state.level,body,boxes,eaten,moves:state.moves+1,phase,...(loss?{loss}:{})});
  // Resolve one-cell substeps, so falling through a saw cannot tunnel past it.
  for (let tick=0;tick<(stage.height+1)*(boxes.length+2);tick++) {
    if (body.some(p=>danger.has(cellKey(p)))) return result('lost','hazard');
    if (won()) return result('won');
    let changed = false;
    const bodySet = new Set(body.map(cellKey));
    for (let i=0;i<boxes.length;i++) {
      const below = shift(boxes[i]!,[0,1]);
      if (!ground.has(cellKey(below)) && !remaining.has(cellKey(below)) &&
          !bodySet.has(cellKey(below)) && !boxes.some((p,j)=>j!==i&&sameCell(p,below))) {
        boxes[i]=below;changed=true;
      }
    }
    boxes=boxes.filter(p=>p[1]<stage.height);
    const supported = body.some(p=> {
      const below = shift(p,[0,1]);
      return ground.has(cellKey(below)) || remaining.has(cellKey(below)) || boxes.some(b=>sameCell(b,below));
    });
    if (!supported) {
      body=body.map(p=>shift(p,[0,1]));changed=true;
      if (body.some(p=>!inside(p,stage))) return result('lost','fall');
    }
    if (!changed) return result('playing');
  }
  throw new Error('Screenshot gravity failed to settle');
}

export interface SourceSolveResult {
  status: 'solved' | 'exhausted' | 'budget' | 'invalid' | 'unresolved';
  visited: number;
  route: SourceDirection[] | null;
}
/** BFS keeps parent indices, not a copied move history for every search node. */
export function solveScreenshotWorm(level:number, budget=100000,
  initial=startScreenshotWorm(level)): SourceSolveResult {
  const stage=screenshotStage(level);
  if (!stage.portal) return {status:'unresolved',visited:0,route:null};
  if (initial.phase!=='playing') return {status:'invalid',visited:0,route:null};
  const signature = (s: ScreenshotState) => `${s.eaten}:`+
    s.body.map(([x,y])=>String.fromCharCode(33+x+y*stage.width)).join('')+':'+
    s.boxes.map(([x,y])=>x+y*stage.width).sort((a,b)=>a-b).join(',');
  const states: ScreenshotState[]=[initial];
  const parents:number[]=[-1];const moves:SourceDirection[]=['right'];
  const seen=new Set([signature(initial)]);
  for (let i=0;i<states.length;i++) {
    for(const direction of SOURCE_DIRECTIONS) {
      const next=moveScreenshotWorm(states[i]!,direction,stage);
      if(next===states[i] || next.phase==='lost')continue;
      if(next.phase==='won') {
        const route:SourceDirection[]=[direction];
        for(let p=i;p>0;p=parents[p]!) route.push(moves[p]!);
        return {status:'solved',visited:seen.size,route:route.reverse()};
      }
      const key=signature(next);
      if(seen.has(key))continue;
      if(seen.size>=budget)return {status:'budget',visited:seen.size,route:null};
      seen.add(key);states.push(next);parents.push(i);moves.push(direction);
    }
  }
  return {status:'exhausted',visited:seen.size,route:null};
}

/** Save a replay, not trusted coordinates or a user-supplied winning flag. */
export function replayScreenshotWorm(level:number, route:unknown): ScreenshotState | null {
  if(!Array.isArray(route)||route.length>5000)return null;
  let state=startScreenshotWorm(level);
  for(const direction of route) {
    if(!SOURCE_DIRECTIONS.includes(direction))return null;
    const next=moveScreenshotWorm(state,direction);
    if(next===state)return null;
    state=next;
  }
  return state;
}
