/**
 * Source video: Apple_Worm_Selected_33_Levels(1).mp4, 640×360, 966.82 s.
 * These are only states independently recoverable from the USER'S OWN video.
 *
 * These are video START-FRAME corrections, not arbitrary extra body segments
 * inserted to make a solver pass. The 105 accepted terrain masks and portal
 * positions stay unchanged. The source contact-sheet snapshots were taken at
 * varying times and missed occluded green segments and some eaten fruits.
 *
 * IMPORTANT: Only first batch of 15 is changed; 18 later levels remain untouched.
 * Green foreground occlusion and dynamic gray physics require frame tracing.
 */
import type { ScreenshotPoint } from './screenshot-game.ts';
export interface OriginalVideoInitialPose {
  readonly stage:number;
  readonly timestampSeconds:number;
  readonly sourceVideo:'Apple_Worm_Selected_33_Levels(1).mp4';
  readonly headToTail:readonly ScreenshotPoint[];
  readonly extraInitialApples?:readonly ScreenshotPoint[];
  readonly grayStartOverride?:readonly ScreenshotPoint[];
  readonly evidence:'direct-video-frame';
  readonly initialFrameStatus:'visible-clip-frame';
}

/** Source frames verified at 00:00, 00:17, 04:53, 13:44, 14:08.
 * 15:16 for Level 105. Do not infer a head from green-area threshold alone: purple/mouth fixes the
 * head endpoint; contiguous green body pieces fix the original length. */
export const APPLE_WORM_VIDEO_START_POSES:Readonly<Record<number,OriginalVideoInitialPose>>={
  5:{
    stage:5,timestampSeconds:0,sourceVideo:'Apple_Worm_Selected_33_Levels(1).mp4',
    headToTail:[[8,4],[9,4],[9,3],[9,2]],
    evidence:'direct-video-frame',initialFrameStatus:'visible-clip-frame',
  },
  7:{
    stage:7,timestampSeconds:17,sourceVideo:'Apple_Worm_Selected_33_Levels(1).mp4',
    headToTail:[[6,5],[7,5],[8,5]],
    evidence:'direct-video-frame',initialFrameStatus:'visible-clip-frame',
  },
  8:{
    stage:8,timestampSeconds:25,sourceVideo:'Apple_Worm_Selected_33_Levels(1).mp4',
    headToTail:[[6,5],[5,5],[4,5]],
    evidence:'direct-video-frame',initialFrameStatus:'visible-clip-frame',
  },
  9:{
    stage:9,timestampSeconds:47,sourceVideo:'Apple_Worm_Selected_33_Levels(1).mp4',
    headToTail:[[8,4],[7,4],[6,4],[5,4]],
    evidence:'direct-video-frame',initialFrameStatus:'visible-clip-frame',
  },
  12:{
    stage:12,timestampSeconds:65,sourceVideo:'Apple_Worm_Selected_33_Levels(1).mp4',
    headToTail:[[11,4],[12,4],[13,4]],
    grayStartOverride:[[10,4]],
    evidence:'direct-video-frame',initialFrameStatus:'visible-clip-frame',
  },
  13:{
    stage:13,timestampSeconds:86,sourceVideo:'Apple_Worm_Selected_33_Levels(1).mp4',
    headToTail:[[8,5],[7,5],[6,5]],
    evidence:'direct-video-frame',initialFrameStatus:'visible-clip-frame',
  },
  14:{
    stage:14,timestampSeconds:104,sourceVideo:'Apple_Worm_Selected_33_Levels(1).mp4',
    headToTail:[[7,1],[6,1],[5,1]],
    evidence:'direct-video-frame',initialFrameStatus:'visible-clip-frame',
  },
  15:{
    stage:15,timestampSeconds:117,sourceVideo:'Apple_Worm_Selected_33_Levels(1).mp4',
    headToTail:[[8,4],[7,4],[7,5]],
    evidence:'direct-video-frame',initialFrameStatus:'visible-clip-frame',
  },
  17:{
    stage:17,timestampSeconds:140,sourceVideo:'Apple_Worm_Selected_33_Levels(1).mp4',
    headToTail:[[9,2],[9,3],[8,3]],
    evidence:'direct-video-frame',initialFrameStatus:'visible-clip-frame',
  },
  18:{
    stage:18,timestampSeconds:168,sourceVideo:'Apple_Worm_Selected_33_Levels(1).mp4',
    headToTail:[[10,1],[9,1],[8,1]],
    evidence:'direct-video-frame',initialFrameStatus:'visible-clip-frame',
  },
  19:{
    stage:19,timestampSeconds:184,sourceVideo:'Apple_Worm_Selected_33_Levels(1).mp4',
    headToTail:[[12,4],[12,3],[12,2],[12,1]],
    evidence:'direct-video-frame',initialFrameStatus:'visible-clip-frame',
  },
  20:{
    stage:20,timestampSeconds:217,sourceVideo:'Apple_Worm_Selected_33_Levels(1).mp4',
    headToTail:[[9,5],[8,5],[7,5]],
    evidence:'direct-video-frame',initialFrameStatus:'visible-clip-frame',
  },
  28:{
    stage:28,timestampSeconds:263,sourceVideo:'Apple_Worm_Selected_33_Levels(1).mp4',
    headToTail:[[7,4],[6,4],[5,4]],
    evidence:'direct-video-frame',initialFrameStatus:'visible-clip-frame',
  },
  30:{
    stage:30,timestampSeconds:293,sourceVideo:'Apple_Worm_Selected_33_Levels(1).mp4',
    headToTail:[[11,6],[12,6],[12,7]],
    // Two bottom apples have not yet been eaten at this filmed start.
    extraInitialApples:[[9,8],[11,8]],
    grayStartOverride:[[9,5],[10,7]],
    evidence:'direct-video-frame',initialFrameStatus:'visible-clip-frame',
  },
  34:{
    stage:34,timestampSeconds:340,sourceVideo:'Apple_Worm_Selected_33_Levels(1).mp4',
    headToTail:[[6,5],[6,6],[7,6]],
    evidence:'direct-video-frame',initialFrameStatus:'visible-clip-frame',
  },

};

export const VIDEO_AUDIT_REQUESTED_33=Object.freeze([
  5,7,8,9,12,13,14,15,17,18,19,20,28,30,34,39,40,42,44,
  49,51,58,59,71,72,73,76,86,96,97,98,104,105,
] as const);
