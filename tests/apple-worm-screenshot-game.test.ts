import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appleWormVisualSnapshot} from '../packages/games/apple-worm/video-visual-snapshots-105.ts';
import {
  APPLE_WORM_SCREENSHOT_LEVEL_COUNT,
  SCREENSHOT_DIRECTIONS, screenshotWormLevel,
  startScreenshotWorm, moveScreenshotWorm, restoreScreenshotWorm,
} from '../packages/games/apple-worm/screenshot-game.ts';

const key=([x,y]:readonly[number,number])=>x+','+y;
test('all 105 source snapshots load as actual gameplay geometry with zero invented objects',()=>{
  assert.equal(APPLE_WORM_SCREENSHOT_LEVEL_COUNT,105);
  let motionCapable=0,unresolvedPortals=0;
  for(let level=1;level<=105;level++){
    const source=appleWormVisualSnapshot(level);
    const board=screenshotWormLevel(level);
    const state=startScreenshotWorm(level);
    assert.equal(board.number,level);
    assert.equal(board.width,21);
    assert.equal(board.height,9);
    assert.deepEqual(board.rows,source.terrain);
    assert.deepEqual(board.apples,source.applesVisible);
    assert.deepEqual(board.grayObjects,source.grayObjectsVisible);
    assert.deepEqual(board.portal,source.probablePortal);
    assert.deepEqual(state.collected,[]);
    assert.equal(state.moves,0);
    assert.equal(state.phase,'playing');
    assert.equal(board.sourceGeometry,'screenshot');
    assert.equal(board.exactPhysicsVerified,false);
    assert.equal(board.exactVisualComparisonPassed,false);
    assert.deepEqual(new Set(state.body.map(key)),new Set(source.wormVisible.map(key)));
    if(board.canMove) motionCapable++;
    if(!board.portal)unresolvedPortals++;
    for(const dir of SCREENSHOT_DIRECTIONS){
      const result=moveScreenshotWorm(state,dir);
      assert.equal(result.level,level);
      assert.ok(result.moves===0||result.moves===1);
      assert.ok(['playing','lost','won'].includes(result.phase));
      assert.deepEqual(state.body,startScreenshotWorm(level).body,
        'never mutate original snapshot initial pose');
    }
  }
  assert.ok(motionCapable>=90,'the archive should support motion for most distinct worm shapes');
  assert.ok(unresolvedPortals>0,'must not fill missing portals with invented exits');
  assert.throws(()=>screenshotWormLevel(0),RangeError);
  assert.throws(()=>screenshotWormLevel(106),RangeError);
});
test('post-apple stage 2 stays exactly as pictured, no phantom apples',()=>{
  const board=screenshotWormLevel(2);
  assert.equal(board.apples.length,0);
  assert.equal(board.issues.includes('no-apples-visible-in-frame'),true);
  assert.equal(startScreenshotWorm(2).body.length,board.worm.length);
});
test('stage 48 retains all visible apples and all six gray unknown objects',()=>{
  const map=screenshotWormLevel(48);
  assert.equal(map.apples.length,4);
  assert.equal(map.grayObjects.length,6);
  assert.ok(map.issues.includes('gray-object-mechanics-unresolved'));
});
test('stage 101 does not invent a portal for an image showing many apples',()=>{
  const map=screenshotWormLevel(101);
  assert.equal(map.apples.length,12);
  assert.equal(map.portal,null);
  assert.ok(map.issues.includes('portal-unresolved'));
});
test('state restoration validates source levels, coordinates and collected indexes',()=>{
  const initial=startScreenshotWorm(1);
  assert.deepEqual(restoreScreenshotWorm(initial),initial);
  assert.equal(restoreScreenshotWorm({...initial,level:106}),null);
  assert.equal(restoreScreenshotWorm({...initial,collected:[0]}),null);
  assert.equal(restoreScreenshotWorm({...initial,body:[[999,5]]}),null);
  assert.equal(restoreScreenshotWorm({...initial,phase:'won'}),null);
});

test('screenshot stage 1 has an actual playable route on provisional rules',()=>{
  const level=screenshotWormLevel(1);
  assert.equal(level.apples.length,0);
  assert.deepEqual(level.portal,[14,4]);
  let current=startScreenshotWorm(1);
  // Real source image includes a two-block obstacle above the long floor:
  // crossing it needs a climb, not nine straight moves.
  const route=['right','right','right','up','right','right','right',
    'down','right','right','right'] as const;
  for(const direction of route){
    const next=moveScreenshotWorm(current,direction);
    assert.notEqual(next,current,'unexpected blocked source map move: '+direction);
    current=next;
  }
  assert.equal(current.phase,'won','screenshot stage 1 reaches pictured portal');
  assert.deepEqual(current.body[0],[14,4]);
  assert.deepEqual(current.collected,[]);
  assert.deepEqual(restoreScreenshotWorm(current),current);
});
