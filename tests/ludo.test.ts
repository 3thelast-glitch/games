import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  circuitSize, createLudo, finishProgress, isSafe, legalMoves, moveLudo,
  nodeFor, resignLudo, rollLudo, routeFor, secureDie, validateLudo,
  chooseAiToken, type SeatCount,
} from '../packages/games/ludo/engine.ts';

const counts: SeatCount[] = [4,6,8,10];

for (const n of counts) {
  test('Ludo '+n+' players: topologies, base slots, rotation, safe nodes', () => {
    const state=createLudo(n);
    assert.equal(circuitSize(n),13*n);
    assert.equal(state.tokens.length,4*n);
    assert.equal(routeFor(n,0).length,13*n+5);
    assert.equal(new Set(routeFor(n,0)).size,13*n+5);
    assert.equal(state.controllers.length,n);
    for(let s=0;s<n;s++){
      const path=routeFor(n,s);
      assert.equal(path[0],'c:'+(13*s));
      assert.equal(path[13*n-2],'c:'+((13*s+13*n-2)%(13*n)));
      assert.equal(path[13*n-1],'home:'+s+':0');
      assert.equal(path.at(-1),'finish:'+s);
      assert.deepEqual(path.slice(-6,-1),Array.from({length:5},(_,i)=>'home:'+s+':'+i));
      assert.ok(path.every(x=>!x.startsWith('home:')||x.startsWith('home:'+s+':')));
      for(let k=0;k<13*n-1;k++){
        const index=Number(path[k]!.slice(2));
        const relative=(index-13*s+13*n)%(13*n);
        assert.equal(relative,k);
      }
      assert.equal(state.tokens.filter(t=>t.seat===s).length,4);
    }
    assert.equal(Array.from({length:13*n},(_,i)=>isSafe(n,i)).filter(Boolean).length,n*2);
    validateLudo(state);
  });
  test('Ludo '+n+' players: first six, extra roll and no move',()=>{
    const s=createLudo(n);
    const after1=rollLudo(s,1);
    assert.equal(after1.activeSeat,1);
    assert.equal(after1.phase,'roll');
    const first=rollLudo(s,6);
    assert.equal(first.phase,'move');
    assert.equal(legalMoves(first).length,4);
    assert.ok(legalMoves(first).every(m=>m.to===0));
    const moved=moveLudo(first,'0:0');
    assert.equal(moved.tokens[0]!.progress,0);
    assert.equal(moved.activeSeat,0);
    assert.equal(moved.phase,'roll');
    assert.equal(moved.sixes,1);
    validateLudo(moved);
    const second=rollLudo(moved,6);
    const moved2=moveLudo(second,'0:0');
    assert.equal(moved2.tokens[0]!.progress,6);
    assert.equal(moved2.sixes,2);
    const third=rollLudo(moved2,6);
    assert.equal(third.activeSeat,1);
    assert.equal(third.phase,'roll');
    assert.equal(third.tokens[0]!.progress,6);
    assert.equal(third.sixes,0);
    validateLudo(third);
  });
  test('Ludo '+n+' players: capture, safe cell, exact home and finished rank',()=>{
    const C=circuitSize(n),F=finishProgress(n);
    const s=createLudo(n);
    s.phase='move';s.die=1;
    s.tokens[0]!.progress=12; // move to unsafe c:13
    s.tokens[4]!.progress=0; // seat 1 at safe entry c:13
    assert.equal(legalMoves(s).find(x=>x.tokenId==='0:0')!.captures,0);
    let next=moveLudo(s,'0:0');
    assert.equal(next.tokens[4]!.progress,0);
    const c=createLudo(n);
    c.phase='move';c.die=1;
    c.tokens[0]!.progress=13; // move to c:14 (unsafe)
    c.tokens[4]!.progress=1;  // seat 1 c:14
    c.tokens[5]!.progress=1;
    assert.equal(legalMoves(c).find(x=>x.tokenId==='0:0')!.captures,2);
    next=moveLudo(c,'0:0');
    assert.equal(next.tokens[4]!.progress,-1);
    assert.equal(next.tokens[5]!.progress,-1);
    assert.equal(next.activeSeat,0);
    const finish=createLudo(n);
    finish.phase='move';finish.die=2;
    finish.tokens[0]!.progress=F-2;
    finish.tokens[1]!.progress=F;
    finish.tokens[2]!.progress=F;
    finish.tokens[3]!.progress=F;
    next=moveLudo(finish,'0:0');
    assert.equal(next.placements[0]?.seat,0);
    assert.equal(next.placements[0]?.rank,1);
    assert.equal(next.tokens[0]!.progress,F);
    validateLudo(next);
    const over=createLudo(n);over.phase='move';over.die=3;over.tokens[0]!.progress=F-2;
    assert.ok(!legalMoves(over).some(m=>m.tokenId==='0:0'));
    assert.equal(routeFor(n,0)[C-1],'home:0:0');
    assert.equal(nodeFor(next,next.tokens[0]!),'finish:0');
  });
  test('Ludo '+n+' players: fast objective, resign and save round trip',()=>{
    const F=finishProgress(n),s=createLudo(n,undefined,'fast');
    s.phase='move';s.die=1;
    s.tokens[0]!.progress=F-1;s.tokens[1]!.progress=F;
    const done=moveLudo(s,'0:0');
    assert.equal(done.placements[0]?.rank,1);
    assert.equal(done.tokens[2]!.progress,-2);
    assert.equal(done.tokens[3]!.progress,-2);
    validateLudo(done);
    const resigned=resignLudo(done,1);
    assert.equal(resigned.placements.find(p=>p.seat===1)?.rank,n);
    validateLudo(resigned);
    validateLudo(JSON.parse(JSON.stringify(resigned)));
  });
  test('Ludo '+n+' players: AI never selects an illegal token',()=>{
    const state=rollLudo(createLudo(n),6);
    for(const level of ['easy','medium','hard'] as const){
      const id=chooseAiToken(state,level,()=>0.5);
      assert.ok(legalMoves(state).some(x=>x.tokenId===id));
    }
  });
}
test('Ludo rejects unsupported configurations and malformed dice',()=>{
  assert.throws(()=>createLudo(5 as SeatCount),/unsupported/);
  assert.throws(()=>rollLudo(createLudo(4),7),/invalid-die/);
  assert.throws(()=>moveLudo(createLudo(4),'0:0'),/wrong-phase/);
});
test('Ludo unbiased die uses rejection sampling for values 252 through 255',()=>{
  let calls=0;const dice=secureDie(arr=>{arr[0]=calls++===0?255:251;return arr;});
  assert.equal(dice,6);
  assert.equal(calls,2);
});
test('Ludo complete ranking after withdrawals',()=>{
  let state=createLudo(4);
  state=resignLudo(state,1);
  assert.equal(state.placements[0]?.rank,4);
  state=resignLudo(state,2);
  assert.equal(state.placements[1]?.rank,3);
  state=resignLudo(state,3);
  assert.equal(state.phase,'finished');
  assert.equal(state.placements.find(p=>p.seat===0)?.rank,1);
  validateLudo(state);
});
