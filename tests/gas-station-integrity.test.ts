import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 applyOfflineEarnings,availableServiceStock,buyFacility,buyStaff,captureGas,dismissStaff,
 interactCar,newGasStation,restock,restoreGas,startRace,tickGas,workGarage,
 TARGETS,type Vehicle,type Facility,
} from '../packages/games/gas-station/engine.ts';

const waiting=(id:number,facility:Facility='pump',bay=0,needs=18):Vehicle=>({
 id,type:'sedan',facility,bay,status:'waiting',x:300+bay*117,
 y:355,color:'#55c46d',patience:48,amount:0,progress:0,needs,
 reward:facility==='pump'?86:facility==='wash'?64:110,event:false,condition:1,
});
test('Only one in-progress car is assigned to each employee',()=>{
 const s=newGasStation();s.cash=10000;s.facilities.pump=2;s.spawnClock=99;
 assert.equal(buyStaff(s,'fuel'),true);
 s.cars=[waiting(200),waiting(201,'pump',1)];
 tickGas(s,.1);
 assert.equal(s.cars.filter(c=>c.status==='servicing').length,1);
 assert.equal(s.cars.filter(c=>c.status==='waiting').length,1);
 assert.equal(s.cars.find(c=>c.status==='servicing')?.actorId,s.staff[0]?.id);
 tickGas(s,.1);
 assert.equal(s.cars.filter(c=>c.status==='servicing').length,1);
});
test('Running fuel orders reserve inventory for the other bays until payment',()=>{
 const s=newGasStation();s.facilities.pump=2;s.fuel=18;s.spawnClock=99;
 s.cars=[waiting(200),waiting(201,'pump',1)];
 s.player.x=300;s.player.y=355;
 assert.equal(interactCar(s,200),true);
 assert.equal(availableServiceStock(s,'pump'),0);
 s.player.x=417;
 assert.equal(interactCar(s,201),false);
 for(let i=0;i<7;i++)tickGas(s,.8);
 assert.equal(s.fuel,0);
 assert.equal(s.missions.fuel,1);
 assert.equal(s.cars.find(c=>c.id===201)?.status,'waiting');
 assert.equal(availableServiceStock(s,'pump'),0);
});
test('Spawned fuel cars do not reuse occupied bay indices',()=>{
 const s=newGasStation();s.facilities.pump=2;
 s.spawnClock=.01;tickGas(s,.1);
 s.spawnClock=.01;tickGas(s,.1);
 assert.deepEqual(s.cars.map(c=>c.bay).sort(),[0,1]);
 s.spawnClock=.01;tickGas(s,.1);
 assert.equal(s.cars.length,2);
});
test('Washing consumes real soap, requires refills and never goes negative',()=>{
 const s=newGasStation();s.level=10;s.cash=10000;
 assert.equal(buyFacility(s,'wash'),true);
 assert.equal(s.soap,3);
 s.spawnClock=99;
 s.player.x=TARGETS.wash.x;s.player.y=TARGETS.wash.y;
 for(let i=0;i<3;i++){
  s.cars=[{...waiting(300+i,'wash',0,4),x:TARGETS.wash.x,y:TARGETS.wash.y}];
  assert.equal(interactCar(s,300+i),true);
  for(let j=0;j<7;j++)tickGas(s,.8);
  assert.equal(s.soap,2-i);
 }
 s.cars=[{...waiting(400,'wash',0,4),x:TARGETS.wash.x,y:TARGETS.wash.y}];
 assert.equal(interactCar(s,400),false);
 assert.equal(s.soap,0);
 assert.equal(restock(s,'soap',20),true);
 assert.equal(interactCar(s,400),true);
});
test('Manual garage step and parked vehicle survive a save/restore',()=>{
 const s=newGasStation();s.level=10;s.cash=10000;
 assert.equal(buyFacility(s,'garage'),true);
 s.cars=[{...waiting(400,'garage',0,3),x:TARGETS.garage.x,y:TARGETS.garage.y}];
 s.player.x=TARGETS.garage.x;s.player.y=TARGETS.garage.y;
 assert.equal(workGarage(s),true);
 assert.equal(s.garageStep,'parts');
 const saved=captureGas(s,100000);
 assert.equal(saved.state.cars.length,1);
 const restored=restoreGas(saved).state;
 assert.equal(restored.garageStep,'parts');
 assert.equal(restored.garageCar,400);
 assert.equal(restored.cars[0]?.status,'waiting');
 assert.equal(workGarage(restored),true);
 assert.equal(workGarage(restored),true);
 assert.equal(restored.missions.repair,1);
});
test('In-progress race challenge persists remaining active time and cars',()=>{
 const s=newGasStation();s.level=5;
 assert.equal(startRace(s),true);
 tickGas(s,.5);
 const remaining=s.event.time;
 const restored=restoreGas(captureGas(s,123456789));
 assert.equal(restored.state.event.active,true);
 assert.equal(restored.state.event.goal,3);
 assert.equal(restored.state.event.time,remaining);
 assert.equal(restored.state.cars.length,s.cars.length);
 tickGas(restored.state,.25);
 assert.ok(restored.state.event.time<remaining);
});
test('Unstaffed sites and empty inventory earn nothing offline; settlement is idempotent',()=>{
 const s=newGasStation();
 assert.equal(applyOfflineEarnings(s,600000,300000),0);
 s.cash=10000;assert.equal(buyStaff(s,'fuel'),true);
 s.fuel=18;
 const baseline={cash:s.cash,fuel:s.fuel,served:s.served,missions:s.missions.fuel};
 assert.equal(applyOfflineEarnings(s,1200000,900000),86);
 assert.equal(s.fuel,0);
 assert.equal(s.cash,baseline.cash+86);
 assert.equal(s.served,baseline.served);
 assert.equal(s.missions.fuel,baseline.missions);
 assert.equal(applyOfflineEarnings(s,1200000,900000),0);
 assert.equal(s.cash,baseline.cash+86);
 const restored=restoreGas(captureGas(s,1200000)).state;
 assert.equal(restored.offlineSettledAt,900000);
 assert.equal(applyOfflineEarnings(restored,1800000,1200000),0);
});
test('Staffed facilities consume their own inventory in capped offline simulation',()=>{
 const s=newGasStation();s.level=10;s.cash=10000;
 assert.equal(buyFacility(s,'shop'),true);
 assert.equal(buyFacility(s,'wash'),true);
 assert.equal(buyStaff(s,'cashier'),true);
 assert.equal(buyStaff(s,'wash'),true);
 s.goods=2;s.soap=1;
 const result=applyOfflineEarnings(s,2200000,1000000);
 assert.equal(result,2*20+64);
 assert.equal(s.goods,0);assert.equal(s.soap,0);
 assert.equal(s.cash,10000-230-530-145-260+result);
});

