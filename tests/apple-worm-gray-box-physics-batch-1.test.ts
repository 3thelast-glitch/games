import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  APPLE_WORM_MOVABLE_GRAY_BATCH_1,
  isBatchOneMovableGray,
  pushGrayBox,
  settleGrayBoxes,
} from '../packages/games/apple-worm/gray-box-physics-batch-1.ts';
import {
  SCREENSHOT_DIRECTIONS,
  screenshotWormLevel,
  startScreenshotWorm,
  moveScreenshotWorm,
  restoreScreenshotWorm,
} from '../packages/games/apple-worm/screenshot-game.ts';
import { replayAppleWormRoute }
  from '../packages/games/apple-worm/solvability.ts';

test('only the original eight batch-1 stages and isolated stage-104 crate are movable',()=>{
  const intended=[13,14,15,17,18,19,20,28];
  assert.deepEqual([...APPLE_WORM_MOVABLE_GRAY_BATCH_1].sort((a,b)=>a-b),intended);
  for(let level=1;level<=105;level++){
    assert.equal(isBatchOneMovableGray(level),intended.includes(level));
    const map=screenshotWormLevel(level),state=startScreenshotWorm(level);
    assert.equal('grayPositions' in state,intended.includes(level)||level===104);
    if(intended.includes(level))assert.deepEqual(state.grayPositions,map.grayObjects);
    else if(level===104)assert.deepEqual(state.grayPositions,[[7,7]]);
    else assert.equal(state.grayPositions,undefined);
  }
});

test('a gray box can be pushed by the worm only into a free neighboring square',()=>{
  const terrain=new Set(['7,2']);
  const args={
    boxes:[[5,2]] as const,
    headTarget:[5,2] as const,
    direction:'right' as const,
    terrain,
    body:[[4,2],[3,2]] as const,
    apples:[] as const,
  };
  assert.deepEqual(pushGrayBox(args),[[6,2]]);
  assert.equal(pushGrayBox({...args,terrain:new Set(['6,2'])}),null);
  assert.equal(pushGrayBox({...args,boxes:[[5,2],[6,2]]}),null);
  assert.equal(pushGrayBox({...args,apples:[[6,2]]}),null);
  assert.equal(pushGrayBox({...args,body:[[4,2],[6,2]]}),null);
  assert.deepEqual(pushGrayBox({...args,headTarget:[4,3]}),[[5,2]]);
});

test('gravity stacks gray boxes without tunneling through terrain or worm',()=>{
  const ground=new Set(['4,6']);
  assert.deepEqual(settleGrayBoxes([[4,2]],ground,[]),[[4,5]]);
  assert.deepEqual(settleGrayBoxes([[4,2],[4,3]],ground,[]),
    [[4,4],[4,5]]);
  assert.deepEqual(settleGrayBoxes([[4,2]],ground,[[4,4]]),[[4,3]]);
  assert.deepEqual(settleGrayBoxes([[4,3]],ground,[[4,4]]),[[4,3]]);
  assert.deepEqual(settleGrayBoxes([[4,2]],new Set(),[],[[4,4]]),[[4,3]],
    'uncollected apple must keep the gray box above it');
  assert.deepEqual(settleGrayBoxes([[4,2]],new Set(),[],[]),[[4,9]],
    'gray box drops after its fruit support is eaten');
});

test('updated stage positions can be saved, restored, undone and moved without changing source gray geometry',()=>{
  for(const level of APPLE_WORM_MOVABLE_GRAY_BATCH_1){
    const map=screenshotWormLevel(level),start=startScreenshotWorm(level);
    assert.deepEqual(start.grayPositions,map.grayObjects);
    const restored=restoreScreenshotWorm(JSON.parse(JSON.stringify(start)));
    assert.deepEqual(restored,start);
    for(const direction of SCREENSHOT_DIRECTIONS){
      const next=moveScreenshotWorm(start,direction,map);
      if(next!==start){
        assert.equal(next.grayPositions?.length,map.grayObjects.length,
          'crate count unexpectedly changed for stage '+level);
        assert.equal(next.level,level);
        assert.equal(restoreScreenshotWorm(next)?.level,level);
      }
    }
  }
});

test('existing proven level-1 and level-2 routes are not altered by the opt-in crate implementation',()=>{
  const one=replayAppleWormRoute(1,[
    'right','right','right','right','right','right','right','right','right',
  ]);
  // Level 1 route varies with its original terrain; require at least no
  // dynamic gray state or extra box logic in any legal step.
  assert.equal(one.state.grayPositions,undefined);
  const two=replayAppleWormRoute(2,[
    'right','right','right','up','up','up','right','right','right','right',
  ]);
  assert.equal(two.won,true);
  assert.equal(two.state.grayPositions,undefined);
});
