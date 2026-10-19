import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APPLE_WORM_VIDEO_START_POSES, VIDEO_AUDIT_REQUESTED_33 }
  from '../packages/games/apple-worm/video-start-poses-selected-33.ts';
import { screenshotWormLevel }
  from '../packages/games/apple-worm/screenshot-game.ts';
import { solveAppleWormLevel, replayAppleWormRoute }
  from '../packages/games/apple-worm/solvability.ts';

export const FIRST_VIDEO_BATCH_15=[
  5,7,8,9,12,13,14,15,17,18,19,20,28,30,34,
] as const;

test('batch 1 contains EXACTLY the first 15 selected stages; no cross-batch source overrides',()=>{
  assert.equal(VIDEO_AUDIT_REQUESTED_33.length,33);
  assert.deepEqual(Object.keys(APPLE_WORM_VIDEO_START_POSES)
    .map(Number).sort((a,b)=>a-b),[...FIRST_VIDEO_BATCH_15].sort((a,b)=>a-b));
});

test('batch 1: record all 15 actual engine win paths without falsely certifying the remaining eight',()=>{
  const results=FIRST_VIDEO_BATCH_15.map(level=>
    solveAppleWormLevel(level,{maxStates:12000,maxMillis:450}));
  const won=results.filter(r=>r.status==='won').map(r=>r.level);
  const currentDefects=results.filter(r=>r.status!=='won').map(r=>r.level);
  for(const r of results){
    if(r.status!=='won')continue;
    assert.ok(r.route);
    const completed=replayAppleWormRoute(r.level,r.route);
    assert.equal(completed.won,true,
      'the stage must replay to a genuine in-game win: '+r.level);
  }
  // Those seven routes have been independently replayed. Do not regress them.
  for(const level of [5,7,8,9,12,30,34])
    assert.ok(won.includes(level),'previously verified win regressed: '+level);
  assert.deepEqual(results.map(x=>x.level),[...FIRST_VIDEO_BATCH_15]);
  console.log('APPLE_WORM_VIDEO_BATCH_1_JSON='+JSON.stringify({
    batch:1,stages:[...FIRST_VIDEO_BATCH_15],won,
    needsFix:currentDefects,
    results:results.map(r=>({
      level:r.level,status:r.status,explored:r.explored,
      route:r.route?.join(',')??null,
      length:r.routeLength,
    })),
  }));
});

test('stage 18 blockers in the source video need movable gray-box physics, not fabricated terrain',()=>{
  const level=screenshotWormLevel(18);
  assert.ok(level.grayObjects.length>=2);
  assert.equal(level.exactPhysicsVerified,false,
    'the current gray-object collision model is not source verified');
});
