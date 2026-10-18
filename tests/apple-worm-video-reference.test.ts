import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  APPLE_WORM_VIDEO_STAGE_COUNT,
  APPLE_WORM_VIDEO_STAGE_TIMES,
  APPLE_WORM_VIDEO_REFERENCE_INDEX,
} from '../packages/games/apple-worm/reference-video.ts';

test('reference video is indexed 1–105, in ascending time order',()=>{
  assert.equal(APPLE_WORM_VIDEO_STAGE_COUNT,105);
  assert.equal(APPLE_WORM_VIDEO_REFERENCE_INDEX.length,105);
  assert.equal(APPLE_WORM_VIDEO_STAGE_TIMES[0],0);
  assert.equal(APPLE_WORM_VIDEO_STAGE_TIMES[104],2812);
  for(let i=0;i<105;i++){
    const stage=APPLE_WORM_VIDEO_REFERENCE_INDEX[i]!;
    assert.equal(stage.level,i+1);
    assert.equal(stage.firstKeyframeSeconds,APPLE_WORM_VIDEO_STAGE_TIMES[i]);
    assert.equal(stage.frame,'stage_'+String(i+1).padStart(3,'0')+'.jpg');
    if(i>0)assert.ok(APPLE_WORM_VIDEO_STAGE_TIMES[i]!>APPLE_WORM_VIDEO_STAGE_TIMES[i-1]!);
  }
});
test('video evidence is NOT confused with implemented or mechanically verified levels',()=>{
  for(const level of APPLE_WORM_VIDEO_REFERENCE_INDEX){
    assert.equal(level.mapTranscribed,false);
    assert.equal(level.initialPoseVerified,false);
    assert.equal(level.mechanicsVerified,false);
    assert.equal(level.solutionVerified,false);
  }
});
