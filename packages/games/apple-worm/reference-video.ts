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
/** Earliest numeral-confirmed 0.25-second sample. May still be after a move.
 *  Stage 105 uses the first keyed frame because the earlier text is ambiguous.
 */
export const APPLE_WORM_VIDEO_FIRST_OBSERVED_TIMES = [
  0.000, 8.133, 16.267, 26.150, 39.283, 53.733, 65.617, 78.067, 100.083, 111.533,
  130.483, 140.367, 167.767, 186.217, 198.917, 219.183, 253.650, 284.050, 298.433, 333.650,
  375.500, 385.383, 404.083, 423.850, 443.867, 460.567, 480.083, 512.300, 543.200, 577.350,
  621.450, 652.100, 687.067, 725.600, 754.183, 783.583, 808.667, 828.683, 848.950, 888.483,
  915.317, 956.350, 986.750, 1005.017, 1023.783, 1050.867, 1089.083, 1103.033, 1135.000, 1158.517,
  1185.600, 1218.317, 1235.267, 1267.733, 1285.683, 1306.950, 1334.100, 1354.617, 1395.150, 1435.183,
  1465.083, 1474.717, 1489.350, 1540.017, 1581.617, 1614.767, 1652.050, 1688.767, 1725.983, 1760.950,
  1782.217, 1833.883, 1853.650, 1891.683, 1914.700, 1939.283, 1957.300, 1975.000, 1994.017, 2010.967,
  2040.867, 2103.983, 2119.683, 2157.150, 2195.683, 2226.833, 2261.300, 2279.250, 2317.533, 2339.800,
  2370.450, 2399.100, 2430.250, 2473.600, 2516.383, 2575.433, 2584.817, 2618.967, 2644.050, 2658.000,
  2674.700, 2708.917, 2725.367, 2743.383, 2812.000,
] as const;

export const APPLE_WORM_VIDEO_STAGE_COUNT = APPLE_WORM_VIDEO_STAGE_TIMES.length;
export interface StageVerification {
  level:number;
  firstKeyframeSeconds:number;
  firstObservedSeconds:number;
  frame:string;
  mapTranscribed:boolean;
  initialPoseVerified:boolean;
  mechanicsVerified:boolean;
  solutionVerified:boolean;
}
export const APPLE_WORM_VIDEO_REFERENCE_INDEX: readonly StageVerification[] =
  APPLE_WORM_VIDEO_STAGE_TIMES.map((firstKeyframeSeconds,i)=>({
    level:i+1,firstKeyframeSeconds,
    firstObservedSeconds:APPLE_WORM_VIDEO_FIRST_OBSERVED_TIMES[i]!,
    frame:`stage_${String(i+1).padStart(3,'0')}.jpg`,
    mapTranscribed:false,initialPoseVerified:false,
    mechanicsVerified:false,solutionVerified:false,
  }));