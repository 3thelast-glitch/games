import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AppleWormReferenceScene} from '../apps/mobile/src/AppleWormReferenceScene.tsx';
import {screenshotWormLevel,startScreenshotWorm} from '../packages/games/apple-worm/screenshot-game.ts';

test('premium Apple Worm art is restored as a transparent overlay on forest fullscreen',()=>{
  for(const level of [1,2,10,15,48,101,105]){
    const board=screenshotWormLevel(level);
    const before=JSON.stringify(board);
    const state=startScreenshotWorm(level);
    const html=renderToStaticMarkup(createElement(AppleWormReferenceScene,{
      board,body:state.body,
      remaining:board.apples,
      grayPositions:state.grayPositions,
      showSky:false,phase:state.phase,biteFx:null,
    }));
    assert.match(html,/data-source-terrain="premium-art"/);
    assert.match(html,/class="worm-terrain/);
    assert.match(html,/class="worm-character/);
    assert.doesNotMatch(html,/class="worm-clouds/);
    if(board.portal)assert.match(html,/data-source-portal/);
    else assert.doesNotMatch(html,/data-source-portal/);
    assert.equal(JSON.stringify(board),before,`source stage ${level} must be unchanged by art restoration`);
  }
});
