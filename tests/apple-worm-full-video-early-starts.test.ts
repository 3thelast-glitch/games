import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  APPLE_WORM_FULL_VIDEO_EARLY_POSES,
  FULL_VIDEO_EARLY_POSE_COUNT,
  FULL_VIDEO_AMBIGUOUS_LEVELS,
} from '../packages/games/apple-worm/full-video-early-poses-105.ts';
import {
  APPLE_WORM_FULL_VIDEO_VISIBLE_APPLES,
  FULL_VIDEO_APPLE_EVIDENCE_COUNT,
} from '../packages/games/apple-worm/full-video-early-apples-105.ts';
import {screenshotWormLevel,startScreenshotWorm} from '../packages/games/apple-worm/screenshot-game.ts';

test('complete source video yields exactly 99 mouth-identified contiguous early worms',()=>{
  assert.equal(FULL_VIDEO_EARLY_POSE_COUNT,99);
  assert.equal(Object.keys(APPLE_WORM_FULL_VIDEO_EARLY_POSES).length,99);
  assert.deepEqual(FULL_VIDEO_AMBIGUOUS_LEVELS,[54,62,74,80,83,85]);
  for(let n=1;n<=105;n++){
    const e=APPLE_WORM_FULL_VIDEO_EARLY_POSES[n];
    const stage=screenshotWormLevel(n);
    if(!e){
      assert.ok(FULL_VIDEO_AMBIGUOUS_LEVELS.includes(n as typeof FULL_VIDEO_AMBIGUOUS_LEVELS[number]));
      assert.ok(stage.issues.includes('full-video-opening-pose-needs-manual-review'));
      continue;
    }
    assert.equal(e.stage,n);
    assert.equal(e.untouchedOpeningVerified,false);
    assert.equal(e.solutionVerified,false);
    assert.ok(e.timestampSeconds>=0&&e.timestampSeconds<=2873);
    assert.ok(e.headToTail.length>=3);
    assert.ok(e.headToTail.every(([x,y])=>
      Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<21&&y>=-2&&y<=9));
    for(let i=1;i<e.headToTail.length;i++){
      const a=e.headToTail[i-1]!,b=e.headToTail[i]!;
      assert.equal(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]),1,`worm adjacency stage ${n}`);
    }
    assert.deepEqual(stage.worm,e.headToTail,`early video wins over later still stage ${n}`);
    assert.deepEqual(startScreenshotWorm(n).body,e.headToTail);
    assert.ok(stage.issues.includes('full-video-early-pose-mouth-confirmed'));
  }
});

test('99 early fruit frames restore eaten apples without inventing absent objects',()=>{
  assert.equal(FULL_VIDEO_APPLE_EVIDENCE_COUNT,99);
  const keys=Object.keys(APPLE_WORM_FULL_VIDEO_VISIBLE_APPLES).map(Number);
  assert.equal(keys.length,99);
  for(const n of keys){
    const apples=APPLE_WORM_FULL_VIDEO_VISIBLE_APPLES[n]!;
    assert.ok(apples.length>=1);
    assert.equal(new Set(apples.map(([x,y])=>x+','+y)).size,apples.length);
    assert.deepEqual(screenshotWormLevel(n).apples,apples);
    assert.ok(screenshotWormLevel(n).issues.includes('full-video-early-apples-visible'));
  }
  assert.deepEqual(screenshotWormLevel(2).apples,[[6,3]],'stage 2 source apple exists before the bite');
  assert.deepEqual(screenshotWormLevel(30).apples,[[11,4],[10,5],[9,6],[9,8],[11,8]]);
  assert.equal(screenshotWormLevel(101).apples.length,12);
  assert.deepEqual(screenshotWormLevel(1).worm,[[5,4],[4,4],[4,5]]);
  assert.deepEqual(screenshotWormLevel(5).worm,[[7,2],[6,2],[6,3]]);
});

test('source video evidence preserves unresolved confidence flags, no fake winning-route validation',()=>{
  for(let n=1;n<=105;n++){
    const stage=screenshotWormLevel(n);
    assert.equal(stage.exactPhysicsVerified,false);
    assert.equal(stage.exactVisualComparisonPassed,false);
    assert.equal(stage.referenceFrameApproved,true);
  }
});
