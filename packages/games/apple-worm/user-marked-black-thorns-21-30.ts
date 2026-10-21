/**
 * USER-APPROVED lethal BLACK THORN placements for NAQLA Apple Worm levels
 * 021–030, traced from their *marked-up screenshots of OUR ACTUAL GAME*.
 *
 * Supplied reference:
 * NAQLA_AppleWorm_Our_Game_105_Levels_261021_211852(3).pdf
 * 5 annotated pages corresponding to original game-capture PDF pages 13–17.
 * These are NOT guesses based on the other game's video.
 *
 * Source extraction: pixel-difference against the exact unmarked NAQLA
 * captures, then snap each black stroke GROUP to its existing 21×9 terrain
 * grid and check contact face against the ground. Coordinates refer to the
 * EMPTY DANGEROUS CELL bordering the platform; face is the direction the
 * spike tips point. Multiple faces may share a collision cell at corners.
 *
 * The author's black lines specify intended placement, not the literal art.
 * Render as polished black metallic triangular spikes; any worm-body contact
 * must lose, including falling onto or touching a side/ceiling spike.
 *
 * Level 030 intentionally contains marks on the OUTER walls, INNER towers,
 * under overhangs, and the bottom corners. Do not squash these into a simple
 * upward-only floor row. Future uploaded annotated pages may extend this map.
 */
import type {ScreenshotPoint} from './screenshot-game.ts';
export type MarkedSpikeFace='up'|'down'|'left'|'right';
export interface MarkedBlackThorn {
  readonly cell:ScreenshotPoint;
  readonly face:MarkedSpikeFace;
}

/** level | empty-neighbor-x:y:outward-facing */
const USER_DRAWN_MARKS=`
21|9:4:up
22|11:2:left 8:4:up 9:5:up
23|10:3:right 7:5:up 9:5:up
24|9:3:up 12:3:up 9:5:down
25|10:5:up
26|13:3:up 7:4:up 11:4:up
27|13:3:up 9:4:up
28|8:5:up 11:5:up
29|10:3:down 8:5:up 9:5:up 10:5:up 11:5:up 12:5:up
30|9:0:right 9:1:right 9:2:right 9:3:right 11:0:left 11:1:left 11:2:left 11:3:left 7:4:right 7:5:right 7:6:right 7:7:right 13:4:left 13:5:left 13:6:left 13:7:left 7:4:down 8:4:down 12:4:down 13:4:down 7:7:up 13:7:up
`.trim();

const FACES:readonly string[]=['up','down','left','right'];
const parsed=Object.fromEntries(USER_DRAWN_MARKS.split('\n').map(row=>{
  const [rawLevel,rawCells]=row.split('|');
  if(!rawLevel||!rawCells)throw new Error('Incomplete user thorn marking row');
  const level=Number(rawLevel);
  if(level<21||level>30)throw new RangeError('Unexpected marked page '+level);
  const segments=rawCells.trim().split(/\s+/).map(mark=>{
    const [rawX,rawY,rawFace]=mark.split(':');
    const x=Number(rawX),y=Number(rawY);
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=21||y< -2||y>9||
      !FACES.includes(rawFace??''))throw new Error('Invalid author-drawn spike '+mark);
    return {cell:[x,y] as ScreenshotPoint,face:rawFace as MarkedSpikeFace};
  });
  return [level,segments] as const;
})) as Readonly<Record<number,readonly MarkedBlackThorn[]>>;

export const USER_MARKED_BLACK_THORNS=parsed;
export const USER_MARKED_BLACK_THORN_STAGE_COUNT=Object.keys(parsed).length;
export const USER_MARKED_BLACK_THORN_SEGMENT_COUNT=Object.values(parsed)
  .reduce((n,segments)=>n+segments.length,0);
export const USER_MARKED_BLACK_THORN_CELL_COUNT=Object.values(parsed).reduce((n,segments)=>
  n+new Set(segments.map(({cell})=>cell.join(','))).size,0);

/** Deduplicated collision cells; never permit a worm to pass through a corner. */
export function userMarkedThornCells(level:number):readonly ScreenshotPoint[]{
  const seen=new Set<string>();
  return (USER_MARKED_BLACK_THORNS[level]??[]).flatMap(({cell})=>{
    const key=cell.join(',');
    if(seen.has(key))return [];
    seen.add(key);
    return [[...cell] as ScreenshotPoint];
  });
}

/** Preserve all four surface orientations; a single cell may have 2 faces. */
export function userMarkedThornFaces(
  level:number,cell:ScreenshotPoint,
):readonly MarkedSpikeFace[]{
  return (USER_MARKED_BLACK_THORNS[level]??[])
    .filter(mark=>mark.cell[0]===cell[0]&&mark.cell[1]===cell[1])
    .map(mark=>mark.face);
}
