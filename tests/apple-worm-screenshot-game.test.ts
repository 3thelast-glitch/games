import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appleWormVisualSnapshot} from '../packages/games/apple-worm/video-visual-snapshots-105.ts';
import {appleWormVideoTracedStage} from '../packages/games/apple-worm/video-traced-stages.ts';
import {APPLE_WORM_VIDEO_START_POSES, VIDEO_AUDIT_REQUESTED_33} from '../packages/games/apple-worm/video-start-poses-selected-33.ts';
import {APPLE_WORM_VIDEO_BATCH_TWO_STARTS} from '../packages/games/apple-worm/video-start-poses-batch-2.ts';
import {APPLE_WORM_VIDEO_BATCH_THREE_STARTS} from '../packages/games/apple-worm/video-start-poses-batch-3.ts';
import {APPLE_WORM_FULL_VIDEO_EARLY_POSES} from '../packages/games/apple-worm/full-video-early-poses-105.ts';
import {APPLE_WORM_FULL_VIDEO_VISIBLE_APPLES} from '../packages/games/apple-worm/full-video-early-apples-105.ts';
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
    const video=APPLE_WORM_VIDEO_START_POSES[level]??APPLE_WORM_VIDEO_BATCH_TWO_STARTS[level]??
      APPLE_WORM_VIDEO_BATCH_THREE_STARTS[level];
    const earlyBody=APPLE_WORM_FULL_VIDEO_EARLY_POSES[level];
    const earlyApples=APPLE_WORM_FULL_VIDEO_VISIBLE_APPLES[level];
    assert.deepEqual(board.apples,earlyApples??(video?.extraInitialApples
      ?[...source.applesVisible,...video.extraInitialApples]:source.applesVisible));
    assert.deepEqual(board.grayObjects,video?.grayStartOverride??source.grayObjectsVisible);
    assert.deepEqual(board.portal,source.probablePortal??
      (level<=10?appleWormVideoTracedStage(level).exit:null));
    assert.deepEqual(state.collected,[]);
    assert.equal(state.moves,0);
    assert.equal(state.phase,'playing');
    assert.equal(board.sourceGeometry,'screenshot');
    assert.equal(board.referenceFrameApproved,true);
    assert.equal(board.exactPhysicsVerified,false);
    assert.equal(board.exactVisualComparisonPassed,false);
    if(earlyBody)assert.deepEqual(state.body,earlyBody.headToTail,
      'full walkthrough worm head wins over mid-play screenshots on '+level);
    if(video&&!earlyBody){
      assert.deepEqual(state.body,video.headToTail);
      assert.equal(board.issues.includes('video-clip-start-reconstructed'),true);
    }
    if(!video&&!earlyBody)assert.deepEqual(new Set(state.body.map(key)),
      new Set(source.wormVisible.map(key)));
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
  assert.equal(motionCapable,105,'all PDF screenshot worms must have an ordered visible pose');
  assert.equal(unresolvedPortals,3,'keep unsighted exits unresolved instead of inventing them');
  assert.deepEqual(screenshotWormLevel(2).portal,[13,2]);
  assert.deepEqual(screenshotWormLevel(4).portal,[14,1]);
  assert.throws(()=>screenshotWormLevel(0),RangeError);
  assert.throws(()=>screenshotWormLevel(106),RangeError);
});
test('stage 2 uses the full walkthrough untouched apple and early three-cell worm',()=>{
  const board=screenshotWormLevel(2);
  assert.deepEqual(board.apples,[[6,3]]);
  assert.equal(board.issues.includes('full-video-early-apples-visible'),true);
  assert.equal(startScreenshotWorm(2).body.length,board.worm.length);
  assert.deepEqual(board.worm,[[7,5],[6,5],[6,6]], 'head follows mouth in full stage opening');
  assert.deepEqual(board.portal,[13,2], 'exit sits above right-side platform');
});
test('stage 48 uses five early apples and retains six gray unknown objects',()=>{
  const map=screenshotWormLevel(48);
  assert.equal(map.apples.length,5);
  assert.equal(map.grayObjects.length,6);
  assert.ok(map.issues.includes('gray-object-mechanics-unresolved'));
});
test('stage 101 does not treat video UI icons as a source portal',()=>{
  const map=screenshotWormLevel(101);
  assert.equal(map.apples.length,12);
  assert.equal(map.portal,null);
  assert.ok(map.issues.includes('portal-unresolved'));
  assert.equal(map.exactVisualComparisonPassed,false);
});
test('video-refined 59 and still-image worms 91 and 95 are movable',()=>{
  const expectedHeads:[[number,number],number][]=[[[10,-1],59],[[11,-1],91],[[9,7],95]];
  for(const [head,level] of expectedHeads){
    const board=screenshotWormLevel(level);
    assert.equal(board.canMove,true,'PDF worm must be playable on level '+level);
    assert.deepEqual(board.worm[0],head);
    const state=startScreenshotWorm(level);
    assert.deepEqual(state.body[0],head);
  }
});
test('overlapping U-shaped worms remain ordered and movable on levels 80 and 99',()=>{
  const expected=new Map<number,readonly (readonly[number,number])[]>([
    [80,[[10,5],[10,6],[10,7]]],
    [99,[[6,3],[7,3],[7,4],[7,5]]],
  ]);
  for(const [n,body] of expected){
    const level=screenshotWormLevel(n);
    assert.equal(level.canMove,true);
    assert.deepEqual(level.worm,body);
    assert.deepEqual(startScreenshotWorm(n).body,body);
  }
});
test('exit candidates on the bottom source-image edge remain addressable',()=>{
  for(const n of [73,100]){
    const board=screenshotWormLevel(n);
    assert.deepEqual(board.portal,[6,9]);
    assert.ok(board.issues.includes('portal-below-terrain-grid'));
    assert.equal(board.height,9);
  }
});
test('entering the bottom-edge portal counts as winning, without eating any fruit',()=>{
  for(const level of [73,100]){
    const near={...startScreenshotWorm(level),body:[[5,9],[4,9]] as const,collected:[] as number[]};
    const reached=moveScreenshotWorm(near,'right');
    assert.notEqual(reached,near);
    assert.equal(reached.phase,'won', 'bottom-edge exit must be usable for level '+level);
    assert.deepEqual(reached.body[0],[6,9]);
    assert.deepEqual(reached.collected,[]);
    assert.deepEqual(restoreScreenshotWorm(reached),reached);
  }
});

