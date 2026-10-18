/** Reference-video indexing data — NOT live puzzle maps.
 * Extracted from the user's 47m53s, 640×360 Apple Worm video.
 * A first recognizable video keyframe can be a few seconds into the stage.
 * Do not mark maps as verified until their untouched start state, all obstacles,
 * mechanics, and a winning solution are independently checked against footage.
 */
export const APPLE_WORM_VIDEO_STAGE_TIMES = [
  0.00, 10.13, 20.27, 30.40, 40.53, 55.73, 65.87, 81.07, 101.33, 116.53,
  131.73, 141.87, 172.27, 187.47, 202.67, 222.93, 258.40, 288.80, 298.93, 334.40,
  380.00, 390.13, 405.33, 425.60, 445.87, 461.07, 481.33, 516.80, 547.20, 577.60,
  623.20, 653.60, 689.07, 729.60, 754.93, 785.33, 810.67, 830.93, 851.20, 891.73,
  917.07, 957.60, 988.00, 1008.27, 1028.53, 1053.87, 1089.33, 1104.53, 1140.00, 1160.27,
  1185.60, 1221.07, 1236.27, 1271.73, 1286.93, 1307.20, 1337.60, 1357.87, 1398.40, 1438.93,
  1469.33, 1479.47, 1489.60, 1540.27, 1585.87, 1616.27, 1656.80, 1692.27, 1727.73, 1763.20,
  1783.47, 1834.13, 1854.40, 1894.93, 1915.20, 1940.53, 1960.80, 1976.00, 1996.27, 2011.47,
  2041.87, 2107.73, 2122.93, 2158.40, 2198.93, 2229.33, 2264.80, 2280.00, 2320.53, 2340.80,
  2371.20, 2401.60, 2432.00, 2477.60, 2518.13, 2578.93, 2589.07, 2619.47, 2644.80, 2660.00,
  2675.20, 2710.67, 2725.87, 2746.13, 2812.00,
] as const;
export const APPLE_WORM_VIDEO_STAGE_COUNT = APPLE_WORM_VIDEO_STAGE_TIMES.length;
export interface StageVerification {
  level:number;
  firstKeyframeSeconds:number;
  frame:string;
  mapTranscribed:boolean;
  initialPoseVerified:boolean;
  mechanicsVerified:boolean;
  solutionVerified:boolean;
}
export const APPLE_WORM_VIDEO_REFERENCE_INDEX: readonly StageVerification[] =
  APPLE_WORM_VIDEO_STAGE_TIMES.map((firstKeyframeSeconds,i)=>({
    level:i+1,firstKeyframeSeconds,
    frame:`stage_${String(i+1).padStart(3,'0')}.jpg`,
    mapTranscribed:false,initialPoseVerified:false,
    mechanicsVerified:false,solutionVerified:false,
  }));