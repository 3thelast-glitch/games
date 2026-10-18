import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fitWormViewport} from '../apps/mobile/src/apple-worm-viewport.ts';

test('fullscreen SVG fits 16:9, ultra-wide and tall landscape aspect ratios with no gutters',()=>{
  for(const [width,height] of [[568,320],[740,360],[844,390],[932,430],[1280,596],[2400,1080],[1024,768]]){
    const v=fitWormViewport(10,9,width,height);
    assert.ok(Math.abs(v.sceneWidth/v.sceneHeight-width/height)<.00001,String(width)+'x'+String(height));
    assert.ok(v.boardX>=48);
    assert.ok(v.boardY>=0);
    assert.ok(v.boardX+480<=v.sceneWidth);
    assert.ok(v.boardY+432<=v.sceneHeight);
    assert.ok(Number.isFinite(v.sceneWidth)&&Number.isFinite(v.sceneHeight));
  }
});
test('later wide puzzle levels remain completely within screen on small landscape phones',()=>{
 for(let columns=10;columns<=18;columns+=2){
  const v=fitWormViewport(columns,9,568,320);
  assert.ok(v.boardX>=0);
  assert.ok(v.boardX+columns*48<=v.sceneWidth);
  assert.ok(v.boardY+9*48<=v.sceneHeight);
 }
});
test('invalid size measurement falls back to a safe aspect',()=>{
 const v=fitWormViewport(10,9,NaN,0);
 assert.equal(v.sceneWidth/v.sceneHeight,16/9);
});
