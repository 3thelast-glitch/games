import test from 'node:test';
import assert from 'node:assert/strict';
import { aiTurn, attack, at, capture, createBattle, finishTurn, move, moves, siteAt, targets, train } from '../packages/games/naqla-tactics/engine.ts';

test('three campaign maps initialize with different terrain and balanced teams',()=>{
 const maps=[0,1,2].map(i=>createBattle(i));assert.equal(new Set(maps.map(m=>m.tiles.join('/'))).size,3);
 for(const m of maps){assert.equal(m.tiles.length,8);assert.ok(m.units.some(u=>u.side===1));assert.ok(m.units.some(u=>u.side===2));}
});
test('movement options are valid, in bounds, and exclude occupied or water tiles',()=>{
 const s=createBattle(),u=s.units.find(u=>u.side===1&&u.kind==='infantry')!;
 const options=moves(s,u.id);assert.ok(options.length>0);
 for(const p of options){assert.ok(p.x>=0&&p.x<10&&p.y>=0&&p.y<8);assert.notEqual(s.tiles[p.y][p.x],'~');assert.equal(at(s,p.x,p.y),undefined);}
});
test('illegal moves, friendly fire, and out-of-range attacks are rejected',()=>{
 const s=createBattle(),own=s.units.find(u=>u.side===1)!;
 assert.throws(()=>move(s,own.id,9,0));
 assert.throws(()=>attack(s,own.id,s.units.find(u=>u.side===1&&u.id!==own.id)!.id));
 assert.equal(targets(s,own.id).length,0);
});
test('legal moves consume movement and cannot be repeated',()=>{
 const s=createBattle(),unit=s.units.find(u=>u.side===1&&u.kind==='scout')!;
 const p=moves(s,unit.id)[0];move(s,unit.id,p.x,p.y);
 assert.equal(unit.moved,true);assert.throws(()=>move(s,unit.id,p.x,p.y));
});
test('turn handoff grants income and resets active team',()=>{
 const s=createBattle(0,'local'),gold=s.gold[2];finishTurn(s);
 assert.equal(s.turn,2);assert.ok(s.gold[2]>gold);finishTurn(s);assert.equal(s.round,2);
});
test('units can only recruit at an empty friendly base with enough credits',()=>{
 const s=createBattle(0,'local');const base=s.sites.find(p=>p.kind==='base'&&p.side===1)!;
 train(s,'infantry',base.x,base.y);assert.ok(at(s,base.x,base.y));
 assert.throws(()=>train(s,'infantry',base.x,base.y));
});
test('infantry captures an opposing base and wins',()=>{
 const s=createBattle(0,'local'),unit=s.units.find(u=>u.side===1&&u.kind==='infantry')!,base=s.sites.find(p=>p.kind==='base'&&p.side===2)!;
 unit.x=base.x;unit.y=base.y;capture(s,unit.id);
 assert.equal(siteAt(s,base.x,base.y)?.side,1);assert.equal(s.winner,1);
});
test('scout cannot capture a city',()=>{
 const s=createBattle(0,'local'),scout=s.units.find(u=>u.side===1&&u.kind==='scout')!,city=s.sites.find(p=>p.kind==='city')!;
 scout.x=city.x;scout.y=city.y;assert.throws(()=>capture(s,scout.id));
});
test('computer only acts during its turn and ends its turn',()=>{
 const s=createBattle();assert.equal(aiTurn(s).turn,1);finishTurn(s);assert.equal(s.turn,2);
 aiTurn(s);assert.ok(s.winner!==0||Number(s.turn)===1);
});