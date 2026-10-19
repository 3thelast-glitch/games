/**
 * Source video: Apple_Worm_Selected_33_Levels(1).mp4, 640×360, 966.82 s.
 * These are only states independently recoverable from the USER'S OWN video.
 *
 * These are video START-FRAME corrections, not arbitrary extra body segments
 * inserted to make a solver pass. The 105 accepted terrain masks and portal
 * positions stay unchanged. The source contact-sheet snapshots were taken at
 * varying times and missed occluded green segments and some eaten fruits.
 *
 * IMPORTANT: Only the FIRST BATCH of 15 is in this PR; 18 later stages are untouched.
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

/** Visible clip evidence must be verified against the original video; purple face fixes the head endpoint and contiguous green cells fix length. */
export const APPLE_WORM_VIDEO_START_POSES:Readonly<Record<number,OriginalVideoInitialPose>>={
  5:{
  7:{
  8:{
  9:{
  12:{
  13:{
  14:{
  15:{
  17:{
  18:{
  19:{
  20:{
  28:{
  30:{
  34:{

};

export const VIDEO_AUDIT_REQUESTED_33=Object.freeze([
  5,7,8,9,12,13,14,15,17,18,19,20,28,30,34,39,40,42,44,
  49,51,58,59,71,72,73,76,86,96,97,98,104,105,
] as const);
