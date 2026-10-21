import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AppleWormReferenceScene} from '../apps/mobile/src/AppleWormReferenceScene.tsx';
import {screenshotWormLevel,startScreenshotWorm,moveScreenshotWorm}
  from '../packages/games/apple-worm/screenshot-game.ts';
import {VIDEO_SAW_STAGE_COUNT,VIDEO_THORN_STAGE_COUNT}
  from '../packages/games/apple-worm/video-source-obstacles-105.ts';

const scene=(level:number,spikes?:readonly (readonly [number,number])[])=>{
  const board=screenshotWormLevel(level);
  const state=startScreenshotWorm(level);
  return renderToStaticMarkup(createElement(AppleWormReferenceScene,{
    board:spikes?{...board,saws:[],spikes}:board,
    body:state.body,remaining:board.apples,
    grayPositions:state.grayPositions,showSky:false,
  }));
};

test('ALL 105 maps pin each spinning saw to an exact fixed cell center',()=>{
  assert.equal(VIDEO_SAW_STAGE_COUNT,54);
  let sawCount=0;
  for(let level=1;level<=105;level++){
    const board=screenshotWormLevel(level);
    const html=scene(level);
    const anchors=[...html.matchAll(
      /<g data-source-saw="[^"]*" data-grid-x="(-?\d+)" data-grid-y="(-?\d+)" data-saw-fixed-frame="true" transform="translate\((-?[\d.]+) (-?[\d.]+)\)">/g)];
    assert.equal(anchors.length,board.saws.length,
      'missing or unanchored rotating hazard in stage '+level);
    for(let j=0;j<anchors.length;j++){
      const match=anchors[j]!;
      const [x,y]=board.saws[j]!;
      assert.deepEqual([Number(match[1]),Number(match[2])],[x,y],
        'saw stage-cell changed L'+level);
      assert.deepEqual([Number(match[3]),Number(match[4])],
        [(x+.5)*30,(y+.5)*30],'saw world pivot moved L'+level);
    }
    const viewports=(html.match(/data-saw-local-origin="0,0"/g)||[]).length;
    const rotors=(html.match(/class="worm-source-saw-spinning"/g)||[]).length;
    assert.equal(viewports,board.saws.length,'local rotor viewport mismatch L'+level);
    assert.equal(rotors,board.saws.length,'spin missing L'+level);
    sawCount+=board.saws.length;
  }
  assert.ok(sawCount>100,'cross-stage anchored saw inventory must not be empty');
});

test('CSS spins the saw around the local viewBox, NEVER its moving element bounds',()=>{
  const css=readFileSync(new URL('../apps/mobile/src/apple-worm-three.css',import.meta.url),'utf8');
  assert.match(css,/\.worm3 \.worm-source-saw-spinning\s*\{[^}]*transform-box:view-box/s);
  assert.match(css,/transform-origin:50% 50%/);
  assert.doesNotMatch(css,/\.worm3 \.worm-source-saw-spinning\s*\{[^}]*transform-box:fill-box/s);
  assert.match(css,/:root\[data-reduce-motion='true'\] \.worm3 \.worm-source-saw-spinning/);
});

test('real black thorn renderer is stationary and a touch is lethal',()=>{
  const html=scene(48,[[9,4]]);
  assert.equal((html.match(/data-source-spike="/g)||[]).length,1);
  assert.match(html,/data-spike-type="stationary-black-thorns"/);
  assert.match(html,/class="worm-source-spike-fixed"/);
  assert.match(html,/fill="#08090d"/);
  assert.match(html,/fill="#13151b"/);
  assert.doesNotMatch(html,/class="worm-source-saw-spinning"/);
  const board=screenshotWormLevel(48);
  const custom={...board,saws:[],spikes:[[9,4]] as readonly (readonly [number,number])[]};
  const state={...startScreenshotWorm(48),
    body:[[8,4],[7,4],[6,4]] as readonly (readonly [number,number])[]};
  const hit=moveScreenshotWorm(state,'right',custom);
  assert.equal(hit.phase,'lost');
  assert.deepEqual(hit.body[0],[9,4]);
});

test('the user-supplied marked spike coordinates still require visual transcription',()=>{
  // The physical renderer works; do not fabricate coordinates from unverified
  // black marks or confuse the red edible fruit in Stage 32 with black thorns.
  assert.equal(VIDEO_THORN_STAGE_COUNT,0);
  assert.equal(screenshotWormLevel(32).spikes.length,0);
});
