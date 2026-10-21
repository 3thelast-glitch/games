import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  APPLE_WORM_CAMPAIGN_LEVEL_COUNT,cleanCompletedStages,
  highestUnlockedStage,isStageUnlocked,resumableUnlockedStage,
} from '../packages/games/apple-worm/progression.ts';

test('new players enter only level 1, all other 104 stages are locked',()=>{
  assert.equal(APPLE_WORM_CAMPAIGN_LEVEL_COUNT,105);
  assert.equal(highestUnlockedStage([]),1);
  for(let n=1;n<=105;n++)
    assert.equal(isStageUnlocked(n,[]),n===1,'new game level '+n);
});

test('each consecutive legitimate victory unlocks exactly the following stage',()=>{
  const victories:number[]=[];
  for(let n=1;n<=104;n++){
    assert.equal(highestUnlockedStage(victories),n);
    victories.push(n);
    assert.equal(highestUnlockedStage(victories),n+1);
    assert.equal(isStageUnlocked(n+1,victories),true);
    if(n+2<=105)assert.equal(isStageUnlocked(n+2,victories),false);
  }
  victories.push(105);
  assert.equal(highestUnlockedStage(victories),105);
  assert.equal(isStageUnlocked(106,victories),false);
});

test('older QA saves cannot jump ahead just because level 105 was viewed',()=>{
  assert.equal(resumableUnlockedStage(105,[]),1);
  assert.equal(resumableUnlockedStage(32,[1,2]),3);
  assert.equal(resumableUnlockedStage(1,[1,2]),1);
  assert.equal(resumableUnlockedStage(3,[1,2]),3);
  assert.equal(resumableUnlockedStage(105,Array.from({length:104},(_,i)=>i+1)),105);
});

test('out-of-order or corrupted saved wins never skip an uncleared predecessor',()=>{
  assert.deepEqual(cleanCompletedStages([7,5,1,2,2,999,-1,0,'4',3.1,null,105]),[1,2,5,7,105]);
  assert.deepEqual(cleanCompletedStages({completed:[1,2]}),[]);
  assert.deepEqual(cleanCompletedStages(undefined),[]);
  assert.equal(highestUnlockedStage([1,2,4,7,105]),3);
  assert.equal(isStageUnlocked(4,[1,2,4,7,105]),false);
  assert.equal(isStageUnlocked(0,[1,2]),false);
  assert.equal(isStageUnlocked(1.5,[1,2]),false);
});