test('state restoration validates source levels, coordinates and collected indexes',()=>{
  const initial=startScreenshotWorm(1);
  assert.deepEqual(restoreScreenshotWorm(initial),initial);
  assert.equal(restoreScreenshotWorm({...initial,level:106}),null);
  assert.equal(restoreScreenshotWorm({...initial,collected:[0]}),null);
  assert.equal(restoreScreenshotWorm({...initial,body:[[999,5]]}),null);
  assert.equal(restoreScreenshotWorm({...initial,phase:'won'}),null);
});

test('a source portal wins even when its apple has not been collected',()=>{
  const initial=startScreenshotWorm(3);
  const board=screenshotWormLevel(3);
  assert.deepEqual(board.portal,[14,4]);
  assert.ok(board.apples.length>0);
  const near={...initial,body:[[13,4],[12,4],[11,4]] as const,collected:[] as number[]};
  const next=moveScreenshotWorm(near,'right');
  assert.notEqual(next,near);
  assert.equal(next.phase,'won');
  assert.deepEqual(next.collected,[]);
  assert.deepEqual(restoreScreenshotWorm(next),next);
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

test('historical post-apple stage-2 fixture still replays its own route, without masking full-video fruit',()=>{
  const board=screenshotWormLevel(2,'legacy');
  assert.equal(board.apples.length,0,'the supplied Level 002 frame shows no apple');
  assert.deepEqual(board.portal,[13,2]);
  const moves=['right','right','right','up','up','up',
    'right','right','right','right'] as const;
  let state=startScreenshotWorm(2,'legacy');
  for(const direction of moves){
    const next=moveScreenshotWorm(state,direction,board);
    assert.notEqual(next,state,'blocked Level 002 move: '+direction);
    state=next;
  }
  assert.equal(state.phase,'won');
  assert.deepEqual(state.body[0],board.portal);
  assert.deepEqual(state.collected,[]);
});

test('historical selected-33 clip poses remain available in legacy regression fixtures',()=>{
  const levels=[5,7,8,9,12,13,14,15,17,18,19,20,28,30,34];
  const restored=levels.map(level=>{
    const record=APPLE_WORM_VIDEO_START_POSES[level]!;
    const stage=screenshotWormLevel(level,'legacy');
    assert.deepEqual(stage.worm,record.headToTail);
    assert.equal(stage.portal!==null,true);
    assert.equal(stage.canMove,true);
    const unique=new Set(stage.worm.map(key));
    assert.equal(unique.size,stage.worm.length);
    for(let i=1;i<stage.worm.length;i++){
      const a=stage.worm[i-1]!,b=stage.worm[i]!;
      assert.equal(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]),1);
    }
    stage.worm.forEach(([x,y])=>{
      assert.ok(x>=0&&x<21&&y>=-2&&y<=9);
      if(y>=0&&y<9)assert.equal(stage.rows[y]![x],'.',
        'filmed body must not overlap existing terrain on stage '+level);
    });
    return {level,length:stage.worm.length};
  });
  assert.deepEqual(restored,[
    {level:5,length:4},
    {level:7,length:3},
    {level:8,length:3},
    {level:9,length:4},
    {level:12,length:3},
    {level:13,length:3},
    {level:14,length:3},
    {level:15,length:3},
    {level:17,length:3},
    {level:18,length:3},
    {level:19,length:4},
    {level:20,length:3},
    {level:28,length:3},
    {level:30,length:3},
    {level:34,length:3},
  ]);
  assert.equal(VIDEO_AUDIT_REQUESTED_33.length,33);
  assert.deepEqual(screenshotWormLevel(30,'legacy').apples.length,5);
  assert.deepEqual(screenshotWormLevel(30,'legacy').grayObjects,[[9,5],[10,7]]);
  assert.deepEqual(screenshotWormLevel(12,'legacy').grayObjects,[[10,4]]);
  console.log('APPLE_WORM_SOURCE_VIDEO_START_CORRECTIONS='+JSON.stringify(restored));
});
