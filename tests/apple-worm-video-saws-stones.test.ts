import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {
  VIDEO_SAW_STAGE_COUNT,sourceSawStarts,sourceStoneStarts,sourceSpikeStarts,
} from '../packages/games/apple-worm/video-source-obstacles-105.ts';
import {
  SCREENSHOT_DIRECTIONS,screenshotWormLevel,startScreenshotWorm,
  moveScreenshotWorm,restoreScreenshotWorm,
} from '../packages/games/apple-worm/screenshot-game.ts';
import {AppleWormReferenceScene} from '../apps/mobile/src/AppleWormReferenceScene.tsx';

test('every stage has typed video objects, never confuse lethal discs with gray solid placeholders',()=>{
  assert.equal(VIDEO_SAW_STAGE_COUNT,54);
  for(let level=1;level<=105;level++){
    const map=screenshotWormLevel(level);
    assert.deepEqual(map.saws,sourceSawStarts(level));
    assert.deepEqual(map.spikes,sourceSpikeStarts(level));
    assert.ok(map.saws.every(p=>!map.grayObjects.some(q=>p[0]===q[0]&&p[1]===q[1])),
      'a lethal wheel became a pushable rock L'+level);
    assert.ok(map.grayObjects.every(([x,y])=>Number.isInteger(x)&&Number.isInteger(y)));
    assert.ok(map.saws.every(([x,y])=>Number.isInteger(x)&&Number.isInteger(y)));
  }
  const discovered=screenshotWormLevel(39);
  assert.deepEqual(discovered.saws,[[3,3]],
    'full-video audit identified a previously missed saw-bearing level');
  assert.equal(screenshotWormLevel(31).saws.length,5);
  assert.equal(screenshotWormLevel(55).saws.length,7);
  assert.equal(screenshotWormLevel(89).saws.length,6);
  assert.equal(screenshotWormLevel(100).saws.length,5);
  assert.ok(screenshotWormLevel(32).spikes.length===0,
    'the dark circular portal and red edible apples are NOT black thorns');
  const stage48=screenshotWormLevel(48);
  assert.deepEqual(stage48.saws,
    [[9,4],[11,4],[9,5],[11,5],[9,6],[11,6]]);
  assert.deepEqual(stage48.grayObjects,[],'saws were formerly drawn as ? cubes');
  const stage68=screenshotWormLevel(68);
  assert.deepEqual(stage68.saws,[[7,1],[9,1],[11,1],[10,3],[7,5]]);
});

