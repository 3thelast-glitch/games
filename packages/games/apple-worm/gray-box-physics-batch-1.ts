/**
 * Gray-box interaction observed in the user's selected Apple Worm walkthrough.
 * Only the eight UNRESOLVED stages in Batch 1 opt into this model.
 *
 * A box can be pushed one grid cell if the next cell is free; unsupported boxes
 * fall down until supported by terrain, another box or the worm body. The boxes
 * provide support to the worm just like terrain. No stage map, fruit or portal
 * coordinates are changed.
 */
import type { ScreenshotPoint, ScreenshotDirection } from './screenshot-game.ts';

export const APPLE_WORM_MOVABLE_GRAY_BATCH_1=new Set([
  13,14,15,17,18,19,20,28,
]);
const key=([x,y]:ScreenshotPoint)=>x+','+y;
const add=(p:ScreenshotPoint,dx:number,dy:number):ScreenshotPoint=>
  [p[0]+dx,p[1]+dy];
const dirs:Record<ScreenshotDirection,ScreenshotPoint>={
  up:[0,-1],right:[1,0],down:[0,1],left:[-1,0],
};
export const isBatchOneMovableGray=(stage:number)=>
  APPLE_WORM_MOVABLE_GRAY_BATCH_1.has(stage);

export function pushGrayBox({
  boxes,headTarget,direction,terrain,body,apples,
}:{
  boxes:readonly ScreenshotPoint[];
  headTarget:ScreenshotPoint;
  direction:ScreenshotDirection;
  terrain:ReadonlySet<string>;
  body:readonly ScreenshotPoint[];
  apples:readonly ScreenshotPoint[];
}):readonly ScreenshotPoint[]|null{
  const target=key(headTarget),idx=boxes.findIndex(p=>key(p)===target);
  if(idx<0)return boxes;
  const [dx,dy]=dirs[direction],ahead=add(headTarget,dx,dy);
  const aheadKey=key(ahead);
  if(ahead[0]<0||ahead[0]>=21||ahead[1]<-2||ahead[1]>9||
    terrain.has(aheadKey)||boxes.some((p,i)=>i!==idx&&key(p)===aheadKey)||
    body.some(p=>key(p)===aheadKey)||
    apples.some(p=>key(p)===aheadKey))return null;
  return boxes.map((p,i)=>i===idx?ahead:p);
}

/** Drop each unsupported box until it lands or exits the visible scene.
 * The active worm acts as a temporary physical support. A box is allowed to
 * fall onto another box, like the gray stack shown in the user's video.
 */
export function settleGrayBoxes(
  boxes:readonly ScreenshotPoint[],
  terrain:ReadonlySet<string>,
  worm:readonly ScreenshotPoint[],
):ScreenshotPoint[]{
  const positions=boxes.map(p=>[p[0],p[1]] as ScreenshotPoint);
  const wormCells=new Set(worm.map(key));
  let changed=true,steps=0;
  while(changed&&steps++<12*boxes.length+12){
    changed=false;
    const indexes=positions.map((_,i)=>i)
      .sort((a,b)=>positions[b]![1]-positions[a]![1]||a-b);
    for(const i of indexes){
      const at=positions[i]!;
      const next=add(at,0,1),k=key(next);
      if(next[1]>9||next[0]<0||next[0]>=21||
        terrain.has(k)||wormCells.has(k)||
        positions.some((p,j)=>i!==j&&key(p)===k))continue;
      positions[i]=next;
      changed=true;
    }
  }
  return positions;
}
