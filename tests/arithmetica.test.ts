import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  answerMathRun, beginMathRun, defaultMathRecord, INITIAL_TIME_MS,
  makeQuestion, MAX_TIME_MS, pauseMathRun, QUESTIONS_PER_LEVEL,
  readMathRecord, RIGHT_BONUS_MS, startMathRun, summarizeMathRun,
  tickMathRun, WRONG_PENALTY_MS,
} from '../packages/games/arithmetica/engine.ts';

test('ArithmeticA deterministically builds 2 unique choices with exactly 1 correct answer', () => {
  const operations = new Set<string>();
  for (let seed of [1, 5, 100, 91821]) {
    for (let id = 0; id < 120; id++) {
      const question=makeQuestion(seed,id);
      const repeated=makeQuestion(seed,id);
      assert.deepEqual(question,repeated);
      assert.equal(question.choices.length,2);
      assert.notEqual(question.choices[0],question.choices[1]);
      assert.equal(question.choices[question.correctIndex],question.result);
      assert.ok(question.left>=0 && question.right>=1);
      assert.ok(question.result>=0);
      let actual=0;
      switch(question.op){
        case '+':actual=question.left+question.right;break;
        case '-':actual=question.left-question.right;break;
        case '×':actual=question.left*question.right;break;
        case '÷':actual=question.left/question.right;break;
      }
      assert.equal(actual,question.result);
      operations.add(question.op);
    }
  }
  for(const op of ['+','-','×','÷'])assert.ok(operations.has(op),'must include '+op);
});
test('ArithmeticA begins on the first level with a five-star group and positive timer',()=>{
  const s=startMathRun(81);
  assert.equal(s.phase,'ready');
  assert.equal(s.level,1);assert.equal(s.stars,0);
  assert.equal(s.question.level,1);assert.equal(s.timeMs,INITIAL_TIME_MS);
  assert.equal(beginMathRun(s).phase,'playing');
  assert.equal(tickMathRun(s,1000).timeMs,INITIAL_TIME_MS);
  assert.equal(pauseMathRun(s),s);
});
test('Correct taps grant points and time and advance exactly after 5 correct answers',()=>{
  let run=beginMathRun(startMathRun(102));
  for(let i=0;i<QUESTIONS_PER_LEVEL;i++){
    const before=run.timeMs;
    const beforeId=run.question.id;
    run=answerMathRun(run,run.question.correctIndex);
    assert.ok(run.score>0);
    assert.equal(run.correct,i+1);
    assert.equal(run.streak,i+1);
    assert.equal(run.maxStreak,i+1);
    assert.equal(run.timeMs,Math.min(MAX_TIME_MS,before+RIGHT_BONUS_MS));
    assert.equal(run.question.id,beforeId+1);
    assert.equal(run.question.level,run.level);
  }
  assert.equal(run.level,2);
  assert.equal(run.stars,0);
});
test('Wrong taps subtract time without accidentally progressing to a harder level',()=>{
  let run=beginMathRun(startMathRun(429));
  const initial=run.timeMs;
  for(let i=0;i<4;i++){
    run=answerMathRun(run,1-run.question.correctIndex);
    assert.equal(run.correct,0);
    assert.equal(run.stars,0);
    assert.equal(run.level,1);
    assert.equal(run.question.level,1);
    assert.equal(run.feedback,'wrong');
  }
  assert.equal(run.mistakes,4);
  assert.equal(run.timeMs,initial-4*WRONG_PENALTY_MS);
});
test('Math timer drains without negative time, pauses, then loses exactly on expiry',()=>{
  let run=beginMathRun(startMathRun(88));
  run=tickMathRun(run,500);
  assert.equal(run.timeMs,INITIAL_TIME_MS-500);
  run=pauseMathRun(run);
  assert.equal(run.phase,'paused');
  assert.equal(tickMathRun(run,1000),run);
  run=pauseMathRun(run);
  assert.equal(run.phase,'playing');
  assert.throws(()=>tickMathRun(run,-1),RangeError);
  assert.throws(()=>tickMathRun(run,1001),RangeError);
  for(let i=0;i<40 && run.phase==='playing';i++)run=tickMathRun(run,1000);
  assert.equal(run.phase,'gameover');
  assert.equal(run.timeMs,0);
  assert.equal(answerMathRun(run,run.question.correctIndex),run);
});
test('Only indexes zero and one are accepted while playing',()=>{
  let run=beginMathRun(startMathRun(16));
  assert.equal(answerMathRun(run,-1),run);
  assert.equal(answerMathRun(run,2),run);
  assert.equal(answerMathRun(run,NaN),run);
  run=answerMathRun(run,run.question.correctIndex);
  assert.equal(run.answered,1);
});
test('Saved high scores survive replay while malformed stored data is sanitized',()=>{
  const before=defaultMathRecord();
  assert.equal(summarizeMathRun(before,startMathRun()),before);
  let run=beginMathRun(startMathRun(18));
  for(let i=0;i<9;i++){
    run=answerMathRun(run,run.question.correctIndex);
  }
  assert.equal(run.level,2);
  assert.equal(run.maxStreak,9);
  run={...run,phase:'gameover',streak:0};
  const record=summarizeMathRun(before,run);
  assert.equal(record.bestStreak,9);
  assert.equal(record.bestLevel,2);
  assert.equal(record.totalSolved,9);
  assert.equal(record.plays,1);
  const second={...run,score:Math.max(0,run.score-50),correct:3,level:1,maxStreak:1};
  const combined=summarizeMathRun(record,second);
  assert.equal(combined.bestScore,run.score);
  assert.equal(combined.totalSolved,12);
  assert.deepEqual(readMathRecord(null),defaultMathRecord());
  assert.deepEqual(readMathRecord({bestScore:-45,bestLevel:NaN,bestStreak:'10',totalSolved:Infinity,plays:1.5}),
    defaultMathRecord());
  assert.deepEqual(readMathRecord(combined),combined);
});
