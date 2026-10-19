import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BATCH_TWO_15,APPLE_WORM_VIDEO_BATCH_TWO_STARTS,
} from '../packages/games/apple-worm/video-start-poses-batch-2.ts';
import { APPLE_WORM_VIDEO_START_POSES } from '../packages/games/apple-worm/video-start-poses-selected-33.ts';
import {
  screenshotWormLevel,startScreenshotWorm,SCREENSHOT_DIRECTIONS,moveScreenshotWorm,
} from '../packages/games/apple-worm/screenshot-game.ts';
import {
  solveAppleWormLevel,replayAppleWormRoute,
} from '../packages/games/apple-worm/solvability.ts';

const key=(p:readonly[number,number])=>p[0]+','+p[1];

test('second batch contains precisely the 15 agreed stages with no overlap with first batch',()=>{
  assert.deepEqual([...BATCH_TWO_15],
    [39,40,42,44,49,51,58,59,71,72,73,76,86,96,97]);
  assert.equal(Object.keys(APPLE_WORM_VIDEO_BATCH_TWO_STARTS).length,15);
  for(const n of BATCH_TWO_15){
    assert.ok(APPLE_WORM_VIDEO_BATCH_TWO_STARTS[n]);
    assert.equal(APPLE_WORM_VIDEO_START_POSES[n],undefined,
      'do not overwrite any already verified first-batch start');
  }
  for(const n of Object.keys(APPLE_WORM_VIDEO_START_POSES).map(Number))
    assert.ok(!BATCH_TWO_15.includes(n as typeof BATCH_TWO_15[number]));
});

test('each filmed second-batch worm pose is connected and avoids every approved terrain brick',()=>{
  for(const level of BATCH_TWO_15){
    const reference=APPLE_WORM_VIDEO_BATCH_TWO_STARTS[level]!;
    const stage=screenshotWormLevel(level),state=startScreenshotWorm(level);
    assert.deepEqual(state.body,reference.headToTail);
    assert.equal(stage.portal!==null,true,'known level '+level+' must retain exit');
    assert.equal(stage.canMove,true);
    assert.equal(stage.issues.includes('video-clip-start-reconstructed'),true);
    const occupied=new Set(state.body.map(key));
    assert.equal(occupied.size,state.body.length,
      'duplicate worm cells on level '+level);
    for(let i=0;i<state.body.length;i++){
      const [x,y]=state.body[i]!;
      assert.ok(x>=0&&x<21&&y>=-2&&y<=9);
      if(y>=0&&y<9)assert.equal(stage.rows[y]![x],'.',
        'video body must not stand inside approved ground on stage '+level);
      if(i>0){
        const [px,py]=state.body[i-1]!;
        assert.equal(Math.abs(px-x)+Math.abs(py-y),1,
          'source worm must be connected on stage '+level);
      }
    }
    for(const d of SCREENSHOT_DIRECTIONS){
      const next=moveScreenshotWorm(state,d);
      assert.equal(next.level,level);
      assert.ok(next.moves===0||next.moves===1);
    }
  }
});

test('initial complete second-batch search truthfully logs win proofs and current-engine blockers',()=>{
  const results=BATCH_TWO_15.map(level=>
    solveAppleWormLevel(level,{maxStates:15000,maxMillis:550}));
  const proven:number[]=[],blocked:number[]=[],unresolved:number[]=[];
  for(const result of results){
    if(result.status==='won'){
      assert.ok(result.route);
      const verified=replayAppleWormRoute(result.level,result.route);
      assert.equal(verified.won,true);
      assert.equal(verified.legalMoves,result.route.length);
      proven.push(result.level);
    }else if(result.status==='exhausted'||result.status==='missing-exit'){
      blocked.push(result.level);
    }else unresolved.push(result.level);
  }
  console.log('APPLE_WORM_VIDEO_BATCH_2_JSON='+JSON.stringify({
    batch:2,levels:[...BATCH_TWO_15],proven,blocked,unresolved,
    results:results.map(r=>({
      level:r.level,status:r.status,explored:r.explored,
      route:r.route?.join(',')??null,moves:r.routeLength,
    })),
  }));
  assert.equal(results.length,15);
});
