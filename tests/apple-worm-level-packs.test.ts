import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 APPLE_WORM_STAGE_COUNT,APPLE_WORM_GROUP_SIZE,APPLE_WORM_GROUPS,
 appleWormBlueprint,
} from '../packages/games/apple-worm/levels.ts';
import {wormLevel,restoreWorm,startWorm} from '../packages/games/apple-worm/engine.ts';

test('four independent chapter groups each contain precisely ten stages',()=>{
 assert.equal(APPLE_WORM_STAGE_COUNT,40);
 assert.equal(APPLE_WORM_GROUP_SIZE,10);
 assert.deepEqual(APPLE_WORM_GROUPS,[
  {start:1,end:10},{start:11,end:20},{start:21,end:30},{start:31,end:40},
 ]);
});
test('40 new blueprint layouts are bounded and unique, with no old synthetic-stage fallback',()=>{
 const seen=new Set<string>();
 for(let level=1;level<=40;level++){
  const blueprint=appleWormBlueprint(level);
  const board=wormLevel(level);
  assert.equal(board.number,level);
  assert.equal(board.height,10);
  assert.ok(board.width>=11);
  const blocks=new Set(board.blocks.map(p=>p.x+':'+p.y));
  assert.equal(blocks.size,board.blocks.length);
  for(const apple of board.apples)assert.ok(!blocks.has(apple.x+':'+apple.y));
  assert.ok(!blocks.has(board.portal.x+':'+board.portal.y));
  assert.ok(board.blocks.every(p=>p.x>=0&&p.x<board.width&&p.y>=0&&p.y<board.height));
  assert.ok(board.start.every(p=>!blocks.has(p.x+':'+p.y)));
  assert.deepEqual(startWorm(level).body,board.start);
  assert.deepEqual(board.apple,{x:blueprint.fruit[0],y:blueprint.fruit[1]});
  const signature=JSON.stringify([board.blocks,board.apples,board.portal,board.width]);
  assert.ok(!seen.has(signature),'duplicate stage '+level);
  seen.add(signature);
 }
 assert.throws(()=>appleWormBlueprint(0),RangeError);
 assert.throws(()=>appleWormBlueprint(41),RangeError);
});
test('all 40 stages can save/restore their progress without the previous 30-level cap',()=>{
 for(const level of [1,10,11,20,21,30,31,40]){
  const state=startWorm(level);
  assert.deepEqual(restoreWorm(state),state);
 }
 assert.equal(restoreWorm({...startWorm(40),level:41}),null);
});
