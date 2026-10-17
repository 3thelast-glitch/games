import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  circuitSize, createLudo, finishProgress, isSafe, legalMoves, moveLudo,
  nodeFor, resignLudo, rollLudo, routeFor, secureDie, validateLudo,
  chooseAiToken, tokensPerSeat, restoreLudo, type SeatCount,
} from '../packages/games/ludo/engine.ts';

const counts: SeatCount[] = [4,6,8,10];

for (const n of counts) {
  const slots=tokensPerSeat(n);
  test('Ludo '+n+' players: topologies, base slots, rotation, safe nodes', () => {
    const state=createLudo(n);
    assert.equal(circuitSize(n),13*n);
    assert.equal(state.tokens.length,slots*n);
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
      assert.equal(state.tokens.filter(t=>t.seat===s).length,slots);
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
    assert.equal(legalMoves(first).length,slots);
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
    s.tokens[0]!.progress=12; // destination c:13 is the next player's protected entry
    const enemyOne=s.tokens.find(t=>t.seat===1)!;
    enemyOne.progress=0;
    assert.equal(legalMoves(s).find(x=>x.tokenId==='0:0')!.captures,0);
    let next=moveLudo(s,'0:0');
    assert.equal(next.tokens.find(t=>t.id==='1:0')!.progress,0);
    const c=createLudo(n);
    c.phase='move';c.die=1;
    c.tokens[0]!.progress=13; // destination c:14 is unsafe
    const firstEnemy=c.tokens.find(t=>t.seat===1)!;
    const secondEnemy=c.tokens.find(t=>t.id===(slots>1?'1:1':'2:0'))!;
    firstEnemy.progress=1;
    secondEnemy.progress=(14-13*secondEnemy.seat+C)%C;
    assert.equal(legalMoves(c).find(x=>x.tokenId==='0:0')!.captures,2);
    next=moveLudo(c,'0:0');
    assert.equal(next.tokens.find(t=>t.id===firstEnemy.id)!.progress,-1);
    assert.equal(next.tokens.find(t=>t.id===secondEnemy.id)!.progress,-1);
    assert.equal(next.activeSeat,0);
    const finish=createLudo(n);
    finish.phase='move';finish.die=2;
    const owned=finish.tokens.filter(t=>t.seat===0);
    owned[0]!.progress=F-2;
    for(const pawn of owned.slice(1)) pawn.progress=F;
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
    const F=finishProgress(n),state=createLudo(n,undefined,'fast');
    state.phase='move';state.die=1;
    const owned=state.tokens.filter(t=>t.seat===0);
    owned[0]!.progress=F-1;
    if(slots>1) owned[1]!.progress=F;
    const done=moveLudo(state,'0:0');
    assert.equal(done.placements[0]?.rank,1);
    assert.equal(done.tokens[0]!.progress,F);
    if(slots>2) assert.ok(done.tokens.filter(t=>t.seat===0).slice(2).every(t=>t.progress===-2));
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

test('A resignation by an inactive seat does not replace the current die',()=>{
  const pending=rollLudo(createLudo(6),6);
  const next=resignLudo(pending,4);
  assert.equal(next.activeSeat,pending.activeSeat);
  assert.equal(next.phase,'move');
  assert.equal(next.die,6);
  assert.deepEqual(legalMoves(next),legalMoves(pending));
  validateLudo(next);
});

test('Ludo visual board variants use a valid pawn quota and preserve old four/six-player saves',()=>{
  assert.deepEqual(counts.map(n=>tokensPerSeat(n)),[4,4,2,1]);
  assert.deepEqual(counts.map(n=>createLudo(n).tokens.length),[16,24,16,10]);
  for(const n of [4,6] as const){
    const saved={...createLudo(n),schemaVersion:1};
    const migrated=restoreLudo(saved);
    assert.equal(migrated.schemaVersion,2);
    assert.deepEqual(migrated.tokens,saved.tokens);
    validateLudo(migrated);
  }
  const oldGrand={...createLudo(10),schemaVersion:1};
  assert.throws(()=>restoreLudo(oldGrand),/legacy-board-requires-new-match/);
  const saved=JSON.parse(JSON.stringify(createLudo(8)));
  assert.equal(restoreLudo(saved).tokens.length,16);
});