test('A busy worker cannot be dismissed until their service transaction finishes',()=>{
 const s=newGasStation();s.cash=10000;s.spawnClock=99;
 assert.equal(buyStaff(s,'fuel'),true);
 const worker=s.staff[0]!;
 s.cars=[waiting(600)];
 tickGas(s,.1);
 assert.equal(s.cars[0]?.status,'servicing');
 assert.equal(dismissStaff(s,worker.id),false);
 assert.equal(s.staff.length,1);
 for(let i=0;i<7;i++)tickGas(s,.8);
 assert.equal(s.cars[0]?.status,'done');
 assert.equal(dismissStaff(s,worker.id),true);
 assert.equal(s.staff.length,0);
 assert.equal(s.missions.fuel,1);
});

test('Legacy wash owners receive one migration stock grant, not repeated free soap',()=>{
 const s=newGasStation();s.level=10;s.cash=10000;
 assert.equal(buyFacility(s,'wash'),true);
 const old=captureGas(s,123456);
 const oldState=old.state as unknown as Record<string,unknown>;
 delete oldState.soap;
 const migrated=restoreGas(old).state;
 assert.equal(migrated.soap,3);
 migrated.soap=0;
 assert.equal(restoreGas(captureGas(migrated,123457)).state.soap,0);
});
