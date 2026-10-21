import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  APPLE_WORM_SCREENSHOT_LEVEL_COUNT,
  screenshotWormLevel,
} from '../packages/games/apple-worm/screenshot-game.ts';
import {
  solveAppleWormLevel,
  replayAppleWormRoute,
} from '../packages/games/apple-worm/solvability.ts';

/**
 * Integration audit against the *actual* NAQLA 105-level engine and the
 * current FULL-VIDEO source, not the 40-level prototype or legacy clip routes.
 *
 * A successful BFS discovery is replayed from an untouched level state, step
 * by step. Exceeding time/state budgets is UNKNOWN, not "unwinnable".
 *
 * THIS AUDIT CANNOT by itself prove 105/105 original-video route parity.
 * The output deliberately reports all unproven levels rather than masking them.
 */
test('Apple Worm 105-level production-engine solvability report', {timeout:120000},()=>{
  assert.equal(APPLE_WORM_SCREENSHOT_LEVEL_COUNT,105);
  const rows=[] as Array<{
    n:number;status:string;route:string|null;steps:number|null;
    explored:number;portal:readonly[number,number]|null;exitMode:string;issues:string[];
  }>;
  for(let n=1;n<=105;n++){
    const stage=screenshotWormLevel(n);
    const result=solveAppleWormLevel(n,{maxStates:3600,maxMillis:260,source:'full-video'});
    assert.equal(result.level,n);
    if(result.status==='won'){
      assert.ok(result.route&&result.route.length>0,'missing win route for '+n);
      const replay=replayAppleWormRoute(n,result.route!,{source:'full-video'});
      assert.equal(replay.legalMoves,result.route!.length,'blocked source move L'+n);
      assert.equal(replay.won,true,'no true engine win L'+n);
      assert.equal(replay.state.phase,'won','not won L'+n);
      if(stage.exitMode==='top-boundary')
        assert.equal(replay.state.body[0]![1],-3,'did not leave top of screen L'+n);
      else assert.deepEqual(replay.state.body[0],stage.portal,'not at portal L'+n);
    }
    rows.push({n,status:result.status,route:result.route?.map(d=>({up:'U',right:'R',down:'D',left:'L'})[d]).join('')??null,
      steps:result.routeLength,explored:result.explored,portal:stage.portal,
      exitMode:stage.exitMode,issues:[...stage.issues].filter(s=>s.includes('unresolved'))});
    if(n%15===0)console.log('APPLE_WORM_105_AUDIT_BATCH='+JSON.stringify(rows.slice(-15)));
  }
  const tally=Object.fromEntries(['won','missing-exit','exhausted','budget'].map(status=>
    [status,rows.filter(row=>row.status===status).length]));
  console.log('APPLE_WORM_105_AUDIT_SUMMARY='+JSON.stringify({
    source:'full-video',total:105,tally,
    proven:rows.filter(r=>r.status==='won').map(r=>r.n),
    missingExit:rows.filter(r=>r.status==='missing-exit').map(r=>r.n),
    exhausted:rows.filter(r=>r.status==='exhausted').map(r=>r.n),
    budgetUnknown:rows.filter(r=>r.status==='budget').map(r=>r.n),
  }));
  assert.equal(rows.length,105);
  assert.equal(Object.values(tally).reduce((a,b)=>a+b,0),105);
});
