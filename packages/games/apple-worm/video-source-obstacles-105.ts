/**
 * Source video hazard classification from the user's full 105-level walkthrough.
 *
 * Frames: video stage-entry candidates at 640x360, logical x=33+30*col,
 * y=76+30*row. The 27px saw disk and square stone templates were taken
 * DIRECTLY from level 48/68/83 and 13/17/104 in that video, respectively.
 * Scanned ONLY grid cells, discarding the overlay buttons/sky background.
 * Original 53 saw-level masks were rechecked across 2,106 video second-samples,
 * finding 21 previously missed saw positions including the new saw-bearing
 * Level 39. Source-positive video evidence now covers 54 saw-bearing levels.
 * No verified whole-cell travel was observed; the wheels spin in place.
 * These are EARLY VISIBLE CELLS, not proof of exact future animated saw paths.
 *
 * Circles with serrated teeth are lethal spinning SAWS, never stone blocks.
 * Rounded cubical gray objects are STONES, potentially pushable.
 * Level 104's seven-stone pillar (4,1..7) is stationary; its free crate is
 * (6,7) in the original early frame (not the older image's 7,7).
 *
 * Red teardrops under platforms can be EDIBLE apples, as verified by filmed
 * bite/growth in Stage 32. Do not reclassify them as black spikes by appearance.
 * The black circular spiral is the exit, not a lethal black hazard.
 */
import type {ScreenshotPoint} from './screenshot-game.ts';
const SAWS=`
31|9:4 8:5 8:7 9:7 6:4
32|15:0 13:2 4:4 8:4 9:4 5:1
33|9:6 10:6 11:6 13:6 14:6
34|10:1 11:1 6:4 8:4 4:6
35|8:2 12:5
36|7:3 8:6 9:6 10:6 17:4
37|9:2 8:5 11:5
38|3:2 9:3 2:5 7:1
39|3:3
40|8:5
42|7:3 7:5
47|6:4
48|9:4 11:4 9:5 11:5 9:6 11:6
50|9:2 11:6
52|14:3
53|11:5 8:5
54|8:5 9:7
55|6:2 7:2 10:2 11:2 12:2 10:6 8:2
56|6:3 9:4
57|8:5 10:5
61|8:3
62|9:3
63|9:1 11:1 10:7 11:7
64|11:3
65|10:5 12:3 8:0
66|9:1 11:1 7:5 8:3
68|7:1 9:1 11:1 10:3 7:5
69|9:1
70|6:-1 8:-1
71|7:6 10:6 14:6
72|6:5 7:5 8:5 9:5 10:5
73|11:5 9:6 9:7 11:8 7:8
74|7:1 7:2 7:3 7:4 7:5 9:6 10:6 11:6
75|7:0 8:0
76|12:6 13:6 12:5
77|9:6 10:6 11:6 12:6 8:6
83|8:2 10:2 7:5 8:5 9:5 10:5 11:5
84|5:4
85|7:-1 14:3 11:3
87|8:3 10:3
88|7:4 9:4 10:4 7:6 7:5
89|5:3 12:3 4:4 6:4 5:5 13:4
90|13:-1 11:-1
91|8:-1 9:-1 11:0 6:6 7:7
92|10:-1 10:0
93|7:1 7:2 7:3
94|5:2 9:2 4:3 10:3 3:4 11:4 4:5 10:5 5:6 9:6
96|8:5 9:7 8:4
97|9:0 15:8
98|5:-1 5:0 5:1
99|6:0 7:1 11:4 12:5 8:6
100|11:4 9:5 9:6 11:7 7:7
102|10:-1 9:4
105|4:1 4:2
`.trim();
/** Only positive, high-confidence CUBE detections. Other unclassified gray
 * cells stay represented by the older gallery evidence (not typed as saws).
 */
const STONES=`
11|9:5
12|12:4
13|8:1
16|9:2 8:4
17|11:1 6:3
18|9:4 11:5
19|11:4
20|6:2 10:2
26|7:2
27|9:-1
29|8:1
30|9:5 11:6
37|9:4
43|6:-1
47|5:2
72|11:2
91|8:2
95|9:5 3:6
97|2:4 16:4
98|8:1
102|12:2 12:4
103|7:1
104|4:1 4:2 4:3 4:4 4:5 4:6 4:7 6:7
`.trim();
const parse=(text:string)=>Object.fromEntries(text.split('\n').map(line=>{
  const [id,cells]=line.trim().split('|');
  if(!id||!cells)throw new Error('Incomplete classified video object row');
  return [Number(id),cells.trim().split(/\s+/).map(coord=>{
    const [x,y]=coord.split(':').map(Number);
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=21||y< -2||y>9)
      throw new RangeError('Invalid source object position '+coord);
    return [x,y] as ScreenshotPoint;
  })];
})) as Readonly<Record<number,readonly ScreenshotPoint[]>>;
export const VIDEO_SAW_STARTS=parse(SAWS);
export const VIDEO_STONE_STARTS=parse(STONES);
export const VIDEO_SAW_STAGE_COUNT=Object.keys(VIDEO_SAW_STARTS).length;
/**
 * No separate BLACK, triangular lethal spikes are verified in the supplied
 * 105-stage source video. Their source-coordinate inventory remains EMPTY.
 *
 * Critical temporal evidence: in L32 (t=654→669s) a red object hanging below
 * the upper saw disappears when the worm EATS it. It is an apple, not a spike,
 * regardless of whether its green leaf was occluded in a single video frame.
 * Similar red drop-shaped objects MUST NOT be converted into lethal hazards
 * on color detection alone. Need actual contact/death evidence before adding.
 */
export const VIDEO_TRIANGULAR_SPIKES:Readonly<Record<number,readonly ScreenshotPoint[]>>={};
export const VIDEO_THORN_STAGE_COUNT=0;
export const VIDEO_THORN_CELL_COUNT=0;
/** Source-informed exception: stage 104 seven-cell tower is unmovable.
 * Stage 104 single loose stone is at (6,7); all other typed solo/loose
 * stones use push & gravity. Confirmation of exact future stone motion needs
 * segment-by-segment video comparison, not just a source opening screenshot.
 */
export const STATIONARY_STONES:Readonly<Record<number,readonly ScreenshotPoint[]>>={
  104:[[4,1],[4,2],[4,3],[4,4],[4,5],[4,6],[4,7]],
};
export const sourceSawStarts=(n:number)=>VIDEO_SAW_STARTS[n]??[];
export const sourceStoneStarts=(n:number)=>VIDEO_STONE_STARTS[n]??[];
export const sourceSpikeStarts=(n:number)=>VIDEO_TRIANGULAR_SPIKES[n]??[];
