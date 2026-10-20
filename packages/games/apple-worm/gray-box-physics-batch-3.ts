/**
 * Stage 104 ONLY: source walkthrough 14:08 shows a tall immovable vertical
 * stack (x=4, y=1..7) and a separate pushable crate at (7,7).
 *
 * Treating ALL eight gray pixels as static blockers makes the level unwinnable;
 * treating the seven-cell pillar as movable incorrectly destroys the map.
 * The reusable Batch-1 push/settle rules apply only to the single crate.
 */
import type { ScreenshotPoint } from './screenshot-game.ts';

export function isBatchThreeMovableGray(stage:number):boolean{
  return stage===104;
}
const crate=(p:ScreenshotPoint)=>p[0]===7&&p[1]===7;
export function fixedGrayForBatchThree(
  stage:number,objects:readonly ScreenshotPoint[],
):readonly ScreenshotPoint[]{
  return stage===104?objects.filter(p=>!crate(p)):objects;
}
export function initialMovableGray(
  stage:number,objects:readonly ScreenshotPoint[],
):readonly ScreenshotPoint[]{
  if(stage!==104)return objects;
  const moving=objects.filter(crate);
  if(moving.length!==1)
    throw new Error('Video Stage 104 must have exactly one separate (7,7) crate');
  return moving;
}
/** Render static column + moving crate without duplicates or lost columns. */
export function displayGrayPositions(
  stage:number,objects:readonly ScreenshotPoint[],
  moving:readonly ScreenshotPoint[]|undefined,
):readonly ScreenshotPoint[]{
  if(!moving)return objects;
  return stage===104?[...fixedGrayForBatchThree(stage,objects),...moving]:moving;
}
