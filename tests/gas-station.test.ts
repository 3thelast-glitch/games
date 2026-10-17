import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOfflineEarnings,buyFacility,buyStaff,buyUpgrade,captureGas,claimMission,clearJunk,
  FACILITIES,facilityCost,GAS_SAVE_KEY,initialDebris,interactCar,isNear,JOBS,
  MISSIONS,moveTo,newGasStation,restock,restoreGas,
  startRace,TARGETS,tickGas,upgradeCost,UPGRADES,workerCost,workGarage,
} from '../packages/games/gas-station/engine.ts';

test('Gas Station starts abandoned with a single pump, fuel, repair parts and debris',()=>{
 const s=newGasStation();
 assert.equal(s.cash,180);assert.equal(s.fuel,125);assert.equal(s.facilities.pump,1);
 assert.equal(s.facilities.shop,0);assert.equal(s.facilities.garage,0);
 assert.ok(s.debris.length>=15);
 assert.deepEqual(s.debris,initialDebris());
 assert.equal(GAS_SAVE_KEY,'gas-station-roadside-v1');
 assert.equal(FACILITIES.length,5);assert.equal(JOBS.length,4);assert.equal(UPGRADES.length,5);
});
test('WASD path targets are clamped and the character moves toward them',()=>{
 const s=newGasStation();const start={...s.player};
 assert.equal(moveTo(s,Infinity,20),false);
 assert.equal(moveTo(s,-10,-400),true);
 assert.equal(s.player.tx,22);assert.equal(s.player.ty,72);
 tickGas(s,.5);
 assert.ok(s.player.x<start.x);assert.ok(s.player.y<start.y);
 assert.ok(isNear(s,s.player));
});
test('Junk cleaning requires proximity and correct number of actions, then pays once',()=>{
 const s=newGasStation();const item=s.debris[2]!;
 assert.equal(clearJunk(s,item.id),false);
 moveTo(s,item.x,item.y);
 for(let i=0;i<8;i++)tickGas(s,.8);
 assert.ok(isNear(s,item,72));
 const money=s.cash;
 const hits=item.durability;
 for(let i=0;i<hits;i++)assert.equal(clearJunk(s,item.id),true);
 assert.equal(item.cleared,true);
 assert.ok(s.cash>money);
 const after=s.cash;
 assert.equal(clearJunk(s,item.id),false);
 assert.equal(s.cash,after);
 assert.equal(s.missions.cleanup,1);
});
test('Facility expansion checks minimum level, price, ownership limits and progress',()=>{
 const s=newGasStation();s.cash=10000;
 assert.equal(buyFacility(s,'shop'),false,'shop should be locked below level 3');
 s.level=8;
 const price=facilityCost(s,'shop');
 assert.equal(buyFacility(s,'shop'),true);
 assert.equal(s.cash,10000-price);
 assert.equal(buyFacility(s,'shop'),false,'store only bought once');
 assert.equal(buyFacility(s,'wash'),true);
 assert.equal(buyFacility(s,'garage'),true);
 assert.equal(buyFacility(s,'tires'),true);
 assert.equal(buyFacility(s,'pump'),true);
 assert.equal(buyFacility(s,'pump'),true);
 assert.equal(buyFacility(s,'pump'),false,'maximum 3');
 assert.ok(s.missions.expansion>=6);
});
test('Fuel stock and retail restocking charge exact cash and enforce capacity',()=>{
 const s=newGasStation();s.cash=3000;
 const before=s.fuel;
 assert.equal(restock(s,'fuel',50),true);
 assert.equal(s.fuel,before+50);
 const after=s.cash;
 assert.equal(restock(s,'fuel',35),false);
 assert.equal(s.cash,after);
 assert.equal(restock(s,'goods',20),true);
 assert.equal(restock(s,'goods',20),false,'shelves have finite capacity');
 assert.equal(restock(s,'parts',20),true);
 assert.ok(s.parts>6);
});
test('Technological upgrades increase limits and worker purchases require opened facilities',()=>{
 const s=newGasStation();s.cash=10000;
 assert.equal(buyStaff(s,'cashier'),false);
 const cost=upgradeCost(s,'tankSize');
 assert.equal(buyUpgrade(s,'tankSize'),true);
 assert.equal(s.cash,10000-Math.ceil(cost));
 assert.equal(s.maxFuel,330);assert.equal(s.maxGoods,38);
 s.level=10;assert.equal(buyFacility(s,'shop'),true);
 const costWorker=workerCost(s);
 assert.equal(buyStaff(s,'cashier'),true);
 assert.equal(s.staff.length,1);
 assert.equal(s.cash,10000-Math.ceil(cost)-facilityCost(newGasStation(),'shop')-costWorker);
 for(let i=0;i<9;i++)buyStaff(s,'fuel');
 assert.ok(s.staff.length<=9);
});
test('Car servicing consumes fuel only on completion, gives XP and coins',()=>{
 const s=newGasStation();
 tickGas(s,3);
 const car=s.cars.find(c=>c.facility==='pump')!;
 assert.ok(car);
 assert.equal(interactCar(s,car.id),false,'character is too far away initially');
 moveTo(s,car.x,car.y);
 for(let i=0;i<8;i++)tickGas(s,.8);
 assert.equal(interactCar(s,car.id),true);
 assert.equal(car.status,'servicing');
 const fuel=s.fuel,coin=s.cash;
 for(let i=0;i<10;i++)tickGas(s,.8);
 assert.equal(car.status,'done');
 assert.equal(s.fuel,fuel-car.needs);
 assert.ok(s.cash>coin);
 assert.equal(s.missions.fuel,1);
 assert.equal(s.served,1);
});
test('Garage repair has real three-step flow and requires spare parts',()=>{
 const s=newGasStation();s.level=10;s.cash=10000;
 assert.equal(buyFacility(s,'garage'),true);
 const car={id:900,type:'van' as const,facility:'garage' as const,bay:0,
 status:'waiting' as const,x:TARGETS.garage.x,y:TARGETS.garage.y,
 color:'#ddd',patience:45,amount:0,progress:0,needs:3,reward:100,event:false,condition:1};
 s.cars=[car];moveTo(s,car.x,car.y);
 for(let i=0;i<8;i++)tickGas(s,.8);
 assert.equal(workGarage(s),true);assert.equal(s.garageStep,'parts');
 s.parts=0;assert.equal(workGarage(s),false);
 assert.equal(restock(s,'parts',20),true);
 assert.equal(workGarage(s),true);assert.equal(s.garageStep,'repair');
 const money=s.cash;assert.equal(workGarage(s),true);
 assert.ok(s.cash>money);assert.equal(s.missions.repair,1);
 assert.equal(s.cars[0]?.status,'done');
});
test('Employees automatically fuel and serve, preserving server-free local economics',()=>{
 const s=newGasStation();s.cash=10000;
 assert.equal(buyStaff(s,'fuel'),true);
 const before=s.served;
 for(let i=0;i<90;i++)tickGas(s,.8);
 assert.ok(s.served>before);
 assert.ok(s.totalIncome>0);
 assert.ok(s.fuel>=0);
});
test('Customers become impatient and can leave without illegitimate revenue',()=>{
 const s=newGasStation();tickGas(s,3);
 const car=s.cars[0]!;
 assert.ok(car);
 const cash=s.cash;car.patience=.01;
 tickGas(s,.1);
 assert.equal(s.missed,1);
 assert.equal(s.cash,cash);
 assert.equal(s.cars.some(c=>c.id===car.id),false);
});
test('Event races unlock at level five and goals are tracked separately',()=>{
 const s=newGasStation();
 assert.equal(startRace(s),false);
 s.level=5;
 assert.equal(startRace(s),true);
 assert.equal(startRace(s),false);
 assert.ok(s.event.active);assert.equal(s.event.goal,3);
 s.event.time=.2;
 tickGas(s,.3);
 assert.equal(s.event.active,false);
});
test('Missions only pay when completed and cannot be claimed twice',()=>{
 const s=newGasStation();
 assert.equal(claimMission(s,'cleanup'),false);
 s.missions.cleanup=MISSIONS.cleanup.target;
 const cash=s.cash;
 assert.equal(claimMission(s,'cleanup'),true);
 assert.equal(s.cash,cash+MISSIONS.cleanup.reward);
 assert.equal(claimMission(s,'cleanup'),false);
 assert.equal(s.claimed.length,1);
});
test('Idle payout is capped and never grants money on a new unsaved playthrough',()=>{
 const s=newGasStation();
 assert.equal(applyOfflineEarnings(s,Date.now(),0),0);
 const before=s.cash;
 assert.ok(applyOfflineEarnings(s,2e10,2e10-10*3600*1000)<=2200);
 assert.ok(s.cash>=before);
 s.cash=0;
 assert.equal(applyOfflineEarnings(s,1e9,1e9+1000),0);
});
test('Saved business retains safe progress but not stale waiting cars, event timers or movement',()=>{
 const s=newGasStation();s.level=9;s.cash=15000;
 assert.equal(buyFacility(s,'garage'),true);
 assert.equal(buyStaff(s,'mechanic'),true);
 s.player.x=501;s.player.y=410;s.player.tx=50;s.player.ty=90;
 const snapshot=captureGas(s,123456789);
 assert.equal(snapshot.version,1);
 assert.equal(snapshot.state.cars.length,0);
 assert.equal(snapshot.state.player.tx,null);
 const revived=restoreGas(snapshot);
 assert.equal(revived.savedAt,123456789);
 assert.equal(revived.state.level,9);
 assert.equal(revived.state.cash,s.cash);
 assert.equal(revived.state.staff.length,1);
 assert.equal(revived.state.player.x,501);
 assert.equal(revived.state.garageStep,'diagnose');
 assert.equal(revived.state.cars.length,0);
});
test('Corrupted save input ignores dangerous values and restores defaults',()=>{
 assert.deepEqual(restoreGas(null).state,newGasStation());
 const bad=restoreGas({version:1,savedAt:NaN,state:{
  cash:Infinity,fuel:999999999,level:'56',facilities:{pump:99,garage:-4},
  staff:[{id:1,job:'invalid'}],claimed:['fake','cleanup','cleanup'],
  reputation:-99,player:{x:Infinity,y:-999}
 }});
 assert.equal(bad.state.cash,180);
 assert.equal(bad.state.fuel,240);
 assert.equal(bad.state.level,1);
 assert.equal(bad.state.facilities.pump,3);
 assert.equal(bad.state.facilities.garage,0);
 assert.equal(bad.state.staff.length,0);
 assert.deepEqual(bad.state.claimed,['cleanup']);
 assert.equal(bad.state.player.x,470);
 assert.equal(bad.state.player.y,70);
});
