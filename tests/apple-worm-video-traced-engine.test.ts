import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startVideoWorm,moveVideoWorm,solveVideoWorm,type VideoWormDirection} from
  '../packages/games/apple-worm/video-traced-engine.ts';
import {appleWormVideoTracedStage} from '../packages/games/apple-worm/video-traced-stages.ts';

test('each of the 10 source-traced puzzle geometries admits a route under provisional gravity',()=>{
  for(let n=1;n<=10;n++){
    const stage=appleWormVideoTracedStage(n);
    const path=solveVideoWorm(n);
    assert.ok(path&&path.length>0,'no provisional winning route for stage '+n);
    let state=startVideoWorm(n);
    for(const direction of path as VideoWormDirection[]){
      const after=moveVideoWorm(state,direction);
      assert.notEqual(after,state,'invalid candidate move '+n);
      assert.notEqual(after.phase,'lost','candidate loses on stage '+n);
      state=after;
    }
    assert.equal(state.phase,'won','candidate stage route did not finish '+n);
    assert.equal(state.applesBitmask,(1<<stage.apples.length)-1,'did not collect every apple '+n);
    assert.equal(state.body.length,3+stage.apples.length,
      'growth must persist from three-segment initial body '+n);
  }
});

test('stage 1 is legitimately winnable with no apples',()=>{
  const start=startVideoWorm(1);
  assert.equal(start.applesBitmask,0);
  assert.equal(appleWormVideoTracedStage(1).apples.length,0);
  const route=solveVideoWorm(1);
  assert.ok(route);
  let state=start;
  for(const d of route!)state=moveVideoWorm(state,d);
  assert.equal(state.phase,'won');
  assert.equal(state.body.length,3);
});

test('stage 2 intentional upward apple entry consumes and grows by one segment',()=>{
  // A source-specific state: head one cell below the apple; disconnected or
  // impossible poses are not claimed to be full legal on-video histories.
  const stage=appleWormVideoTracedStage(2);
  const apple=stage.apples[0]!;
  const before={...startVideoWorm(2),
    body:[[apple[0],apple[1]+1],[apple[0]-1,apple[1]+1],[apple[0]-2,apple[1]+1]] as
      [number,number][],
  };
  const after=moveVideoWorm(before,'up');
  assert.notEqual(after,before,'apple should be consumable vertically');
  assert.equal(after.applesBitmask,1);
  assert.equal(after.body.length,4);
});
