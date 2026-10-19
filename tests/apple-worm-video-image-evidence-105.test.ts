import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  APPLE_WORM_IMAGE_ONLY_SNAPSHOT_COUNT,
  appleWormImageEvidence,
} from '../packages/games/apple-worm/video-image-evidence-105.ts';

test('all 105 screenshots yield bounded object candidates, without falsely certifying playable maps',()=>{
  assert.equal(APPLE_WORM_IMAGE_ONLY_SNAPSHOT_COUNT,105);
  const images=new Set<string>();
  let hasApples=0,hasWorm=0,hasGray=0,hasExit=0;
  for(let n=1;n<=105;n++){
    const s=appleWormImageEvidence(n);
    assert.equal(s.level,n);
    assert.equal(s.sourceImage,`stage_${String(n).padStart(3,'0')}.jpg`);
    images.add(s.sourceImage);
    assert.equal(s.sourceInitialStateVerified,false);
    assert.equal(s.sourceSolutionVerified,false);
    assert.equal(s.readyForLiveGame,false);
    for(const coord of [
      ...s.visibleApples,...s.visibleWormCells,...s.grayObstacleCandidates,
      ...(s.probablePortal?[s.probablePortal]:[]),
    ]){
      assert.equal(coord.length,2);
      const [x,y]=coord;
      assert.ok(Number.isInteger(x)&&x>=0&&x<=20,`stage ${n} x`);
      assert.ok(Number.isInteger(y)&&y>=-2&&y<=9,`stage ${n} y`);
    }
    hasApples+=+(s.visibleApples.length>0);
    hasWorm+=+(s.visibleWormCells.length>0);
    hasGray+=+(s.grayObstacleCandidates.length>0);
    hasExit+=+(s.probablePortal!==null);
  }
  assert.equal(images.size,105);
  assert.equal(hasApples,97);
  assert.equal(hasWorm,105,'recovered three initially unrecognized worms by manual PDF review');
  assert.equal(hasGray,69);
  assert.equal(hasExit,102,'three UI-overlay-only frames must not receive invented exits');
  assert.throws(()=>appleWormImageEvidence(0),RangeError);
  assert.throws(()=>appleWormImageEvidence(106),RangeError);
});

test('stage 2 screenshot is post-apple: image analysis must not call that a zero-fruit start',()=>{
  const stage=appleWormImageEvidence(2);
  assert.equal(stage.visibleApples.length,0);
  assert.equal(stage.visibleWormCells.length,4); // Apple already consumed in still
  assert.equal(stage.sourceInitialStateVerified,false);
  assert.deepEqual(stage.probablePortal,[13,2], 'PDF Level 002 exit above the L');
});

test('high stages with many apples and saws retain independently visible objects',()=>{
  const s48=appleWormImageEvidence(48);
  assert.equal(s48.visibleApples.length,4);
  assert.equal(s48.grayObstacleCandidates.length,6);
  assert.deepEqual(s48.probablePortal,[10,-2]); // video image portal above board
  const s101=appleWormImageEvidence(101);
  assert.equal(s101.visibleApples.length,12); // two 6-apple rows in still
  assert.equal(s101.visibleWormCells.length,3);
  assert.equal(s101.probablePortal,null); // black UI near WatchON is not an exit
  assert.equal(appleWormImageEvidence(70).probablePortal,null);
  assert.equal(appleWormImageEvidence(95).probablePortal,null);
  assert.deepEqual(appleWormImageEvidence(73).probablePortal,[6,9]); // lower edge
  assert.deepEqual(appleWormImageEvidence(100).probablePortal,[6,9]); // lower edge
  assert.deepEqual(appleWormImageEvidence(56).probablePortal,[9,-2]);
  assert.deepEqual(appleWormImageEvidence(12).probablePortal,[14,0]);
  assert.deepEqual(appleWormImageEvidence(33).probablePortal,[14,0]);
  assert.deepEqual(appleWormImageEvidence(105).probablePortal,[17,-1]);
  assert.equal(appleWormImageEvidence(59).visibleWormCells.length,4);
  assert.equal(appleWormImageEvidence(91).visibleWormCells.length,5);
  assert.equal(appleWormImageEvidence(95).visibleWormCells.length,7);
});
