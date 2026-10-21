import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {
  screenshotWormLevel, startScreenshotWorm,
} from '../packages/games/apple-worm/screenshot-game.ts';
import {AppleWormClassicBoard} from '../apps/mobile/src/AppleWormClassicBoard.tsx';

test('full screen classic graphics derive exactly from source board without modifying data',()=>{
  const level=screenshotWormLevel(1);
  const before=JSON.stringify(level);
  const state=startScreenshotWorm(1);
  const html=renderToStaticMarkup(createElement(AppleWormClassicBoard,{
    board:level,
    body:state.body,
    remaining:level.apples,
    grayPositions:state.grayPositions,
  }));
  assert.match(html,/data-source-terrain="classic-solid-dirt"/);
  assert.match(html,/data-source-worm/);
  assert.match(html,/data-body-length="3"/);
  if(level.portal)assert.match(html,/data-source-portal/);
  assert.equal(JSON.stringify(level),before,'rendering may not alter approved source map');
});

test('classic board permits source stages with unknown portals without inventing exits',()=>{
  let unknown=0;
  for(let n=1;n<=105;n++){
    const stage=screenshotWormLevel(n);
    if(stage.portal!==null)continue;
    unknown=n;break;
  }
  assert.ok(unknown>0);
  const level=screenshotWormLevel(unknown);
  const state=startScreenshotWorm(unknown);
  const html=renderToStaticMarkup(createElement(AppleWormClassicBoard,{
    board:level,body:state.body,remaining:level.apples,
  }));
  assert.doesNotMatch(html,/data-source-portal/);
  assert.equal(level.portal,null);
});
