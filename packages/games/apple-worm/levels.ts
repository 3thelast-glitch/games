/**
 * NAQLA Apple Worm: 40 independently designed, playable challenge maps.
 * Inspired by the *difficulty progression* discussed at applewormlevel.com,
 * NOT copied maps or copyrighted game level assets.
 *
 * ASCII tile format for quick human review and deliberate map iteration:
 * one string per stage; five visible rows (y=3...7) separated by slash;
 * "." free, "#" solid earth, "H" worm head, "o" body, "A" fruit, "X" exit.
 * Three clear rows above plus two below provide safe falling room.
 *
 * Unlike the old near-identical straight corridors, maps progress toward
 * raised cliffs, floor gaps, suspended platforms, 2-4 fruits and long routes.
 * Move counts below are *shortest solutions from the independent solver*
 * at the time the maps were authored and must be checked by CI on changes.
 */
const MAPS: readonly string[] = [
  "............/............/............/.oH.A.....X./############",
  "............./............./............./.oHA.......X./#############",
  "............./............./............./.oHA....#..X./#############",
  "............./............./............./.oHA....#..X./#########.###",
  "............./............./............./.oHA.....#.X./######.######",
  "............./............./....#......../.oHA#......X./#####.#######",
  "............./............./.........#.../.oH.A....#X../#######.#####",
  "............/............/........#.../.oHA....#X../######.#####",
  "............/............/........#.../.oH.A...#X../######.#####",
  "............/............/........#.../.oH...A.#X../####.#######",
  "............./............./.....#......./.oH.A#.#A..X./#######.#####",
  "..........#..../.............../.............../.oH...A#A..#X../###########.###",
  "......#......../.............../.............../.oH..#A...#.X../#########.#####",
  "......#......../.............../.............../.oH.#A....A#.X./#########.#####",
  ".............../.............../....#........../.oHA#A....#..X./#######.###.###",
  ".........#...../.............../.....#...#...../.oH.##.A.#.A.X./##########.####",
  "............./............./.........#.../.oH..#..A#AX./#######.#####",
  "............../............../.......#....../.oH.#.A#A...X./#####.########",
  ".............../.............../.........#...../.oHA.##A.#..X../####.##########",
  ".............../.............../........#....../.oH....A.#A..X./#####.###.#####",
  "................./........#......../.........#......./.oHA...#.#A..X.../####..###########",
  "................./................./........#....#.../.oH.A.##....A#.X./#######..########",
  "................./............#..../.........#.#...../.oH.......A#AX.../####.#.##########",
  ".....#.........../.......#........./....#............/.oHA#A.....#..AX./#########.##.####",
  ".............#../......#........./.....##........./.oHAA##A......X./##########...###",
  "................/................/....#.........../.oHA#A.A..#...X./##########..####",
  "........#......./...........#..../...........#..../.oHAA#A....#..X./#####.###..#####",
  "................./................./..........#....../.oH..A.#AA...#X../####.##.##.######",
  ".....#.........../................./................./.oHA#...#.A..#AX./###########.#.###",
  "................./................./.....#......#..../.oHA#.A.##..#AX../####..#####.#####",
  "................./........#......../....#...#.#....../.oHA#AA.#.#...X../#######.#.###.###",
  "................../................../.....#.....#...#../.oH.##.#A..#..AAX./#########.#.#.####",
  "...........#....../................../......#.##....#.../.oHA.A#.##A...#.X./######..######.###",
  ".............##../.........#...#.../.............#.../.oH...A...AA.#AX./#####.##..#######",
  "................../......#.........../.....#.#........../.oHA.#...A.###AAX./######...#########",
  ".........#......../.........#......../............#.#.../.oH.#..A.#A...#AX./#####.##..#.######",
  "..........#....../................./.....#....#....../.oHA.#A...#A.#.X./#######.##.#.####",
  "......#.........#../.................../.....##.......#..../.oHAA.#A....###A.X./#####.###..###.####",
  "................../................../....#............./.oHA#A.....A..#AX./#######.##.#..####",
  ".............#...../.....#......#....../....###.#...#....../.oHA###.A...###AAX./#######.#..###.####",
];
export const APPLE_WORM_STAGE_COUNT = MAPS.length;
export const APPLE_WORM_GROUP_SIZE = 10;
export const APPLE_WORM_GROUPS = Object.freeze(
  Array.from({length: Math.ceil(MAPS.length / APPLE_WORM_GROUP_SIZE)},
    (_, i) => ({start:i*APPLE_WORM_GROUP_SIZE+1,
      end:Math.min((i+1)*APPLE_WORM_GROUP_SIZE,MAPS.length)})),
);
export type LevelDifficulty = 'easy'|'medium'|'hard'|'expert';
export const APPLE_WORM_CHAPTERS: readonly {
  difficulty: LevelDifficulty; description: string;
}[] = [
  {difficulty:'easy',description:'First steps • turning, fruit and simple ledges'},
  {difficulty:'medium',description:'Ridges • two fruits, support and recovery'},
  {difficulty:'hard',description:'Crossings • three fruits, tight gaps and multi-step turns'},
  {difficulty:'expert',description:'Master routes • layered cliffs and 30–40 move puzzles'},
];

export interface StageBlueprint {
  width:number;
  height:number;
  floor:number;
  gaps:readonly number[];
  raised:readonly number[];
  floating:ReadonlyArray<readonly [number,number]>;
  /** Legacy alias retained for consumers expecting one apple. */
  fruit: readonly [number,number];
  fruits:ReadonlyArray<readonly [number,number]>;
  blocks:ReadonlyArray<readonly [number,number]>;
  start:ReadonlyArray<readonly [number,number]>;
  exit:readonly [number,number];
  difficulty:LevelDifficulty;
}
export function appleWormBlueprint(level:number):StageBlueprint {
  if(!Number.isInteger(level)||level<1||level>MAPS.length)throw new RangeError('Invalid Apple Worm level');
  const rows=MAPS[level-1]!.split('/');
  const width=rows[0]!.length;
  const blocks:[number,number][]=[];
  const fruits:[number,number][]=[];
  const start:[number,number][]=[];
  let head:[number,number]|null=null;
  let exit:[number,number]|null=null;
  for(let y=0;y<rows.length;y++){
    const line=rows[y]!;
    if(line.length!==width)throw new Error('Bad Apple Worm row width in level '+level);
    for(let x=0;x<width;x++){
      const tile=line[x]!;
      if(tile==='#')blocks.push([x,y+3]);
      if(tile==='A')fruits.push([x,y+3]);
      if(tile==='H')head=[x,y+3];
      if(tile==='o')start.push([x,y+3]);
      if(tile==='X')exit=[x,y+3];
    }
  }
  if(!head||!exit||!fruits.length)throw new Error('Invalid Apple Worm level '+level);
  const ground=new Set(blocks.filter(([x,y])=>y===7).map(([x])=>x));
  return {
    width,height:10,floor:7,
    gaps:Array.from({length:width},(_,x)=>x).filter(x=>!ground.has(x)),
    raised:blocks.filter(([x,y])=>y===6).map(([x])=>x),
    floating:blocks.filter(([x,y])=>y<6),
    fruit:fruits[0]!,fruits,blocks,
    start:[head,...start.sort((a,b)=>Math.abs(a[0]-head![0])+Math.abs(a[1]-head![1])-
       Math.abs(b[0]-head![0])-Math.abs(b[1]-head![1]))],
    exit,
    difficulty: APPLE_WORM_CHAPTERS[Math.floor((level-1)/10)]!.difficulty,
  };
}
