import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
 BLUEPRINTS, MATERIALS, JOBS, MAX_ISLANDS, SURVIVAL_SAVE_KEY,
 newIsland, blueprintFor, bagCapacity, carried, workerCost, upgradeCost,
 tickIsland, tapCollect, assignWorker, hireWorker, upgradeWorkers, refineBrick,
 remaining, readyToBuild, beginConstruction, finishIsland, sellSurplus, sanitizeIsland,
 type IslandState,
} from '../packages/games/survival-builder/engine.ts';

test('The eight original island blueprints have bounded nonnegative requirements and rewards',()=>{
 assert.equal(BLUEPRINTS.length,MAX_ISLANDS);
 const features=new Set<string>();
 for(let i=1;i<=MAX_ISLANDS;i++){
  const bp=blueprintFor(i);
  assert.equal(bp.id,i);
  assert.ok(bp.reward>=100);
  assert.ok(bp.name.length>=4);
  features.add(bp.feature);
  for(const m of MATERIALS){
   assert.ok(Number.isSafeInteger(bp.requirements[m])&&bp.requirements[m]>=0);
  }
 }
 assert.equal(features.size,MAX_ISLANDS);
 assert.equal(blueprintFor(100).id,MAX_ISLANDS);
 assert.equal(blueprintFor(0).id,1);
 assert.equal(SURVIVAL_SAVE_KEY,'survival-builder-v1');
});
test('Initial island has 4 workers, honest inventory, room for blueprint and no construction',()=>{
 const s=newIsland();
 assert.equal(s.island,1);
 assert.equal(s.workers.length,4);
 assert.equal(s.workers.filter(w=>w.job==='builder').length,1);
 assert.equal(s.phase,'collecting');
 assert.equal(s.totalBuilt,0);
 assert.equal(carried(s),0);
 assert.ok(bagCapacity(s)>=MATERIALS.reduce((v,m)=>v+blueprintFor(1).requirements[m],0));
 assert.equal(beginConstruction(s),false);
});
test('Manual gathering honors storage and never grants money without a valid collection',()=>{
 const s=newIsland();
 s.inventory.coins=0;
 assert.equal(tapCollect(s,'bamboo'),true);
 assert.equal(s.inventory.bamboo,1);
 for(let i=0;i<8;i++)tapCollect(s,'wood');
 assert.equal(s.inventory.coins,5);
 s.inventory.bamboo=bagCapacity(s);
 assert.equal(tapCollect(s,'bamboo'),false);
 assert.equal(s.inventory.coins,5);
});
test('Automatic workers gather while the island runs and making bricks consumes clay',()=>{
 const s=newIsland();
 s.inventory.clay=50;
 s.inventory.coins=200;
 const clayWorker=s.workers.find(w=>w.job==='clay')!;
 const bambooWorker=s.workers.find(w=>w.job==='bamboo')!;
 const initialWood=s.inventory.wood;
 for(let i=0;i<40;i++)tickIsland(s,.25);
 assert.ok(s.inventory.bamboo>0);
 assert.ok(s.inventory.wood>initialWood);
 assert.ok(s.inventory.clay>=50);
 assert.ok(bambooWorker.experience>0);
 assert.equal(assignWorker(s,clayWorker.id,'brick'),true);
 const previousClay=s.inventory.clay;
 for(let i=0;i<40;i++)tickIsland(s,.25);
 assert.ok(s.inventory.brick>0);
 assert.equal(s.inventory.clay,previousClay-s.inventory.brick*2);
 assert.equal(refineBrick(s),true);
});
test('Hiring and upgrading spend coins once, enforce caps and validate worker jobs',()=>{
 const s=newIsland();s.inventory.coins=2000;
 const cost=workerCost(s);
 assert.equal(hireWorker(s),true);
 assert.equal(s.workers.length,5);
 assert.equal(s.inventory.coins,2000-cost);
 const nextId=s.workers.at(-1)!.id;
 assert.equal(assignWorker(s,nextId,'stone'),true);
 assert.equal(s.workers.at(-1)!.job,'stone');
 assert.equal(assignWorker(s,nextId,'hacker' as 'stone'),false);
 assert.equal(assignWorker(s,-1,'wood'),false);
 assert.ok(JOBS.includes('builder'));
 const before=s.productivity;
 const upgrade=upgradeCost(s);
 assert.equal(upgradeWorkers(s),true);
 assert.ok(s.productivity>before);
 assert.equal(s.inventory.coins,2000-cost-upgrade);
 for(let i=0;i<20;i++)hireWorker(s);
 assert.ok(s.workers.length<=12);
});
test('The player must collect every required material, then construction spends it once',()=>{
 const s=newIsland();
 const bp=blueprintFor(1);
 for(const m of MATERIALS)s.inventory[m]=bp.requirements[m];
 s.inventory.bamboo--;
 assert.equal(readyToBuild(s),false);
 assert.equal(remaining(s,'bamboo'),1);
 s.inventory.bamboo++;
 assert.equal(readyToBuild(s),true);
 const before={...s.inventory};
 assert.equal(beginConstruction(s),true);
 assert.equal(beginConstruction(s),false);
 assert.equal(s.phase,'building');
 assert.equal(s.buildProgress,0);
 for(const m of MATERIALS)assert.equal(s.inventory[m],before[m]-bp.requirements[m]);
 let guard=0;
 while(s.phase==='building' && guard++<250)tickIsland(s,.8);
 assert.equal(s.phase,'completed');
 assert.equal(s.buildProgress,100);
 assert.equal(s.inventory.coins,before.coins+bp.reward);
 assert.equal(s.totalBuilt,1);
 assert.deepEqual(s.builtHistory,[1]);
 tickIsland(s,1);
 assert.equal(s.inventory.coins,before.coins+bp.reward);
 assert.equal(finishIsland(s),true);
 assert.equal(s.island,2);
});
test('Every blueprint can be funded and completed; island 8 is final and cannot advance',()=>{
 const s=newIsland();
 for(let level=1;level<=MAX_ISLANDS;level++){
  assert.equal(s.island,level);
  const bp=blueprintFor(level);
  assert.ok(bagCapacity(s)>=MATERIALS.reduce((sum,m)=>sum+bp.requirements[m],0));
  for(const m of MATERIALS)s.inventory[m]=bp.requirements[m];
  assert.ok(readyToBuild(s));
  assert.equal(beginConstruction(s),true);
  for(let i=0;i<170&&s.phase==='building';i++)tickIsland(s,1);
  assert.equal(s.phase,'completed','island '+level+' must finish');
  assert.ok(s.builtHistory.includes(level));
  if(level===MAX_ISLANDS)assert.equal(finishIsland(s),false);
  else assert.equal(finishIsland(s),true);
 }
 assert.equal(s.totalBuilt,MAX_ISLANDS);
 assert.equal(s.bestIsland,MAX_ISLANDS);
 assert.equal(s.island,MAX_ISLANDS);
});
test('No instant closed-app simulation and invalid timestep is rejected',()=>{
 const s=newIsland();
 assert.throws(()=>tickIsland(s,2),RangeError);
 assert.throws(()=>tickIsland(s,-1),RangeError);
 assert.throws(()=>tickIsland(s,Number.NaN),RangeError);
 assert.equal(tickIsland(s,0),s);
 assert.equal(s.elapsed,0);
});
test('Selling resources cannot consume the blueprint reserve or operate during building',()=>{
 const s=newIsland();
 const need=blueprintFor(1).requirements.bamboo;
 s.inventory.bamboo=need+9;
 assert.equal(sellSurplus(s,'bamboo',10),false);
 assert.equal(sellSurplus(s,'bamboo',5),true);
 assert.equal(s.inventory.bamboo,need+4);
 s.phase='building';
 assert.equal(sellSurplus(s,'bamboo',1),false);
 assert.equal(sellSurplus(s,'brick',-50),false);
});
test('Saved worlds ignore unsupported jobs, duplicate worker ids, NaN and corrupted inventory',()=>{
 const initial=newIsland();
 assert.deepEqual(sanitizeIsland(null),initial);
 assert.deepEqual(sanitizeIsland('bad'),initial);
 const saved=sanitizeIsland({island:7,bestIsland:9,phase:'building',buildProgress:78,
  inventory:{bamboo:20,wood:NaN,clay:-2,stone:'100',coins:400},
  workers:[{id:5,job:'builder',experience:300,phase:.4},
   {id:5,job:'builder'},{id:2,job:'malware'}],builtHistory:[1,1,2,200]});
 assert.equal(saved.island,7);
 assert.equal(saved.bestIsland,8);
 assert.equal(saved.inventory.wood,0);
 assert.equal(saved.inventory.clay,0);
 assert.equal(saved.inventory.stone,0);
 assert.equal(saved.inventory.coins,400);
 assert.equal(saved.workers.length,1);
 assert.equal(saved.workers[0]!.id,5);
 assert.deepEqual(saved.builtHistory,[1,2]);
 assert.ok(saved.nextWorkerId>5);
 assert.equal(saved.buildProgress,78);
});
