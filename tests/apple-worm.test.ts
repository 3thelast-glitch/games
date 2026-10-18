import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WORM_LEVEL_COUNT, findWormSolution, moveWorm, restoreWorm, startWorm, wormLevel,
  type Direction,
} from '../packages/games/apple-worm/engine.ts';

test('Apple Worm has forty distinct, valid offline level layouts', () => {
  assert.equal(WORM_LEVEL_COUNT, 40);
  const layouts = new Set<string>();
  for (let level = 1; level <= WORM_LEVEL_COUNT; level++) {
    const board = wormLevel(level);
    const blocks = new Set(board.blocks.map(p => p.x + ':' + p.y));
    assert.equal(board.number, level);
    for(const apple of board.apples)
      assert.ok(!blocks.has(apple.x + ':' + apple.y), 'apple on ground: ' + level);
    assert.ok(!blocks.has(board.portal.x + ':' + board.portal.y), 'portal on ground: ' + level);
    assert.ok(!board.start.some(p => blocks.has(p.x + ':' + p.y)));
    layouts.add(JSON.stringify([board.width, board.blocks, board.apples, board.portal, board.spikes]));
  }
  assert.equal(layouts.size, 40);
  assert.throws(() => wormLevel(0), RangeError);
  assert.throws(() => wormLevel(41), RangeError);
});

test('Apple Worm: each of the forty levels has a valid solution with gravity', () => {
  for (let level = 1; level <= WORM_LEVEL_COUNT; level++) {
    let state = startWorm(level);
    const solution = findWormSolution(state);
    assert.ok(solution && solution.length > 0, 'unsolvable level ' + level);
    for (const move of solution as Direction[]) {
      const next = moveWorm(state, move);
      assert.notEqual(next, state, 'invalid step in level ' + level);
      assert.notEqual(next.phase, 'lost', 'fatal solution for level ' + level);
      state = next;
    }
    assert.equal(state.phase, 'won', 'did not reach exit in level ' + level);
    assert.equal(state.eaten, true, 'did not eat apple in level ' + level);
    assert.equal(state.body.length, startWorm(level).body.length + wormLevel(level).apples.length,
      'did not grow once per apple in level ' + level);
  }
});

test('Apple Worm: eat to grow, do not mutate input and never move through ground', () => {
  const initial = startWorm(1);
  const after = moveWorm(initial, 'right');
  assert.notEqual(initial, after);
  assert.equal(initial.body.length, 2);
  assert.equal(initial.moves, 0);
  assert.equal(after.moves, 1);
  const eaten = moveWorm(after, 'right');
  assert.equal(eaten.eaten, true);
  assert.equal(eaten.body.length, 3);
  const invalid = moveWorm(eaten, 'down');
  assert.equal(invalid, eaten);
});

test('Apple Worm: restore only valid and bounded saves', () => {
  assert.deepEqual(restoreWorm(startWorm(1)), startWorm(1));
  assert.equal(restoreWorm({ level: 999, body: [], eaten: false, phase: 'playing', moves: 0 }), null);
  assert.equal(restoreWorm({ ...startWorm(1), body: [{ x: 1, y: 6 }, { x: 1, y: 6 }] }), null);
  assert.equal(restoreWorm({ ...startWorm(1), moves: -1 }), null);
  assert.equal(restoreWorm(null), null);
});

test('head never reverses straight into its neck; turn around by maneuvering instead', () => {
  const initial = startWorm(1);
  assert.equal(moveWorm(initial, 'left'), initial, 'head cannot teleport to a two-segment tail');
  const next = moveWorm(initial, 'right');
  assert.equal(moveWorm(next, 'left'), next, 'immediate 180-degree reverse is illegal');
  assert.deepEqual(next.body[0], {x:3,y:6});
  const turn = moveWorm(next, 'up');
  assert.notEqual(turn, next, 'a 90-degree bend is permitted');
  assert.deepEqual(turn.body[0], {x:3,y:5});
  const around = moveWorm(turn, 'left');
  assert.notEqual(around, turn, 'a second bend can face the opposite way');
  assert.deepEqual(around.body[0], {x:2,y:6}, 'the bend succeeds and gravity settles the worm');
});

