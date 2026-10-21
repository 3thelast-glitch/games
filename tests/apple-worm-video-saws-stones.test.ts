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
  assert.equal(VIDEO_SAW_STAGE_COUNT,53);
  for(let level=1;level<=105;level++){
    const map=screenshotWormLevel(level);
    assert.deepEqual(map.saws,sourceSawStarts(level));
    assert.deepEqual(map.spikes,sourceSpikeStarts(level));
    assert.ok(map.saws.every(p=>!map.grayObjects.some(q=>p[0]===q[0]&&p[1]===q[1])),
      'a lethal wheel became a pushable rock L'+level);
    assert.ok(map.grayObjects.every(([x,y])=>Number.isInteger(x)&&Number.isInteger(y)));
    assert.ok(map.saws.every(([x,y])=>Number.isInteger(x)&&Number.isInteger(y)));
  }
  const stage48=screenshotWormLevel(48);
  assert.deepEqual(stage48.saws,
    [[9,4],[11,4],[9,5],[11,5],[9,6],[11,6]]);
  assert.deepEqual(stage48.grayObjects,[],'saws were formerly drawn as ? cubes');
  const stage68=screenshotWormLevel(68);
  assert.deepEqual(stage68.saws,[[7,1],[9,1],[11,1],[10,3],[7,5]]);
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
