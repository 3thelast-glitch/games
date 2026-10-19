import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppleWormReferenceScene } from '../apps/mobile/src/AppleWormReferenceScene.tsx';
import {
  APPLE_WORM_SCREENSHOT_LEVEL_COUNT,
  screenshotWormLevel,
  startScreenshotWorm,
} from '../packages/games/apple-worm/screenshot-game.ts';

const markerCount=(html:string,marker:string)=>
  html.split(marker).length-1;

// Pure presentation upgrade: prove that every rendered world anchor still
// uses the exact approved PDF game-state coordinates and object counts.
test('all 105 premium scenes preserve approved geometry, fruit, head, portal and obstacles',()=>{
  assert.equal(APPLE_WORM_SCREENSHOT_LEVEL_COUNT,105);
  for(let level=1;level<=105;level++){
    const board=screenshotWormLevel(level);
    const state=startScreenshotWorm(level);
    const remaining=board.apples.filter((_,i)=>!state.collected.includes(i));
    const html=renderToStaticMarkup(createElement(AppleWormReferenceScene,{
      board,body:state.body,remaining,
    }));
    const terrainCount=board.rows.reduce((n,row)=>
      n+[...row].filter(cell=>cell==='#').length,0);
    assert.match(html,/class="worm-terrain"/,'Stage '+level+' needs premium terrain art');
    assert.match(html,/class="worm-character"/,'Stage '+level+' needs connected premium worm art');
    assert.match(html,/class="worm-clouds"/,'Stage '+level+' needs premium background');
    assert.match(html,new RegExp('data-terrain-cell-count="'+terrainCount+'"'));
    assert.equal(markerCount(html,'data-source-apple='),remaining.length,'Stage '+level+' apples changed');
    assert.equal(markerCount(html,'data-source-gray-object='),board.grayObjects.length,
      'Stage '+level+' gray objects changed');
    assert.equal(markerCount(html,'data-source-portal='),board.portal?1:0,
      'Stage '+level+' exit presence changed');
    assert.equal(markerCount(html,'data-source-worm='),1,'Stage '+level+' must have one worm');
    assert.equal(markerCount(html,'data-worm-segment='),0,
      'Stage '+level+' must never render detached primitive worm circles');
    if(state.body[0]){
      const [x,y]=state.body[0];
      assert.match(html,new RegExp('data-head-x="'+((x+.5)*30)+'"'));
      assert.match(html,new RegExp('data-head-y="'+((y+.5)*30)+'"'));
      assert.match(html,new RegExp('data-body-length="'+state.body.length+'"'));
    }
    for(const fruit of remaining){
      const [x,y]=fruit;
      assert.ok(html.includes('transform="translate('+((x+.5)*30)+' '+((y+.5)*30)+')"'),
        'Stage '+level+' apple anchor changed at '+x+','+y);
    }
    if(board.portal){
      const [x,y]=board.portal;
      assert.ok(html.includes('transform="translate('+((x+.5)*30)+' '+((y+.5)*30)+')"'),
        'Stage '+level+' portal anchor changed at '+x+','+y);
    }
    for(const item of board.grayObjects){
      const [x,y]=item;
      assert.ok(html.includes('transform="translate('+((x+.5)*30)+' '+((y+.5)*30)+')"'),
        'Stage '+level+' gray obstacle anchor changed at '+x+','+y);
    }
  }
});