test('fruit is a solid perch: landing on it does not eat or grow the worm', () => {
  const board = wormLevel(1);
  const airborne = {...startWorm(1),body:[{x:board.apple.x-1,y:board.apple.y-2},{x:board.apple.x-2,y:board.apple.y-2}]};
  const after = moveWorm(airborne,'right');
  assert.equal(after.eaten,false,'falling onto an apple must not count as eating');
  assert.equal(after.body.length,2,'landing from above must never grow');
  assert.deepEqual(after.body[0],{x:board.apple.x,y:board.apple.y-1},
    'apple stops the worm in the cell immediately above it');
  assert.equal(after.phase,'playing');
  assert.notEqual(after,airborne);
});

test('worm bites apple only from the side, grows one segment and changes fruit state',()=>{
  const board=wormLevel(1);
  const standing={...startWorm(1),body:[{x:board.apple.x-1,y:board.apple.y},{x:board.apple.x-2,y:board.apple.y}]};
  const consumed=moveWorm(standing,'right');
  assert.equal(consumed.eaten,true);
  assert.equal(consumed.body.length,3);
  assert.deepEqual(consumed.body[0],board.apple);
  assert.equal(consumed.phase,'playing');
  assert.equal(standing.eaten,false,'previous state must remain unchanged');
});

test('apple cannot be entered from below or above, but can be climbed over',()=>{
  const board=wormLevel(1);
  const above={...startWorm(1),body:[{x:board.apple.x,y:board.apple.y-1},{x:board.apple.x-1,y:board.apple.y-1}]};
  assert.equal(moveWorm(above,'down'),above);
  const below={...startWorm(1),body:[{x:board.apple.x,y:board.apple.y+1},{x:board.apple.x-1,y:board.apple.y+1}]};
  assert.equal(moveWorm(below,'up'),below);
  const step=moveWorm(above,'right');
  assert.notEqual(step,above,'the player can walk sideways away from the apple top');
  assert.equal(step.eaten,false);
});

test('invalid pending-growth saves are rejected and old saves still load safely', () => {
  const a=startWorm(1);
  const legacy={...a};
  delete legacy.pendingGrowth;
  assert.equal(restoreWorm(legacy)?.pendingGrowth,false);
  assert.equal(restoreWorm({...a,pendingGrowth:true}),null);
  assert.equal(restoreWorm({...a,pendingGrowth:'yes'}),null);
});

test('Apple Worm progression reflects planning complexity rather than just longer straight floors',()=>{
 const solutions:number[][]=[[],[],[],[]];
 const fruitCounts:number[]=[];
 for(let level=1;level<=40;level++){
  const board=wormLevel(level);
  const solution=findWormSolution(startWorm(level));
  assert.ok(solution, 'no winning route for stage '+level);
  solutions[Math.floor((level-1)/10)]!.push(solution!.length);
  fruitCounts.push(board.apples.length);
  if(level>=14)assert.ok(board.apples.length>=2 || level===17 || level===19);
  if(level>=31)assert.ok(board.apples.length>=3);
 }
 const mean=(a:number[])=>a.reduce((n,x)=>n+x,0)/a.length;
 const a=solutions.map(mean);
 assert.ok(a[0]!+4<a[1]!, 'medium group must be meaningfully harder than easy');
 assert.ok(a[1]!+3<a[2]!, 'hard group must be harder than medium');
 assert.ok(a[2]!+3<a[3]!, 'expert group must be harder than hard');
 assert.ok(Math.max(...solutions[3]!)>=35, 'late game must contain 35+ move challenges');
 assert.ok(Math.max(...fruitCounts)>=4,'later stages include 4-fruit routing');
});
test('collecting more than one fruit grows a permanent-head worm and exit only works after all fruit',()=>{
 const target=14;
 const board=wormLevel(target);
 assert.ok(board.apples.length>=2);
 let state=startWorm(target);
 let picked=0;
 const solution=findWormSolution(state,30000);
 assert.ok(solution);
 for(const direction of solution!){
  const next=moveWorm(state,direction);
  assert.notEqual(next,state);
  const count=(next.collectedApples??[]).length;
  if(count>picked){
   assert.equal(count,picked+1);
   assert.equal(next.body.length,state.body.length+1);
   if(count<board.apples.length){
    assert.equal(next.eaten,false,'must collect all before portal activates');
    assert.equal(next.phase,'playing');
   }
   picked=count;
  }
  state=next;
 }
 assert.equal(picked,board.apples.length);
 assert.equal(state.eaten,true);
 assert.equal(state.phase,'won');
});
