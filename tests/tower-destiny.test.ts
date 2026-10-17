import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  addFloor,aimDefense,armorCost,captureDefense,clearAim,continueDefense,
  enemyCount,FIXED_DT,isBossStage,launchDefense,MAX_STAGE,newDefense,powerCost,
  readDefenseProgress,retryDefense,specialDefense,speedCost,tickDefense,
  upgradeDefense,upgradeFloor,WEAPONS,weaponCost,weaponUpgradeCost,
} from '../packages/games/tower-destiny/engine.ts';

test('tower defense defaults to a ready rolling cart with a roof hero, weapon and savings',()=>{
  const s=newDefense();
  assert.equal(s.stage,1);assert.equal(s.coins,140);
  assert.equal(s.phase,'ready');assert.equal(s.modules.length,1);
  assert.equal(s.modules[0]?.weapon,'rifle');
  assert.ok(s.hull>=100);
  assert.equal(s.hull,s.maxHull);
  assert.equal(s.enemies.length,0);
  assert.equal(s.targetCount,enemyCount(1));
  assert.equal(launchDefense(s),true);
  assert.equal(s.phase,'battle');
  assert.equal(launchDefense(s),false);
});
test('stages include bosses every fifth round and progressive wave sizes',()=>{
  for(let n=1;n<=MAX_STAGE;n++){
    const state=newDefense({stage:n});
    assert.equal(state.stage,n);
    assert.equal(state.targetCount,8+Math.min(24,2*n));
    assert.equal(isBossStage(n),n%5===0);
    assert.ok(state.maxHull>=150);
  }
});
test('weapons/floors consume exact coins, lock during battle and use a five floor cap',()=>{
  const s=newDefense();
  s.coins=10000;
  const initial=s.coins;
  const buy=weaponCost(s);
  assert.equal(addFloor(s,'flame'),true);
  assert.equal(s.coins,initial-buy);
  assert.equal(s.modules[1]?.weapon,'flame');
  const levelCost=weaponUpgradeCost(s,0);
  assert.equal(upgradeFloor(s,0),true);
  assert.equal(s.modules[0]?.level,2);
  assert.equal(s.coins,initial-buy-levelCost);
  for(const weapon of ['saw','laser','rifle'] as const)assert.equal(addFloor(s,weapon),true);
  assert.equal(s.modules.length,5);
  assert.equal(addFloor(s,'flame'),false);
  assert.equal(addFloor(s,'invalid' as 'flame'),false);
  assert.equal(upgradeFloor(s,5),false);
  assert.equal(upgradeFloor(s,-1),false);
  launchDefense(s);
  assert.equal(upgradeFloor(s,0),false);
  assert.equal(addFloor(s,'laser'),false);
});
test('permanent tech upgrades repair hull and spend coins only once',()=>{
  const s=newDefense();s.coins=5000;
  const origHull=s.maxHull,origMoney=s.coins;
  const armor=armorCost(s),power=powerCost(s),speed=speedCost(s);
  assert.equal(upgradeDefense(s,'armor'),true);
  assert.equal(s.maxHull,origHull+32);
  assert.equal(upgradeDefense(s,'speed'),true);
  assert.equal(upgradeDefense(s,'power'),true);
  assert.equal(s.coins,origMoney-armor-power-speed);
  assert.equal(s.armorTech,1);assert.equal(s.speedTech,1);assert.equal(s.tech,1);
  launchDefense(s);
  assert.equal(upgradeDefense(s,'armor'),false);
});
test('zombie waves spawn, auto-target and award coin loot on defeats',()=>{
  const s=newDefense();s.targetCount=1;s.modules[0]!.level=6;s.tech=12;
  const init=s.coins;
  launchDefense(s);
  for(let i=0;i<60*30&&s.phase==='battle';i++)tickDefense(s);
  assert.equal(s.spawned,1);
  assert.equal(s.phase,'won');
  assert.equal(s.kills,1);
  assert.ok(s.coins>init);
  assert.ok(s.totalKills>=1);
  assert.ok(s.effects.every(e=>Number.isFinite(e.life)));
});
test('boss stages spawn a special durable enemy after the regular wave',()=>{
  const s=newDefense({stage:5,coins:200});
  s.targetCount=0;
  launchDefense(s);
  tickDefense(s);
  assert.equal(s.bossSpawned,true);
  assert.ok(s.enemies.some(e=>e.kind==='boss'&&e.maxHp>500));
  assert.equal(s.event,'boss');
});
test('drag aiming selects a nearby active enemy and release resets manual target',()=>{
  const s=newDefense();
  assert.equal(aimDefense(s,260,400),false);
  launchDefense(s);tickDefense(s);
  const e=s.enemies[0]!;
  assert.equal(aimDefense(s,e.x,e.y),true);
  assert.equal(s.selectedTarget,e.id);
  assert.ok(s.aim);
  clearAim(s);
  assert.equal(s.selectedTarget,null);assert.equal(s.aim,null);
  assert.equal(aimDefense(s,NaN,Infinity),false);
});
test('energy specials reject empty energy, repair damaged hull and blast zombie clusters',()=>{
  const s=newDefense();launchDefense(s);tickDefense(s);
  s.energy=0;
  assert.equal(specialDefense(s,'blast'),false);
  assert.equal(specialDefense(s,'repair'),false);
  s.energy=100;s.hull-=55;
  const before=s.hull;
  assert.equal(specialDefense(s,'repair'),true);
  assert.ok(s.hull>before);
  assert.ok(s.hull<=s.maxHull);
  assert.equal(specialDefense(s,'repair'),false);
  s.energy=100;
  const enemy=s.enemies[0]!;
  const previous=enemy.hp;
  assert.equal(specialDefense(s,'blast'),true);
  assert.ok(enemy.hp<previous || !enemy.alive);
  s.energy=100;
  assert.equal(specialDefense(s,'overdrive'),true);
  assert.ok(s.energy<100);
});
test('tower loses if undefended mobs reach the hull, and retry keeps coins',()=>{
  const s=newDefense();
  s.modules=[];s.heroClock=10000;s.targetCount=3;s.hull=5;
  assert.equal(launchDefense(s),true);
  for(let i=0;i<60*35 && s.phase==='battle';i++)tickDefense(s);
  assert.equal(s.phase,'lost');
  s.coins+=100;
  const reset=retryDefense(s);
  assert.equal(reset.phase,'ready');assert.equal(reset.coins,s.coins);
  assert.equal(reset.stage,s.stage);
  assert.equal(retryDefense(reset),reset);
});
test('winning advances a stage, persists upgrades and can replay the final stage',()=>{
  const s=newDefense({stage:3,coins:900,tech:2});
  s.phase='won';s.coins=2000;
  const next=continueDefense(s);
  assert.equal(next.stage,4);assert.equal(next.phase,'ready');
  assert.equal(next.coins,2000);assert.equal(next.tech,2);
  assert.equal(next.bestStage,4);
  const final=newDefense({stage:MAX_STAGE});
  final.phase='won';
  assert.equal(continueDefense(final).stage,MAX_STAGE);
});
test('invalid deltas cannot advance battle physics, and saved records are sanitized',()=>{
  const s=newDefense();launchDefense(s);
  assert.throws(()=>tickDefense(s,NaN),RangeError);
  assert.throws(()=>tickDefense(s,.2),RangeError);
  assert.throws(()=>tickDefense(s,-1),RangeError);
  assert.equal(FIXED_DT,1/60);
  const saved=captureDefense(s);
  assert.deepEqual(readDefenseProgress(saved),saved);
  const bad=readDefenseProgress({stage:NaN,coins:-20,bestStage:Infinity,
    modules:[{weapon:'hack',level:99},{weapon:'flame',level:20},{weapon:'flame',level:0}],
    tech:'5',speedTech:999,armorTech:NaN,totalKills:123});
  assert.equal(bad.stage,1);assert.equal(bad.coins,0);assert.equal(bad.tech,0);
  assert.equal(bad.speedTech,20);assert.equal(bad.totalKills,123);
  assert.equal(bad.modules.length,2);
  assert.deepEqual(bad.modules.map(m=>m.level),[20,1]);
  assert.equal(readDefenseProgress(null).modules.length,1);
  assert.equal(WEAPONS.length,4);
});
