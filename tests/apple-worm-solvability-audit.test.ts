import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCREENSHOT_DIRECTIONS,
  screenshotWormLevel,
  startScreenshotWorm,
  moveScreenshotWorm,
} from '../packages/games/apple-worm/screenshot-game.ts';
import {
  auditAppleWormLevels,
  solveAppleWormLevel,
  replayAppleWormRoute,
} from '../packages/games/apple-worm/solvability.ts';

test('fast solver context has exactly the same initial moves as the public engine for every stage',()=>{
  for(let level=1;level<=105;level++){
    const board=screenshotWormLevel(level),state=startScreenshotWorm(level);
    for(const direction of SCREENSHOT_DIRECTIONS){
      assert.deepEqual(moveScreenshotWorm(state,direction,board),
        moveScreenshotWorm(state,direction),
        'Context must not change motion on level '+level+' direction '+direction);
    }
    assert.deepEqual(state,startScreenshotWorm(level));
  }
});

test('automated solvability audit covers ALL 105 levels and never calls budget failures impossible',()=>{
  const results=auditAppleWormLevels(1,105,{maxStates:9000,maxMillis:350});
  assert.equal(results.length,105);
  assert.deepEqual(results.map(x=>x.level),
    Array.from({length:105},(_,i)=>i+1));
  const counts={won:0,missingExit:0,exhausted:0,budget:0};
  for(const r of results){
    if(r.status==='won'){
      counts.won++;
      assert.ok(r.route&&r.route.length>0);
      const replay=replayAppleWormRoute(r.level,r.route);
      assert.equal(replay.won,true,'route must really win Stage '+r.level);
      assert.equal(replay.legalMoves,r.route.length);
      assert.deepEqual(replay.state.body[0],screenshotWormLevel(r.level).portal);
    }else if(r.status==='missing-exit')counts.missingExit++;
    else if(r.status==='exhausted')counts.exhausted++;
    else counts.budget++;
  }
  assert.equal(results.find(r=>r.level===1)?.status,'won');
  assert.equal(results.find(r=>r.level===2)?.status,'won');
  assert.equal(counts.missingExit,3,'do not fabricate source exits for 70, 95, 101');
  assert.deepEqual(results.filter(r=>r.status==='missing-exit').map(r=>r.level),
    [70,95,101]);
  const batches=Array.from({length:7},(_,i)=>{
    const rows=results.slice(i*15,(i+1)*15);
    return {
      range:(i*15+1)+'-'+((i+1)*15),
      won:rows.filter(r=>r.status==='won').map(r=>r.level),
      missingExit:rows.filter(r=>r.status==='missing-exit').map(r=>r.level),
      exhausted:rows.filter(r=>r.status==='exhausted').map(r=>r.level),
      budget:rows.filter(r=>r.status==='budget').map(r=>r.level),
    };
  });
  // Single JSON line is intentionally machine-readable from the GitHub
  // Actions log, allowing a precise per-level report without inventing data.
  console.log('APPLE_WORM_SOLVABILITY_105_JSON='+JSON.stringify({
    schema:1,engine:'current-provisional-screenshot-game',
    capPerLevel:9000,maxMillisPerLevel:350,counts,batches,
    results:results.map(r=>({
      level:r.level,status:r.status,explored:r.explored,
      discovered:r.discovered,route:r.route?.join(',')??null,
      moves:r.routeLength,
    })),
  }));
});

test('deeper solver pass on 8 inconclusive late stages before calling them unsolved',()=>{
  const levels=[80,81,83,84,88,93,94,100];
  const results=levels.map(level=>solveAppleWormLevel(level,{
    maxStates:160000,maxMillis:2400,
  }));
  assert.deepEqual(results.map(r=>r.level),levels);
  for(const r of results){
    if(r.status==='won'){
      assert.ok(r.route);
      assert.equal(replayAppleWormRoute(r.level,r.route).won,true);
    }
  }
  console.log('APPLE_WORM_DEEP_AUDIT_JSON='+JSON.stringify({
    capPerStage:160000,maxMillisPerStage:2400,
    results:results.map(r=>({
      level:r.level,status:r.status,
      explored:r.explored,discovered:r.discovered,
      moves:r.routeLength,route:r.route?.join(',')??null,
    })),
  }));
});

test('diagnose source-stage reachability defects without editing any screenshot layout',()=>{
  const exhausted=[5,7,8,9,12,13,14,15,17,18,19,20,28,30,34,39,40,42,44,
    49,51,58,59,71,72,73,76,86,96,97,98,104,105];
  const rows=exhausted.map(level=>{
    const map=screenshotWormLevel(level);
    const initial=startScreenshotWorm(level);
    const head=initial.body[0]!;
    const cell=(p:readonly[number,number])=>p[0]+','+p[1];
    const land=new Set<string>();
    map.rows.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='#')land.add(cell([x,y]));}));
    const gray=new Set(map.grayObjects.map(cell));
    const headKey=cell(head),portalKey=map.portal?cell(map.portal):null;
    const initialTransitions=SCREENSHOT_DIRECTIONS.map(direction=>
      moveScreenshotWorm(initial,direction,map));
    const legal=initialTransitions.filter(s=>s!==initial);
    const loss=legal.filter(s=>s.phase==='lost');
    const portalBlockedByLand=!!portalKey&&land.has(portalKey);
    const portalBlockedByGray=!!portalKey&&gray.has(portalKey);
    const wormBodyOnLand=initial.body.filter(p=>land.has(cell(p))).length;
    const wormBodyOnGray=initial.body.filter(p=>gray.has(cell(p))).length;
    return {level,initialHead:head,portal:map.portal,
      legalFirstMoves:legal.length,firstMoveLosses:loss.length,
      portalBlockedByLand,portalBlockedByGray,
      wormBodyOnLand,wormBodyOnGray,
      apples:map.apples.length,grayObjects:map.grayObjects.length};
  });
  console.log('APPLE_WORM_BLOCKED_DIAG_JSON='+JSON.stringify(rows));
  assert.equal(rows.length,33);
});
