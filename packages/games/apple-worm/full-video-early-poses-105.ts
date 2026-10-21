/**
 * Early source-video worm poses found in the user's entire 105-level recording.
 * Source: Apple Worm - All Levels 1 - 105 _ Solving All Levels - Full Game(2).mp4
 * 640x360, 30fps, 2873.12s, original logical grid 21x9, with visible cells
 * above/below terrain when the game UI depicts them.
 *
 * Earliest observable frames were sampled at video stage-boundary +0.18s, or
 * in a handful of cases <=0.55s when a title animation hid the worm's mouth.
 * Segments were accepted when (1) the worm-green cells form ONE
 * unambiguous adjacent head-to-tail path and (2) the purple original mouth is
 * visible and locates its endpoint. Five occluded/edge starts were manually
 * traced from the user's video; early positions for 44/51 are backtracked
 * from the video frames BEFORE their first obvious mouth-position change.
 * Stage 85 still has ambiguous 2x2 body order. No arbitrary appended segments.
 *
 * Caveat: the first OBSERVABLE pose can differ from the first untouched game
 * state because the original walkthrough sometimes starts moving instantly.
 * "video-pose-evidence" does NOT mean physics or original winning route
 * verified. The six ambiguous levels are NOT overwritten or guessed.
 *
 * Encoded fields: level | absolute video seconds | hex cell indices where
 * index=(y+2)*21+x. Cells are ordered HEAD first. Non-game pixels/screenshots
 * are not embedded in source.
 */
import type { ScreenshotPoint } from './screenshot-game.ts';
export interface FullVideoWormPose {
  readonly stage:number;
  readonly timestampSeconds:number;
  readonly headToTail:readonly ScreenshotPoint[];
  readonly evidence:'mouth-visible-early-frame'|'mouth-visible-manual-trace'|'first-motion-backtracked';
  readonly untouchedOpeningVerified:false;
  readonly solutionVerified:false;
}
const VIDEO_START_RECORDS=`1|0.18|838297
2|8.31|9a99ae
3|16.45|848398
4|26.33|5b5a59
5|39.46|5b5a6f
6|53.91|5b5a59
7|65.80|5b5a59
8|78.25|999897
9|100.26|848398
10|111.71|5c5b5a
11|130.66|5d4847
12|140.55|868584
13|167.95|9b9a99
14|186.40|464544
15|199.10|86859a
16|219.36|848382
17|253.83|5a596e
18|284.23|474645
19|298.61|444358
20|333.83|9c9b9a
21|375.68|848398
22|385.56|474645
23|404.26|9897ac
24|424.03|313045
25|444.05|9b9aaf
26|460.75|848398
27|480.26|6f6e83
28|512.48|848398
29|543.38|9998ad
30|577.53|c8c7c6
31|621.63|b3b2b1
32|652.28|706f6e
33|687.25|31302f
34|725.78|9cb1c6
35|754.36|838485
36|783.76|9e9d9c
37|808.85|4b4a49
38|828.86|73889d
39|849.13|6d6e6f
40|888.66|4b4c61
41|915.50|9b9a99
42|956.53|a09f9e
43|986.93|848382
44|1005.20|31302f
45|1023.96|848382
46|1051.05|9a9998
47|1089.26|4a4948
48|1103.21|737271
49|1135.18|a1a09f
50|1158.70|4b4a49
51|1185.78|464544
52|1218.50|5d5c5b
53|1235.45|605f5e
55|1285.86|868788
56|1307.13|2f3031
57|1334.28|5c5d72
58|1354.80|363534
59|1395.33|1f1e1d
60|1435.36|5d5c5b
61|1465.26|494847
63|1489.53|868584
64|1540.20|888786
65|1581.80|5f5e5d
66|1614.95|8a8988
67|1652.23|b2b3b4
68|1688.95|5b5c5d
69|1726.16|9b9c9d
70|1761.33|4a495e73
71|1782.40|9d9c87
72|1834.06|607574
73|1853.83|758a8b
75|1914.88|71706f
76|1939.46|868584
77|1957.48|888786
78|1975.18|444342
79|1994.20|8a8988
81|2041.05|2f4459
82|2104.16|737271
84|2157.33|302f2e
86|2227.01|858483
87|2261.48|474849
88|2279.43|302f2e
89|2317.71|4c4b4a
90|2339.98|414243
91|2370.83|202136
92|2399.28|5e5d5c
93|2430.43|5d5e5f
94|2473.78|1b1c1d
95|2516.56|c6c5c4c3c2c1c0
96|2575.61|5a5b5c47
97|2585.20|85848382
98|2619.15|8b8a89
99|2644.23|6f70859a
100|2658.18|757677
101|2674.88|5a5958
102|2709.10|1a1918
103|2725.55|5a5958
104|2743.93|1a192e
105|2812.18|767560`.trim().split(/\n/);
/** Manually verified in the same FULL original video near each listed stage
 * boundary after green-only pixel voting hid the mouth-bearing cell.
 * Do not infer L85's U-shaped body traversal from a visually touching 2x2 square.
 */
const MANUAL_VISIBLE_OPENINGS=[
  {stage:54,timestampSeconds:1267.91,headToTail:[[6,4],[6,5],[6,6]]},
  {stage:62,timestampSeconds:1474.90,headToTail:[[7,3],[6,3],[5,3]]},
  {stage:74,timestampSeconds:1891.86,headToTail:[[16,7],[15,7],[14,7]]},
  {stage:80,timestampSeconds:2011.15,headToTail:[[10,5],[10,6],[10,7]]},
  {stage:83,timestampSeconds:2119.86,headToTail:[[8,-2],[7,-2],[6,-2]]},
] as const;
export const FULL_VIDEO_EARLY_POSE_COUNT=
  VIDEO_START_RECORDS.length+MANUAL_VISIBLE_OPENINGS.length;
export const FULL_VIDEO_AMBIGUOUS_LEVELS=[85] as const;
const decode=(hex:string):ScreenshotPoint[]=>{
  if(hex.length%2!==0)throw Error('Broken source video record');
  const result:ScreenshotPoint[]=[];
  for(let i=0;i<hex.length;i+=2){
    const n=Number.parseInt(hex.slice(i,i+2),16);
    result.push([n%21,Math.floor(n/21)-2]);
  }
  return result;
};
export const APPLE_WORM_FULL_VIDEO_EARLY_POSES:
  Readonly<Record<number,FullVideoWormPose>>=Object.fromEntries(
    [
      ...VIDEO_START_RECORDS.map(line=>{
        const fields=line.split('|');
        if(fields.length!==3)throw Error('Broken source video record');
        const stage=Number(fields[0]);
        const timestampSeconds=Number(fields[1]);
        const headToTail=decode(fields[2]!);
        return [stage,{
          stage,timestampSeconds,headToTail,
          evidence:stage===44||stage===51?'first-motion-backtracked':'mouth-visible-early-frame',
          untouchedOpeningVerified:false,
          solutionVerified:false,
        } satisfies FullVideoWormPose] as const;
      }),
      ...MANUAL_VISIBLE_OPENINGS.map(data=>[data.stage,{
        stage:data.stage,
        timestampSeconds:data.timestampSeconds,
        headToTail:data.headToTail as readonly ScreenshotPoint[],
        evidence:'mouth-visible-manual-trace',
        untouchedOpeningVerified:false,
        solutionVerified:false,
      } satisfies FullVideoWormPose] as const),
    ],
  );
