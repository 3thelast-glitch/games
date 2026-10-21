import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APPLE_WORM_VIDEO_START_POSES, VIDEO_AUDIT_REQUESTED_33 }
  from '../packages/games/apple-worm/video-start-poses-selected-33.ts';
import { screenshotWormLevel }
  from '../packages/games/apple-worm/screenshot-game.ts';
import { solveAppleWormLevel, replayAppleWormRoute }
  from '../packages/games/apple-worm/solvability.ts';
import { FIRST_BATCH_RECOVERED_ROUTES }
  from './apple-worm-video-batch1-recovered-routes.test.ts';

export const FIRST_VIDEO_BATCH_15=[
  5,7,8,9,12,13,14,15,17,18,19,20,28,30,34,
] as const;

test('batch 1 contains EXACTLY the first 15 selected stages; no cross-batch source overrides',()=>{
  assert.equal(VIDEO_AUDIT_REQUESTED_33.length,33);
  assert.deepEqual(Object.keys(APPLE_WORM_VIDEO_START_POSES)
    .map(Number).sort((a,b)=>a-b),[...FIRST_VIDEO_BATCH_15].sort((a,b)=>a-b));
});

test('batch 1: preserve original selected-clip solver certificates, separate from newly lethal full-video saws',()=>{
  const results=FIRST_VIDEO_BATCH_15.map(level=>
    solveAppleWormLevel(level,{maxStates:12000,maxMillis:450,source:'legacy'}));
  // For longer mazes, a deterministic replayable route is as strong a win
  // certificate as BFS, without requiring unlimited CI search resources.
  const verified=results.map(r=>{
    const route=r.status==='won'?r.route:FIRST_BATCH_RECOVERED_ROUTES[r.level];
    const replay=route?replayAppleWormRoute(r.level,route,{source:'legacy'}):null;
    return {level:r.level,route,won:!!replay?.won&&replay.legalMoves===route!.length,
      via:r.status==='won'?'bfs':'source-model-replay'};
  });
  const won=verified.filter(r=>r.won).map(r=>r.level);
  const currentDefects=verified.filter(r=>!r.won).map(r=>r.level);
  for(const r of verified){
    if(r.won){
      assert.ok(r.route);
      assert.ok(r.route.length>0);
    }
  }
  // Those seven routes have been independently replayed. Do not regress them.
  for(const level of [5,7,8,9,12,30,34])
    assert.ok(won.includes(level),'previously verified win regressed: '+level);
  assert.deepEqual(results.map(x=>x.level),[...FIRST_VIDEO_BATCH_15]);
  assert.deepEqual(currentDefects,[],
    'the entire first batch must be genuinely winnable before merge');
  console.log('APPLE_WORM_VIDEO_BATCH_1_JSON='+JSON.stringify({
    batch:1,stages:[...FIRST_VIDEO_BATCH_15],won,
    verified:verified.map(r=>({level:r.level,won:r.won,via:r.via,
      routeLength:r.route?.length??null})),
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
