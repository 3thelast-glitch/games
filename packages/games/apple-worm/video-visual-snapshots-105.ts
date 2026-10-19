/**
 * Visual snapshots reconstructed directly from the 105 archived JPG stills.
 *
 * Combines previously extracted terrain masks with independently detected red
 * apple, green worm, gray hazard/box, and possible spiral portal cells.
 * This is NOT a collection of 105 verified starting maps. A screenshot can
 * show eaten fruit, a displaced worm, missing off-screen portals and dynamic
 * moving obstacles. No screenshot can prove the original winning move route.
 */
import {
  appleWormSourceTerrainCandidate,
  APPLE_WORM_SOURCE_VIDEO_INDEXED_COUNT,
} from './video-terrain-evidence-105.ts';
import {
  appleWormImageEvidence,
  APPLE_WORM_IMAGE_ONLY_SNAPSHOT_COUNT,
} from './video-image-evidence-105.ts';

export const APPLE_WORM_VISUAL_SNAPSHOT_COUNT = 105;
export interface AppleWormVisualSnapshot {
  level:number;
  sourceImage:string;
  terrain:readonly string[];
  applesVisible:readonly (readonly [number,number])[];
  wormVisible:readonly (readonly [number,number])[];
  grayObjectsVisible:readonly (readonly [number,number])[];
  probablePortal:readonly [number,number] | null;
  /** The uploaded PDF frame is the user's approved target for in-game presentation. */
  referenceFrameApproved:true;
  /** Selected image frame might be mid-play, not original video level start. */
  snapshotIsOriginalLevelStart:false;
  /** No move sequence has been matched with the source winning route. */
  gameplayAndSolutionVerified:false;
  readyForLiveGame:false;
}

export function appleWormVisualSnapshot(level:number):AppleWormVisualSnapshot {
  if(APPLE_WORM_SOURCE_VIDEO_INDEXED_COUNT!==105 ||
     APPLE_WORM_IMAGE_ONLY_SNAPSHOT_COUNT!==105)
    throw new Error('Source evidence archive has incomplete stage count');
  const terrain=appleWormSourceTerrainCandidate(level);
  const objects=appleWormImageEvidence(level);
  return {
    level,
    sourceImage:objects.sourceImage,
    terrain:terrain.cells,
    applesVisible:objects.visibleApples,
    wormVisible:objects.visibleWormCells,
    grayObjectsVisible:objects.grayObstacleCandidates,
    probablePortal:objects.probablePortal,
    referenceFrameApproved:true,
    snapshotIsOriginalLevelStart:false,
    gameplayAndSolutionVerified:false,
    readyForLiveGame:false,
  };
}
