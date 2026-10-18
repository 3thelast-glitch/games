/**
 * NAQLA's independently authored 40-stage pack, organized into four chapters.
 * https://applewormlevel.com/levels is an unofficial collection of walkthroughs,
 * not a licensed source of ready-to-import grid maps. Never label these layouts
 * as a verbatim reconstruction of the commercial game.
 *
 * Compact map schema: width, fruit X/Y, missing ground columns, raised columns,
 * free-floating solid blocks. All layouts are verified by our own pathfinder.
 */
export interface StageBlueprint {
  width: number;
  height: number;
  floor: number;
  gaps: readonly number[];
  raised: readonly number[];
  floating: ReadonlyArray<readonly [number, number]>;
  fruit: readonly [number, number];
  start: ReadonlyArray<readonly [number, number]>;
  exit: readonly [number, number];
}
type StageRow = readonly [
  width: number, appleX: number, appleY: number,
  gaps: readonly number[], raised: readonly number[],
  floating: ReadonlyArray<readonly [number, number]>
];
const STAGES: readonly StageRow[] = [
  // Chapter I / 1–10: approach, collect, gravity and first obstacles.
  [12,4,6,[],[],[]],
  [12,5,6,[],[7],[]],
  [11,5,6,[7],[6,8],[]],
  [12,6,6,[7],[9],[]],
  [12,5,6,[],[8],[]],
  [12,6,6,[],[7],[]],
  [12,6,6,[6],[9],[]],
  [12,5,6,[],[7,8],[]],
  [12,6,6,[6],[8],[]],
  [12,6,6,[],[8,9],[]],
  // Chapter II / 11–20: bridges, elevated obstacles, gap planning.
  [14,7,6,[7],[],[]],
  [13,7,6,[6],[9],[]],
  [13,4,6,[],[9,10],[]],
  [14,6,6,[],[8,10],[]],
  [14,7,6,[7],[9,10,11],[]],
  [14,4,6,[],[10],[]],
  [14,5,6,[],[6,11],[]],
  [12,7,6,[6],[5],[]],
  [14,4,6,[],[5,10],[]],
  [12,7,6,[6,7],[5],[]],
  // Chapter III / 21–30: raised fruit, suspended stones, controlled falls.
  [14,4,5,[7,8],[4,5,6,11],[[9,4]]],
  [16,4,6,[],[13],[]],
  [15,5,5,[],[5,6,7,11],[[9,4]]],
  [16,4,6,[],[5,10,13],[]],
  [16,8,6,[],[6,12,13],[]],
  [15,8,6,[],[6,11],[[10,4]]],
  [16,8,6,[8],[5,10,12,13],[]],
  [16,5,6,[10],[6,13],[]],
  [16,8,6,[7],[5,6],[]],
  [14,7,6,[6],[5,10],[[8,4]]],
  // Chapter IV / 31–40: longer routes, composite height and gap constraints.
  [18,5,6,[],[7,9,11],[[8,5]]],
  [18,5,5,[],[5,6,12,14],[[9,4]]],
  [18,7,5,[],[5,7,15],[]],
  [18,9,6,[12],[10,11,15],[]],
  [18,8,5,[],[5,8,10],[]],
  [18,9,6,[],[6,7,14],[]],
  [18,8,6,[7,8],[6,11],[[5,4]]],
  [17,8,6,[],[6,13],[]],
  [18,5,5,[10,15],[5,14],[]],
  [18,8,6,[],[6,10,15],[[11,4],[12,5]]],
] as const;
export const APPLE_WORM_STAGE_COUNT = STAGES.length;
export const APPLE_WORM_GROUP_SIZE = 10;
export const APPLE_WORM_GROUPS = Array.from(
  {length: Math.ceil(APPLE_WORM_STAGE_COUNT / APPLE_WORM_GROUP_SIZE)},
  (_, i) => ({start:i * APPLE_WORM_GROUP_SIZE + 1,
    end:Math.min((i + 1)*APPLE_WORM_GROUP_SIZE, APPLE_WORM_STAGE_COUNT)}),
);
export function appleWormBlueprint(level: number): StageBlueprint {
  if (!Number.isInteger(level) || level < 1 || level > STAGES.length)
    throw new RangeError('Invalid Apple Worm level');
  const [width, appleX, appleY, gaps, raised, floating] = STAGES[level - 1]!;
  return {
    width, height: 9, floor: 7,
    gaps, raised, floating, fruit: [appleX, appleY],
    start: [[2,6],[1,6]], exit:[width - 2,6],
  };
}
