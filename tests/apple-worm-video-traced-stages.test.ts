import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  APPLE_WORM_VIDEO_TRACED_COUNT,
  appleWormVideoTracedStage,
} from '../packages/games/apple-worm/video-traced-stages.ts';

test('ten source-video stage starts use the traced 21x9 reference grid', () => {
  assert.equal(APPLE_WORM_VIDEO_TRACED_COUNT, 10);
  const expectedBlocks = [12,10,6,18,14,22,17,15,17,25];
  const expectedApples = [0,1,1,1,1,1,1,1,1,1];
  const maps = new Set<string>();
  for(let n=1;n<=10;n++) {
    const stage=appleWormVideoTracedStage(n);
    assert.equal(stage.number,n);
    assert.equal(stage.width,21);
    assert.equal(stage.height,9);
    assert.deepEqual(stage.sourceGridOrigin,[33,73]);
    assert.equal(stage.sourceGridPitch,30);
    assert.equal(stage.rows.length,9);
    assert.ok(stage.rows.every(row=>row.length===21 && /^[.#]+$/.test(row)));
    assert.equal(stage.blocks.length,expectedBlocks[n-1], 'terrain cells stage '+n);
    assert.equal(stage.apples.length,expectedApples[n-1], 'apples stage '+n);
    assert.equal(stage.worm.length,3,'reference worm starts with three sections stage '+n);
    assert.equal(stage.geometryComparedWithSourceFrame,true);
    assert.equal(stage.sourceWinningRouteVerified,false);
    assert.equal(stage.gameplayVerified,false);
    const occupied=new Set(stage.blocks.map(([x,y])=>x+','+y));
    for(const [x,y] of [stage.exit,...stage.apples,...stage.worm]) {
      assert.ok(x>=0 && x<21 && y>=0 && y<9,'out of bounds stage '+n);
      assert.ok(!occupied.has(x+','+y),'object embedded in terrain stage '+n);
    }
    for(let i=1;i<stage.worm.length;i++) {
      const [ax,ay]=stage.worm[i-1]!;
      const [bx,by]=stage.worm[i]!;
      assert.equal(Math.abs(ax-bx)+Math.abs(ay-by),1,'worm not connected stage '+n);
    }
    maps.add(stage.rows.join('/'));
  }
  assert.equal(maps.size,10);
  assert.throws(()=>appleWormVideoTracedStage(0),RangeError);
  assert.throws(()=>appleWormVideoTracedStage(11),RangeError);
});

test('source stage-specific geometry is not silently replaced with old fake corridors',()=>{
  const first=appleWormVideoTracedStage(1);
  assert.equal(first.apples.length,0,'original stage 1 has no apple');
  assert.deepEqual(first.worm,[[5,4],[4,4],[4,5]], 'original starting L bend');
  assert.deepEqual(first.exit,[14,4]);
  assert.equal(first.rows[4]![9],'#','raised two-cell step');
  assert.equal(first.rows[4]![10],'#');
  assert.equal(first.rows[5]![5],'#');
  const third=appleWormVideoTracedStage(3);
  assert.deepEqual(third.apples,[[10,3]]);
  assert.equal(third.rows[5]![9],'.','gap between disconnected starter platforms');
  assert.equal(third.rows[5]![12],'#');
  const sixth=appleWormVideoTracedStage(6);
  assert.deepEqual(sixth.exit,[15,0], 'floating off-ground spiral source exit');
  const eighth=appleWormVideoTracedStage(8);
  assert.deepEqual(eighth.exit,[15,7], 'source portal below the right-hand platform');
  assert.equal(appleWormVideoTracedStage(10).apples.length,1);
  assert.equal(appleWormVideoTracedStage(10).rows[0]![10],'#');
  assert.equal(appleWormVideoTracedStage(10).rows[0]![11],'#');
});
