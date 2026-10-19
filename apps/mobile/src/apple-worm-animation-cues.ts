import type { ScreenshotPoint, ScreenshotPhase }
  from '../../../packages/games/apple-worm/screenshot-game.ts';

export type WormFaceAngle = 0|90|180|-90;

const same=(a:ScreenshotPoint,b:ScreenshotPoint)=>
  a[0]===b[0]&&a[1]===b[1];

/**
 * The face must point along the existing worm HEAD/neck, not swivel toward
 * a nearby fruit. The optional initial right-facing screenshot override for
 * Level 002 is art-only and must match the same orientation used by the mouth.
 */
export function appleWormFacingAngle(
  body:readonly ScreenshotPoint[],
  sourceFrameFacesRight=false,
):WormFaceAngle {
  if(sourceFrameFacesRight)return 0;
  const head=body[0],neck=body[1];
  if(!head||!neck)return 0;
  if(head[0]<neck[0])return 180;
  if(head[1]<neck[1])return -90;
  if(head[1]>neck[1])return 90;
  return 0;
}

const forward:Record<WormFaceAngle,ScreenshotPoint>={
  0:[1,0],90:[0,1],180:[-1,0],'-90':[0,-1],
};

/**
 * Only open for a remaining fruit DIRECTLY IN FRONT of the existing face.
 * No looking down, sideways, backward or diagonally toward apples, and no
 * opening through a wall, gray object or the worm's own body. One/two steps
 * ahead are allowed only while the entire straight line is unobstructed.
 *
 * This returns *only* a cosmetic readiness cue. It neither turns the worm
 * nor affects the stage state, input, eating or portal rules.
 */
export function appleWormMouthCue(
  head:ScreenshotPoint|undefined,
  remaining:readonly ScreenshotPoint[],
  phase:ScreenshotPhase,
  faceAngle:WormFaceAngle,
  blocked:readonly ScreenshotPoint[]=[],
):{hungry:boolean;distance:number|null} {
  if(!head||phase!=='playing'||!remaining.length)
    return {hungry:false,distance:null};
  const [dx,dy]=forward[faceAngle];
  for(let distance=1;distance<=2;distance++){
    const cell:ScreenshotPoint=[
      head[0]+dx*distance,
      head[1]+dy*distance,
    ];
    // A wall between the head and an apple is NOT an eating approach.
    if(blocked.some(point=>same(point,cell)))
      break;
    if(remaining.some(point=>same(point,cell)))
      return {hungry:true,distance};
  }
  return {hungry:false,distance:null};
}
