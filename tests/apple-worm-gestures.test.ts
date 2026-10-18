import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 wormSwipeDirection,startWormGesture,finishWormGesture
} from '../apps/mobile/src/apple-worm-gestures.ts';

test('swiping a finger recognizes each of the four directions independently of RTL',()=>{
 const p={x:120,y:120};
 assert.equal(wormSwipeDirection(p,{x:189,y:119}),'right');
 assert.equal(wormSwipeDirection(p,{x:40,y:117}),'left');
 assert.equal(wormSwipeDirection(p,{x:120,y:56}),'up');
 assert.equal(wormSwipeDirection(p,{x:122,y:177}),'down');
});
test('short touch, tapping, accidental diagonal and invalid coordinates never move the worm',()=>{
 const p={x:120,y:120};
 assert.equal(wormSwipeDirection(p,{x:140,y:120}),null);
 assert.equal(wormSwipeDirection(p,p),null);
 assert.equal(wormSwipeDirection(p,{x:180,y:178}),null);
 assert.equal(wormSwipeDirection(p,{x:NaN,y:190}),null);
 assert.equal(wormSwipeDirection(p,{x:Infinity,y:10}),null);
 assert.equal(wormSwipeDirection(p,{x:190,y:120},-1),null);
 assert.equal(wormSwipeDirection(p,{x:190,y:120},22,0),null);
});
test('each accepted pointer identifier makes at most one committed swipe and cannot cross pointer ownership',()=>{
 const gesture=startWormGesture(9,100,150);
 assert.ok(gesture);
 assert.equal(finishWormGesture(gesture,10,160,150),null);
 assert.equal(finishWormGesture(gesture,9,160,150),'right');
 assert.equal(finishWormGesture(null,9,160,150),null);
 assert.equal(startWormGesture(-1,NaN,0),null);
});
