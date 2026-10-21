/**
 * All bright RED APPLES visibly present in the early full-video stills.
 * Source: user uploaded complete 105-level walkthrough, 640x360.
 *
 * Red classification uses HSV red hue, saturation >=150, value >=142,
 * central 21x21 pixel vote >=220 to exclude brown terrain/brick textures.
 * Positive detections are evidence of an apple's location; zero detections
 * are NOT proof that the untouched stage has no apples (occlusion/cropping).
 * Thus this map contains only 99 stages with positive detections; other
 * stages continue using the source screenshot/clip evidence.
 * This is not a certification of all 105 actual source winning routes.
 */
import type { ScreenshotPoint } from './screenshot-game.ts';
const RED_FRUIT_EVIDENCE=`2|6f
3|73
5|9c
6|88
7|9d
8|87
10|b1
12|5d
13|87
14|9d
15|72
16|43
17|5e
18|9c
19|5c
20|83
21|5d
22|88
23|74
24|88
25|5e
26|70
27|b1
28|71
29|87
30|899db1dbdd
31|8589
32|59
33|59
34|8a9e
35|768195
36|5a5b73888a
37|4f
38|b1
39|429b
40|848c
41|7076818f
42|5a82
43|70
44|494c
45|7285
46|4b86
47|76
48|86888a9db2
49|7899
50|4f
51|1e7173
52|45788b
53|4970
54|8587
55|5d749f
56|45889b
57|85899c
58|78b1c8
59|5e
60|6fb2
61|5b7085
62|889a
63|88a0
64|7799a2
65|59b1
66|4c72
67|728b98
68|8486b1b3d8da
69|898b9ec6
70|474ab0
71|225e84
72|4989
73|9a9b9c9dafb3c4c8dadbdc
74|33629cb6
75|59
76|75a0
77|9b9c9d9e9f
78|6d86
79|73
80|86888a9c9eb0b4c6c8
81|828496989aacaec2
82|868788
83|31333547495b5d5f7173858789
84|586faec1
85|71
86|6e75
87|315d8a
88|5b5e75a0
89|5e6062888c9eb4b6
90|454b9e
91|22718b
92|444c9faec6
93|3133389eb0b6c9
94|5b6f71838587999baf
96|87
97|1e8a95a3
98|4e7799c1
99|81
100|858687889a9eafb3c5c6c7
101|6d6e6f707172acadaeafb0b1
102|365d7275
103|5b74
105|2e6b6c6e6f7071`.trim().split(/\n/);
function decode(hex:string):readonly ScreenshotPoint[]{
  if(hex.length%2)throw new Error('Invalid early-video apple evidence');
  const out:ScreenshotPoint[]=[];
  for(let i=0;i<hex.length;i+=2){
    const n=Number.parseInt(hex.slice(i,i+2),16);
    out.push([n%21,Math.floor(n/21)-2]);
  }
  return out;
}
export const FULL_VIDEO_APPLE_EVIDENCE_COUNT=RED_FRUIT_EVIDENCE.length;
export const APPLE_WORM_FULL_VIDEO_VISIBLE_APPLES:
  Readonly<Record<number,readonly ScreenshotPoint[]>>=Object.fromEntries(
    RED_FRUIT_EVIDENCE.map(line=>{
      const [level,hex]=line.split('|');
      return [Number(level),decode(hex!)];
    }),
  );
