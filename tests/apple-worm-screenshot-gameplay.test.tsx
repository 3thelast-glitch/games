import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SCREENSHOT_STAGES, screenshotStage, validateScreenshotStage, type ScreenshotStage } from '../packages/games/apple-worm/screenshot-stages.ts';
import { startScreenshotWorm, moveScreenshotWorm, replayScreenshotWorm, solveScreenshotWorm } from '../packages/games/apple-worm/screenshot-engine.ts';
import { AppleWormScreenshotBoard } from '../apps/mobile/src/AppleWormScreenshotBoard.tsx';

test('all 105 source definitions preserve independently hashed screenshot identities and valid connected bodies',()=>{
  assert.equal(SCREENSHOT_STAGES.length,105);
  assert.equal(new Set(SCREENSHOT_STAGES.map(s=>s.sourceSha256)).size,105);
  for(const stage of SCREENSHOT_STAGES) {
    assert.deepEqual(validateScreenshotStage(stage),[],`stage ${stage.id}`);
    assert.equal(stage.sourceType,'provided-screenshot');
    assert.equal(stage.sourceImage,`stage_${String(stage.id).padStart(3,'0')}.jpg`);
    assert.equal(stage.visualVerification,'pending');
    const state=startScreenshotWorm(stage.id);
    assert.deepEqual(state.body,stage.worm);
    assert.deepEqual(state.boxes,stage.movableObjects);
    assert.deepEqual(startScreenshotWorm(stage.id),state);
    assert.equal(state.moves,0);
    assert.equal(state.eaten,0);
    assert.equal(state.phase,'playing');
  }
  assert.throws(()=>screenshotStage(106),RangeError);
  assert.throws(()=>screenshotStage(1.5),RangeError);
});

test('mid-game screenshots keep eaten fruit absent and their visible bent worm',()=>{
  assert.deepEqual(screenshotStage(1).apples,[]);
  assert.deepEqual(screenshotStage(2).apples,[]);
  assert.deepEqual(screenshotStage(2).worm,[[6,5],[6,6],[7,6],[7,7]]);
  assert.equal(screenshotStage(101).portal,null);
  assert.equal(screenshotStage(101).completionRule,'portal');
});

const fixture=(overrides:Partial<ScreenshotStage>={}):ScreenshotStage=>({
  ...screenshotStage(1),width:10,height:10,terrain:[[1,6],[2,6],[3,6],[4,6],[5,6]],
  worm:[[3,5],[2,5],[1,5]],wormHead:[3,5],apples:[[4,5]],portal:[5,5],
  hazards:[],movableObjects:[],...overrides,
});
test('apple collection grows the permanent worm, preserves input and wins only at the portal',()=>{
  const stage=fixture();const start=startScreenshotWorm(1,stage);
  const original=JSON.stringify(start);
  const eaten=moveScreenshotWorm(start,'right',stage);
  assert.equal(eaten.body.length,4);assert.equal(eaten.eaten,1);assert.equal(eaten.phase,'playing');
  assert.equal(JSON.stringify(start),original);
  assert.equal(moveScreenshotWorm(eaten,'right',stage).phase,'won');
  assert.equal(moveScreenshotWorm(start,'left',stage),start);
  assert.equal(moveScreenshotWorm(start,'down',stage),start);
  const optional=fixture({portal:[4,5],apples:[[8,2]]});
  assert.equal(moveScreenshotWorm(startScreenshotWorm(1,optional),'right',optional).phase,'won');
});
test('gravity checks every falling cell for hazards and fall losses',()=>{
  const stage=fixture({terrain:[],apples:[],hazards:[{kind:'saw',position:[4,7]}]});
  const start=startScreenshotWorm(1,stage);
  assert.equal(start.body[0]![1],5,'initial screenshot must not settle');
  const dead=moveScreenshotWorm(start,'right',stage);
  assert.equal(dead.phase,'lost');assert.equal(dead.loss,'hazard');assert.equal(dead.body[0]![1],7);
  const empty=fixture({terrain:[],apples:[]});
  assert.equal(moveScreenshotWorm(startScreenshotWorm(1,empty),'up',empty).loss,'fall');
});
test('boxes can be pushed, settle with gravity, and cannot be pushed through a wall or the worm',()=>{
  const stage=fixture({apples:[],portal:[9,1],movableObjects:[[4,5]]});
  const start=startScreenshotWorm(1,stage);
  const pushed=moveScreenshotWorm(start,'right',stage);
  assert.deepEqual(pushed.boxes,[[5,5]]);
  assert.deepEqual(start.boxes,[[4,5]]);
  const blocked=fixture({apples:[],movableObjects:[[4,5]],terrain:[...stage.terrain,[5,5]]});
  const prior=startScreenshotWorm(1,blocked);
  assert.equal(moveScreenshotWorm(prior,'right',blocked),prior);
});
test('replay validates saved input and reproduces deterministic solver wins',()=>{
  for(const level of [1,2,3,11,16,21,31,37,98,104]) {
    const result=solveScreenshotWorm(level,100000);
    assert.equal(result.status,'solved',`stage ${level}`);
    const final=replayScreenshotWorm(level,result.route);
    assert.equal(final?.phase,'won');
    assert.deepEqual(replayScreenshotWorm(level,result.route),final);
  }
  assert.equal(replayScreenshotWorm(1,['teleport']),null);
  assert.equal(replayScreenshotWorm(1,{phase:'won'}),null);
  assert.equal(replayScreenshotWorm(1,Array(5001).fill('right')),null);
});
test('every source board renders all source object layers without a legacy map or source image background',()=>{
  for(const stage of SCREENSHOT_STAGES) {
    const html=renderToStaticMarkup(createElement(AppleWormScreenshotBoard,{
      state:startScreenshotWorm(stage.id),label:`Stage ${stage.id}`,
    }));
    assert.match(html,/viewBox="0 0 640 360"/);
    assert.match(html,/direction:ltr/);
    assert.equal((html.match(/data-layer="apple"/g)??[]).length,stage.apples.length);
    assert.equal((html.match(/data-layer="box"/g)??[]).length,stage.movableObjects.length);
    assert.equal((html.match(/data-layer="(?:saw|spike)"/g)??[]).length,stage.hazards.length);
    assert.equal((html.match(/data-layer="portal"/g)??[]).length,stage.portal?1:0);
    assert.doesNotMatch(html,/<image|stage_\d+\.jpg/);
  }
});
