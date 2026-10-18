import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  APPLE_WORM_VISUAL_SNAPSHOT_COUNT,
  appleWormVisualSnapshot,
} from '../packages/games/apple-worm/video-visual-snapshots-105.ts';

test('all 105 archive images have combined geometry/object snapshot records',()=>{
  assert.equal(APPLE_WORM_VISUAL_SNAPSHOT_COUNT,105);
  for(let n=1;n<=105;n++){
    const stage=appleWormVisualSnapshot(n);
    assert.equal(stage.level,n);
    assert.equal(stage.terrain.length,9);
    assert.ok(stage.terrain.every(row=>row.length===21));
    assert.equal(stage.sourceImage,`stage_${String(n).padStart(3,'0')}.jpg`);
    assert.equal(stage.snapshotIsOriginalLevelStart,false);
    assert.equal(stage.gameplayAndSolutionVerified,false);
    assert.equal(stage.readyForLiveGame,false);
  }
  assert.throws(()=>appleWormVisualSnapshot(0),RangeError);
  assert.throws(()=>appleWormVisualSnapshot(106),RangeError);
});

test('images cannot be mistaken for untouched starts or full source solutions',()=>{
  assert.equal(appleWormVisualSnapshot(2).applesVisible.length,0);
  assert.equal(appleWormVisualSnapshot(2).wormVisible.length,4);
  // Fruit was already consumed when screenshot stage 2 was captured.
  assert.equal(appleWormVisualSnapshot(101).applesVisible.length,12);
  assert.equal(appleWormVisualSnapshot(101).probablePortal,null);
  assert.equal(appleWormVisualSnapshot(48).grayObjectsVisible.length,6);
});
