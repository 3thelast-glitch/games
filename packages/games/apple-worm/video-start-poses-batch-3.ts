/**
 * THIRD (and final) isolated batch from the user's 966.82-second video.
 * Only opening frames are transcribed; approved terrain and portals remain
 * unchanged. Timestamps are the source-video clock, not PDF mid-play stills.
 *
 * Source starts:
 * 98 at ~821s: vertical U with four green segments and upper right apple.
 * 104 at ~848s: three-segment bend beside immobile seven-cell gray pillar.
 * 105 at ~914s: three-segment vertical worm on the right of the brick cross.
 */
import type { OriginalVideoInitialPose } from './video-start-poses-selected-33.ts';

export const BATCH_THREE_3=[98,104,105] as const;

export const APPLE_WORM_VIDEO_BATCH_THREE_STARTS:
  Readonly<Record<number,OriginalVideoInitialPose>>={
  98:{
    stage:98,timestampSeconds:821,
    sourceVideo:'Apple_Worm_Selected_33_Levels(1).mp4',
    headToTail:[[14,3],[14,4],[13,4],[12,4]],
    extraInitialApples:[[15,1]],
    // Three vertically stacked source saws (one omitted by the later PDF
    // snapshot) and the stationary gray block to their right.
    grayStartOverride:[[5,-1],[5,0],[5,1],[8,1]],
    evidence:'direct-video-frame',initialFrameStatus:'visible-clip-frame',
  },
  104:{
    stage:104,timestampSeconds:848,
    sourceVideo:'Apple_Worm_Selected_33_Levels(1).mp4',
    headToTail:[[6,7],[5,7],[5,6]],
    evidence:'direct-video-frame',initialFrameStatus:'visible-clip-frame',
  },
  105:{
    stage:105,timestampSeconds:914,
    sourceVideo:'Apple_Worm_Selected_33_Levels(1).mp4',
    headToTail:[[12,3],[12,2],[12,1]],
    evidence:'direct-video-frame',initialFrameStatus:'visible-clip-frame',
  },
};
