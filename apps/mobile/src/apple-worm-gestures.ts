import type { Direction } from '../../../packages/games/apple-worm/engine.ts';

/** Device-independent swipe recognition. Does not mirror the board under RTL. */
export type SwipePoint = { x:number; y:number };
export type SwipeResult = Direction | null;
export function wormSwipeDirection(
  start:SwipePoint, end:SwipePoint, threshold=22, dominance=1.13,
):SwipeResult {
  const dx=end.x-start.x,dy=end.y-start.y;
  if (![start.x,start.y,end.x,end.y,threshold,dominance].every(Number.isFinite) ||
      threshold<=0 || dominance<1) return null;
  const ax=Math.abs(dx),ay=Math.abs(dy);
  if(Math.max(ax,ay)<threshold)return null;
  if(ax>ay*dominance)return dx>0?'right':'left';
  if(ay>ax*dominance)return dy>0?'down':'up';
  return null; // Ignore ambiguous diagonals rather than move in the wrong direction.
}

/** Defensive gesture ownership: never move for a second pointer or a cancelled swipe. */
export type WormGesture={pointerId:number;x:number;y:number};
export const startWormGesture=(pointerId:number,x:number,y:number):WormGesture|null=>
  Number.isSafeInteger(pointerId)&&Number.isFinite(x)&&Number.isFinite(y)?
  {pointerId,x,y}:null;
export const finishWormGesture=(gesture:WormGesture|null,
  pointerId:number,x:number,y:number):SwipeResult=>
  gesture!==null&&gesture.pointerId===pointerId?
  wormSwipeDirection(gesture,{x,y}):null;
