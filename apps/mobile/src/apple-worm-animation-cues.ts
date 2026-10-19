import type { ScreenshotPoint, ScreenshotPhase }
  from '../../../packages/games/apple-worm/screenshot-game.ts';

/**
 * Pure visual cue: no movement, fruit pickup, stage changes or collision rules.
 * The mouth gets ready only when a *remaining* apple is within two cells of
 * the existing head. Direction points the face toward the closest fruit.
 */
export function appleWormMouthCue(
  head: ScreenshotPoint | undefined,
  remaining: readonly ScreenshotPoint[],
  phase: ScreenshotPhase,
): {hungry:boolean; faceAngle:number|undefined; distance:number|null} {
  if(!head||phase!=='playing'||!remaining.length)
    return {hungry:false,faceAngle:undefined,distance:null};
  const near=remaining.map(p=>({
    dx:p[0]-head[0],dy:p[1]-head[1],
    distance:Math.abs(p[0]-head[0])+Math.abs(p[1]-head[1]),
  })).filter(p=>p.distance>0&&p.distance<=2)
    .sort((a,b)=>a.distance-b.distance)[0];
  if(!near)return {hungry:false,faceAngle:undefined,distance:null};
  const faceAngle=Math.abs(near.dx)>=Math.abs(near.dy)
    ?near.dx>=0?0:180
    :near.dy>0?90:-90;
  return {hungry:true,faceAngle,distance:near.distance};
}