test('level 32 retains all SIX confirmed filmed saws, including the one initially fruit-obscured',()=>{
  const map=screenshotWormLevel(32);
  assert.deepEqual(new Set(map.saws.map(p=>p.join(','))),
    new Set(['15,0','13,2','4,4','8,4','9,4','5,1']));
  assert.equal(map.saws.length,6);
  assert.ok(map.apples.some(([x,y])=>x===5&&y===2),
    'red fruit eaten under the saw remains an apple, NOT a fake spike');
  assert.equal(map.exitMode,'spiral');
  const state=startScreenshotWorm(32);
  const html=renderToStaticMarkup(createElement(AppleWormReferenceScene,{
    board:map,body:state.body,remaining:map.apples,
    grayPositions:state.grayPositions,showSky:false,
  }));
  assert.equal((html.match(/data-source-saw="/g)||[]).length,6,
    'six filmed discs should spin at their actual source grid anchors');
  assert.equal((html.match(/class="worm-source-saw-spinning"/g)||[]).length,6);
  assert.equal((html.match(/data-saw-rotation-marker="true"/g)||[]).length,6);
  assert.equal((html.match(/data-source-spike="/g)||[]).length,0,
    'no black triangular spikes were visible in the level-32 film');
});

test('the worm dies upon entering a saw cell even if terrain underneath it is solid',()=>{
  const map=screenshotWormLevel(32);
  const state={...startScreenshotWorm(32),
    body:[[7,4],[6,4],[5,4]] as const};
  // The source video has a saw at (8,4) embedded on the brick platform.
  // Old code checked terrain first and silently refused the move.
  const lost=moveScreenshotWorm(state,'right',map);
  assert.notEqual(lost,state);
  assert.equal(lost.phase,'lost');
  assert.deepEqual(lost.body[0],[8,4]);
  assert.equal(restoreScreenshotWorm(lost)?.phase,'lost');
  // Solid terrain WITHOUT a blade should remain impassable, not deadly.
  const plain={...map,saws:[] as typeof map.saws};
  const plainMove=moveScreenshotWorm(state,'right',plain);
  assert.notEqual(plainMove.phase,'lost',
    'without the blade this position must not kill the worm');
  // Test a genuinely impassable brick, not merely assume that all filmed
  // gear positions also coincide with the reconstructed terrain mask.
  const walled={...plain,rows:plain.rows.map((row,y)=>y===4
    ?row.slice(0,8)+'#'+row.slice(9):row)};
  const blocked=moveScreenshotWorm(state,'right',walled);
  assert.equal(blocked,state,'ordinary brick remains blocked and nonlethal');
});

test('worm dies on a filmed spinning disc instead of bouncing against an old gray wall',()=>{
  const board=screenshotWormLevel(48);
  const state={...startScreenshotWorm(48),body:[[8,4],[7,4],[6,4]] as const};
  const next=moveScreenshotWorm(state,'right',board);
  assert.notEqual(next,state,'saw collision must be a legal physical step');
  assert.equal(next.phase,'lost');
  assert.deepEqual(next.body[0],[9,4]);
  assert.equal(next.moves,state.moves+1);
  assert.equal(restoreScreenshotWorm(next)?.phase,'lost');
});

test('separate triangular spikes also kill on contact, without inventing video positions',()=>{
  const original=screenshotWormLevel(48);
  const custom={...original,saws:[] as typeof original.saws,
    spikes:[[9,4]] as readonly (readonly[number,number])[]};
  const state={...startScreenshotWorm(48),body:[[8,4],[7,4],[6,4]] as const};
  const next=moveScreenshotWorm(state,'right',custom);
  assert.equal(next.phase,'lost');
  assert.ok(Object.values(Array.from({length:105},(_,i)=>sourceSpikeStarts(i+1)))
    .every(cells=>cells.length===0),
    'standalone triangle cells must never be invented without video evidence');
});

test('stone body is pushable and stage-104 tower stays stationary',()=>{
  const map47=screenshotWormLevel(47);
  assert.deepEqual(map47.grayObjects,[[5,2]]);
  assert.deepEqual(startScreenshotWorm(47).grayPositions,[[5,2]]);
  const map104=screenshotWormLevel(104);
  assert.deepEqual(map104.grayObjects,
    [[4,1],[4,2],[4,3],[4,4],[4,5],[4,6],[4,7],[6,7]]);
  assert.deepEqual(startScreenshotWorm(104).grayPositions,[[6,7]]);
  assert.deepEqual(
    screenshotWormLevel(104,'legacy').saws,[]);
  assert.deepEqual(startScreenshotWorm(104,'legacy').grayPositions,[[7,7]]);
  const restored=restoreScreenshotWorm(startScreenshotWorm(104));
  assert.deepEqual(restored,startScreenshotWorm(104));
});

test('video hazard artwork shows stones without question marks and saw teeth as separate visual objects',()=>{
  for(const n of [48,68,83,94,97,104]){
    const stage=screenshotWormLevel(n),state=startScreenshotWorm(n);
    const html=renderToStaticMarkup(createElement(AppleWormReferenceScene,{
      board:stage,body:state.body,remaining:stage.apples,
      grayPositions:state.grayPositions,showSky:false,
    }));
    const disks=(html.match(/data-source-saw="/g)||[]).length;
    assert.equal(disks,stage.saws.length,'visible rotating saw mismatch L'+n);
    const rocks=(html.match(/data-source-gray-object="/g)||[]).length;
    assert.equal(rocks,stage.grayObjects.length,'stone art mismatch L'+n);
    assert.doesNotMatch(html,/data-source-unknown-\?/);
    if(n===104){
      assert.equal((html.match(/data-pushable="true"/g)||[]).length,1);
      assert.equal((html.match(/data-pushable="false"/g)||[]).length,7);
    }
  }
});

test('legacy selected-clip solvers remain isolated from full-video saw/stones',()=>{
  const stage=screenshotWormLevel(48,'legacy');
  assert.deepEqual(stage.saws,[]);
  assert.deepEqual(stage.spikes,[]);
  for(const dir of SCREENSHOT_DIRECTIONS) {
    const state=startScreenshotWorm(48,'legacy');
    assert.equal(moveScreenshotWorm(state,dir,stage).level,48);
  }
});
