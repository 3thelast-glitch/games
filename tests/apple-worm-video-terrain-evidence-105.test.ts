import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  APPLE_WORM_SOURCE_VIDEO_INDEXED_COUNT,
  APPLE_WORM_SOURCE_VIDEO_MANUALLY_TRACED_COUNT,
  APPLE_WORM_SOURCE_VIDEO_PLAYABLE_VERIFIED_COUNT,
  appleWormSourceTerrainCandidate,
} from '../packages/games/apple-worm/video-terrain-evidence-105.ts';
import {appleWormVideoTracedStage} from '../packages/games/apple-worm/video-traced-stages.ts';

test('every level 1–105 has a decoded frame-based terrain evidence mask, not a gameplay claim',()=>{
  assert.equal(APPLE_WORM_SOURCE_VIDEO_INDEXED_COUNT,105);
  assert.equal(APPLE_WORM_SOURCE_VIDEO_MANUALLY_TRACED_COUNT,10);
  assert.equal(APPLE_WORM_SOURCE_VIDEO_PLAYABLE_VERIFIED_COUNT,0);
  for(let n=1;n<=105;n++){
    const stage=appleWormSourceTerrainCandidate(n);
    assert.equal(stage.level,n);
    assert.equal(stage.width,21);
    assert.equal(stage.height,9);
    assert.equal(stage.cells.length,9);
    assert.ok(stage.cells.every(row=>row.length===21 && /^[.#]+$/.test(row)));
    assert.equal(stage.provenance,n<=10?'entry-frame-traced':'heuristic-video-frame');
    assert.equal(stage.mapFullyVerified,false);
    assert.equal(stage.sourceWinningRouteVerified,false);
    assert.equal(stage.readyForLiveGame,false);
    if(n<=10){
      const entry=appleWormVideoTracedStage(n);
      assert.deepEqual(stage.cells,entry.rows,'traced source map differs '+n);
    }
  }
  assert.throws(()=>appleWormSourceTerrainCandidate(0),RangeError);
  assert.throws(()=>appleWormSourceTerrainCandidate(106),RangeError);
});
