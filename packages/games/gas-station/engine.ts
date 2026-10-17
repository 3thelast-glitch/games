/**
 * Roadside Revival — an original, offline Gas Station / junkyard tycoon.
 * Designed for NAQLA based on broad game concepts of StoreRider's Gas Station.
 * No Poki assets, data files, or original game code are used.
 */
export const GAS_SAVE_KEY='gas-station-roadside-v1';
export const WORLD_W=960, WORLD_H=640;
export type Facility='pump'|'shop'|'garage'|'wash'|'tires';
export type StaffJob='fuel'|'cashier'|'mechanic'|'wash';
export type Upgrade='pumpSpeed'|'tankSize'|'shopMargin'|'serviceSpeed'|'advertising';
export type VehicleType='sedan'|'suv'|'van'|'sport'|'truck';
export type CarStatus='waiting'|'servicing'|'done'|'leaving';
export type Vehicle={
 id:number; type:VehicleType; facility:Facility; bay:number; status:CarStatus;
 x:number;y:number; color:string; patience:number; amount:number; progress:number;
 needs:number; reward:number; event:boolean; condition:number;
};
export type Debris={id:number;x:number;y:number;durability:number;value:number;cleared:boolean};
export type Worker={id:number;job:StaffJob;level:number};
export type GarageStep='diagnose'|'parts'|'repair'|'done';
export type Mission='cleanup'|'fuel'|'sales'|'repair'|'wash'|'expansion'|'race';
export type State={
 cash:number; fuel:number; maxFuel:number; goods:number;maxGoods:number;parts:number;
 level:number;exp:number; bestLevel:number; reputation:number; rating:number;
 player:{x:number;y:number;tx:number|null;ty:number|null};
 facilities:Record<Facility,number>; upgrades:Record<Upgrade,number>;
 staff:Worker[]; debris:Debris[]; cars:Vehicle[];
 garageStep:GarageStep; garageCar:number|null;
 missions:Record<Mission,number>; claimed:Mission[];
 served:number; totalIncome:number; missed:number; revenueToday:number;
 day:number; clock:number; elapsed:number; spawnClock:number; nextId:number;
 event:{active:boolean;time:number;remaining:number;completed:number;goal:number};
 notice:string; staffClock:number; idleCollected:number;
};
export const FACILITIES:readonly Facility[]=['pump','shop','garage','wash','tires'];
export const JOBS:readonly StaffJob[]=['fuel','cashier','mechanic','wash'];
export const UPGRADES:readonly Upgrade[]=['pumpSpeed','tankSize','shopMargin','serviceSpeed','advertising'];
export const TARGETS:Readonly<Record<Facility,{x:number;y:number}>>={
 pump:{x:365,y:371},shop:{x:654,y:188},garage:{x:805,y:361},
 wash:{x:755,y:516},tires:{x:574,y:523}
};
export const MISSIONS:Readonly<Record<Mission,{target:number;reward:number}>>={
 cleanup:{target:12,reward:200},fuel:{target:18,reward:190},
 sales:{target:12,reward:130},repair:{target:6,reward:260},
 wash:{target:6,reward:220},expansion:{target:4,reward:280},
 race:{target:3,reward:350}
};
const clamp=(n:number,a:number,b:number)=>Math.min(b,Math.max(a,n));
const valid=(v:unknown,min:number,max:number,d:number)=>
 typeof v==='number'&&Number.isSafeInteger(v)?clamp(v,min,max):d;
export const initialDebris=():Debris[]=>Array.from({length:24},(_,i)=>({
 id:i+1,x:60+i%8*111+(i*17)%20,y:98+Math.floor(i/8)*172+(i%3)*18,
 durability:1+(i%3),value:10+i%4*5,cleared:false
})).filter(d=>Math.hypot(d.x-390,d.y-372)>96);
export function newGasStation():State{
 return {
  cash:180,fuel:125,maxFuel:240,goods:8,maxGoods:30,parts:6,
  level:1,exp:0,bestLevel:1,reputation:45,rating:3.1,
  player:{x:470,y:338,tx:null,ty:null},
  facilities:{pump:1,shop:0,garage:0,wash:0,tires:0},
  upgrades:{pumpSpeed:0,tankSize:0,shopMargin:0,serviceSpeed:0,advertising:0},
  staff:[],debris:initialDebris(),cars:[],garageStep:'diagnose',garageCar:null,
  missions:{cleanup:0,fuel:0,sales:0,repair:0,wash:0,expansion:0,race:0},
  claimed:[],served:0,totalIncome:0,missed:0,revenueToday:0,
  day:1,clock:9*60,elapsed:0,spawnClock:2,nextId:100,
  event:{active:false,time:0,remaining:0,completed:0,goal:3},
  notice:'gasWelcome',staffClock:0,idleCollected:0
 };
}
export const facilityCost=(s:State,key:Facility):number=>{
 if(key==='pump')return 170+s.facilities.pump*180;
 return {shop:230,garage:360,wash:530,tires:690}[key];
};
export const workerCost=(s:State)=>145+s.staff.length*115;
export const upgradeCost=(s:State,key:Upgrade)=>
 ({pumpSpeed:120,tankSize:180,shopMargin:140,serviceSpeed:170,advertising:180}[key])
 *(1+s.upgrades[key]*.7);
export const fuelCost=(s:State,liters:number)=>Math.round(liters*(2.05-s.upgrades.tankSize*.05));
export const canFacility=(s:State,key:Facility)=>s.facilities[key]>0;
export function earn(s:State,amount:number,source:'fuel'|'shop'|'service'|'junk'|'bonus'){
 const money=Math.max(0,Math.floor(amount));
 s.cash+=money;s.totalIncome+=money;s.revenueToday+=money;
 if(source==='fuel'){s.missions.fuel++;s.served++;}
 if(source==='shop')s.missions.sales++;
 if(source==='service')s.served++;
 if(source==='junk')s.missions.cleanup++;
 s.exp+=source==='junk'?5:source==='bonus'?12:11;
 while(s.exp>=s.level*90){s.exp-=s.level*90;s.level++;s.bestLevel=Math.max(s.bestLevel,s.level);s.cash+=35;}
 s.reputation=clamp(s.reputation+(source==='fuel'||source==='service'?1:.3),0,100);
 s.rating=Math.min(5,Math.round((2.6+s.reputation*.023)*10)/10);
}
export function moveTo(s:State,x:number,y:number):boolean{
 if(!Number.isFinite(x)||!Number.isFinite(y))return false;
 s.player.tx=clamp(x,22,WORLD_W-22);s.player.ty=clamp(y,72,WORLD_H-22);return true;
}
export const isNear=(s:State,p:{x:number;y:number},radius=94)=>
 Math.hypot(s.player.x-p.x,s.player.y-p.y)<=radius;
export function clearJunk(s:State,id:number):boolean{
 const item=s.debris.find(x=>x.id===id&&!x.cleared);
 if(!item||!isNear(s,item,72))return false;
 item.durability--;
 if(item.durability<=0){item.cleared=true;earn(s,item.value,'junk');s.notice='gasCleaned';}
 else s.notice='gasClearing';
 return true;
}
export function buyFacility(s:State,key:Facility):boolean{
 if(!FACILITIES.includes(key)||s.facilities.pump===0)return false;
 if(key==='pump'&&s.facilities.pump>=3)return false;
 if(key!=='pump'&&s.facilities[key])return false;
 const order:{[k in Facility]:number}={pump:1,shop:3,garage:4,wash:6,tires:8};
 if(s.level<order[key]||s.cash<facilityCost(s,key))return false;
 s.cash-=facilityCost(s,key);s.facilities[key]++;
 s.missions.expansion++;
 s.notice='gasExpanded';
 return true;
}
export function buyUpgrade(s:State,key:Upgrade):boolean{
 if(!UPGRADES.includes(key)||s.upgrades[key]>=6||s.cash<upgradeCost(s,key))return false;
 s.cash-=Math.ceil(upgradeCost(s,key));
 s.upgrades[key]++;
 if(key==='tankSize'){s.maxFuel+=90;s.maxGoods+=8;}
 s.notice='gasUpgraded';return true;
}
export function buyStaff(s:State,job:StaffJob):boolean{
 if(!JOBS.includes(job)||s.staff.length>=9||s.cash<workerCost(s))return false;
 const workplace:Record<StaffJob,Facility>={fuel:'pump',cashier:'shop',mechanic:'garage',wash:'wash'};
 if(!canFacility(s,workplace[job]))return false;
 s.cash-=workerCost(s);
 s.staff.push({id:s.nextId++,job,level:1});s.notice='gasHired';return true;
}
export function dismissStaff(s:State,id:number):boolean{
 const index=s.staff.findIndex(x=>x.id===id);
 if(index<0)return false;
 s.staff.splice(index,1);s.notice='gasDismissed';return true;
}
export function restock(s:State,type:'fuel'|'goods'|'parts',amount:number):boolean{
 if(![20,50,100].includes(amount))return false;
 const unit=type==='fuel'?2.05-s.upgrades.tankSize*.05:type==='goods'?3:4.3;
 const price=Math.ceil(amount*unit);
 if(s.cash<price)return false;
 if(type==='fuel'&&s.fuel+amount>s.maxFuel)return false;
 if(type==='goods'&&s.goods+amount>s.maxGoods)return false;
 if(type==='parts'&&s.parts+amount>120)return false;
 s.cash-=price;s[type]+=amount;
 s.notice='gasRestocked';return true;
}
function garageNeeds(s:State):Vehicle|undefined{
 const car=s.cars.find(c=>c.id===s.garageCar&&c.facility==='garage'&&c.status==='waiting');
 return car??s.cars.find(c=>c.facility==='garage'&&c.status==='waiting');
}
export function workGarage(s:State):boolean{
 if(!canFacility(s,'garage')||!isNear(s,TARGETS.garage,135))return false;
 const c=garageNeeds(s);
 if(!c)return false;
 if(s.garageCar!==c.id){s.garageCar=c.id;s.garageStep='diagnose';}
 if(s.garageStep==='diagnose'){
  s.garageStep='parts';s.notice='gasDiagnosed';return true;
 }
 if(s.garageStep==='parts'){
  if(s.parts<2){s.notice='gasNeedParts';return false;}
  s.parts-=2;s.garageStep='repair';s.notice='gasPartInstalled';return true;
 }
 if(s.garageStep==='repair'){
  c.status='done';c.progress=c.needs;s.garageStep='done';
  earn(s,c.reward,'service');s.missions.repair++;s.notice='gasRepaired';
  s.garageCar=null;s.garageStep='diagnose';return true;
 }
 return false;
}
export function interactCar(s:State,id:number):boolean{
 const car=s.cars.find(c=>c.id===id&&c.status==='waiting');
 if(!car||!isNear(s,car,115))return false;
 if(car.facility==='garage')return workGarage(s);
 if(car.facility==='pump'){
  if(s.fuel<Math.ceil(car.needs-car.progress)){s.notice='gasNeedFuel';return false;}
  car.status='servicing';s.notice='gasFuelling';return true;
 }
 if(car.facility==='shop'){
  if(!s.goods){s.notice='gasNeedGoods';return false;}
  car.status='servicing';s.notice='gasShopping';return true;
 }
 car.status='servicing';s.notice=car.facility==='wash'?'gasWashing':'gasTireService';
 return true;
}
export function startRace(s:State):boolean{
 if(s.event.active||s.level<5)return false;
 s.event={active:true,time:80,remaining:3,completed:0,goal:3};
 s.notice='gasRaceStart';return true;
}
export function claimMission(s:State,key:Mission):boolean{
 if(!Object.hasOwn(MISSIONS,key)||s.claimed.includes(key)||s.missions[key]<MISSIONS[key].target)return false;
 s.claimed.push(key);earn(s,MISSIONS[key].reward,'bonus');s.notice='gasMissionClaimed';return true;
}
const kinds:VehicleType[]=['sedan','suv','van','sport','truck'];
const shades=['#55c46d','#e681ac','#53b1e5','#f5a53e','#966bd1','#e56b61'];
const facilityCapacity=(s:State,key:Facility)=>
 key==='pump'?s.facilities.pump: s.facilities[key]>0?1:0;
const spawn=(s:State,forceSport=false)=>{
 const order:Facility[]=['pump','pump','shop','pump','garage','wash','tires'];
 const idx=Math.floor(s.elapsed*5+s.nextId*3)%order.length;
 let facility=forceSport?'pump':order[idx]!;
 if(!facilityCapacity(s,facility))facility='pump';
 if(s.cars.filter(c=>c.facility===facility&&c.status!=='leaving'&&c.status!=='done').length>=facilityCapacity(s,facility))return;
 const bay=facility==='pump'?s.cars.filter(c=>c.facility==='pump'&&c.status==='waiting').length:0;
 const type=forceSport?'sport':kinds[(s.nextId+s.day)%kinds.length]!;
 const base=type==='truck'?34:type==='suv'?27:type==='sport'?25:18;
 const needs=facility==='pump'?base+Math.floor(s.level/3)*3:
  facility==='shop'?2:facility==='garage'?3:facility==='wash'?4:3;
 const reward=facility==='pump'?Math.round(needs*(4.8+s.upgrades.pumpSpeed*.4)):
  facility==='shop'?(20+s.upgrades.shopMargin*8):facility==='garage'?110:
  facility==='wash'?64:49;
 const loc=TARGETS[facility];
 s.cars.push({id:s.nextId++,type,facility,bay,status:'waiting',
  x:facility==='pump'?300+bay*117:loc.x,y:facility==='pump'?355:loc.y,
  color:shades[s.nextId%shades.length]!,patience:forceSport?38:48,
  amount:0,progress:0,needs,reward,event:forceSport,condition:1});
};
export function tickGas(s:State,dt:number):State{
 if(!Number.isFinite(dt)||dt<0||dt>1)throw new RangeError('Invalid gas tick');
 if(dt===0)return s;
 s.elapsed+=dt;s.clock+=dt*2.3;
 if(s.clock>=24*60){s.clock-=24*60;s.day++;s.revenueToday=0;}
 const target=s.player.tx===null||s.player.ty===null?null:{x:s.player.tx,y:s.player.ty};
 if(target){
  const d=Math.hypot(target.x-s.player.x,target.y-s.player.y);
  if(d<3){s.player.tx=null;s.player.ty=null;}
  else{
   const dist=Math.min(d,185*dt);
   s.player.x+=dist*(target.x-s.player.x)/d;
   s.player.y+=dist*(target.y-s.player.y)/d;
  }
 }
 s.spawnClock-=dt;
 if(s.spawnClock<=0){
  spawn(s,s.event.active&&s.event.remaining>0);
  s.spawnClock=8.2/(1+s.upgrades.advertising*.15);
 }
 if(s.event.active){
  s.event.time=Math.max(0,s.event.time-dt);
  if(s.event.time===0){
   if(s.event.completed>=s.event.goal){earn(s,420,'bonus');s.notice='gasRaceWon';}
   else s.notice='gasRaceOver';
   s.event.active=false;
  }
 }
 s.staffClock+=dt;
 // Service progresses only while the business is open. Assigned staff starts the corresponding queue.
 for(const car of s.cars){
  if(car.status==='waiting'){
   car.patience-=dt;
   const match:Record<Facility,StaffJob>={pump:'fuel',shop:'cashier',garage:'mechanic',wash:'wash',tires:'mechanic'};
   if(s.staff.some(w=>w.job===match[car.facility]) &&
      (car.facility!=='garage'||s.parts>=2) &&
      (car.facility!=='shop'||s.goods>0) &&
      (car.facility!=='pump'||s.fuel>=car.needs)){
     if(car.facility==='garage')s.parts-=2;
     car.status='servicing';
   }
   if(car.patience<=0){car.status='leaving';s.missed++;s.reputation=clamp(s.reputation-2,0,100);s.notice='gasCustomerLeft';}
  }else if(car.status==='servicing'){
   const speed=(1+s.upgrades.serviceSpeed*.24+s.upgrades.pumpSpeed*(car.facility==='pump'?.16:0));
   const duration=car.facility==='pump'?4.2:car.facility==='garage'?8:car.facility==='shop'?3:5;
   car.progress=Math.min(car.needs,car.progress+dt*car.needs/duration*speed);
   if(car.progress>=car.needs){
    if(car.facility==='pump'){
     s.fuel-=car.needs;earn(s,car.reward,'fuel');
    }else if(car.facility==='shop'){
     s.goods=Math.max(0,s.goods-1);earn(s,car.reward,'shop');
    }else {
     earn(s,car.reward,'service');
     if(car.facility==='garage')s.missions.repair++;
     if(car.facility==='wash')s.missions.wash++;
    }
    if(car.event&&s.event.active){
     s.event.completed++;s.missions.race++;
     if(s.event.completed>=s.event.goal){s.event.active=false;earn(s,420,'bonus');s.notice='gasRaceWon';}
    }
    car.status='done';car.amount=2;s.notice='gasCustomerServed';
   }
  }else if(car.status==='done'){
   car.amount-=dt;
   if(car.amount<=0)car.status='leaving';
  }
 }
 s.cars=s.cars.filter(c=>c.status!=='leaving');
 // Lightweight deterministic idle income while playing, not enough to replace service.
 if(s.staffClock>=45){
  s.staffClock-=45;
  const bonus=s.facilities.shop?4+s.upgrades.shopMargin*2:0;
  if(bonus){s.cash+=bonus;s.totalIncome+=bonus;s.revenueToday+=bonus;}
 }
 return s;
}
export function applyOfflineEarnings(s:State,nowMs:number,savedAtMs:number):number{
 if(!Number.isFinite(nowMs)||!Number.isFinite(savedAtMs)||nowMs<=savedAtMs)return 0;
 const time=Math.min(8*3600,(nowMs-savedAtMs)/1000);
 const workers=s.staff.length;
 const facilities=FACILITIES.reduce((n,k)=>n+(s.facilities[k]>0?1:0),0);
 const income=Math.floor(time/60)*Math.floor((workers*3+facilities*2)*.6);
 const capped=Math.min(2200,Math.max(0,income));
 s.cash+=capped;s.totalIncome+=capped;s.idleCollected=capped;
 return capped;
}
export type SavedGas={version:1;savedAt:number;state:State};
export const captureGas=(s:State,savedAt=Date.now()):SavedGas=>({
 version:1,savedAt,state:{...s,player:{...s.player,tx:null,ty:null},
  debris:s.debris.map(x=>({...x})),cars:[],event:{...s.event,active:false,time:0},
  staff:s.staff.map(x=>({...x})),facilities:{...s.facilities},
  upgrades:{...s.upgrades},missions:{...s.missions},claimed:[...s.claimed]}
});
export function restoreGas(input:unknown):{state:State;savedAt:number}{
 const fresh=newGasStation();
 if(!input||typeof input!=='object')return {state:fresh,savedAt:0};
 const v=input as Record<string,unknown>;
 if(v.version!==1||!v.state||typeof v.state!=='object')return {state:fresh,savedAt:0};
 const o=v.state as Record<string,unknown>;
 const money=(name:string,max=1e9,d=0)=>valid(o[name],0,max,d);
 const state=newGasStation();
 state.cash=money('cash',1e9,180);state.fuel=money('fuel',100000,125);
 state.goods=money('goods',10000,8);state.parts=money('parts',10000,6);
 state.level=valid(o.level,1,1000,1);state.bestLevel=valid(o.bestLevel,1,1000,state.level);
 state.exp=money('exp',1e8);state.totalIncome=money('totalIncome');state.served=money('served');
 state.missed=money('missed');state.revenueToday=money('revenueToday');
 state.day=valid(o.day,1,100000,1);
 state.clock=typeof o.clock==='number'&&Number.isFinite(o.clock)?clamp(o.clock,0,1440):540;
 state.reputation=money('reputation',100,45);
 state.rating=typeof o.rating==='number'&&Number.isFinite(o.rating)?clamp(o.rating,1,5):3.1;
 state.nextId=valid(o.nextId,100,10000000,100);
 const facilities=o.facilities&&typeof o.facilities==='object'?o.facilities as Record<string,unknown>:{};
 for(const key of FACILITIES){
  state.facilities[key]=valid(facilities[key],key==='pump'?1:0,key==='pump'?3:1,state.facilities[key]);
 }
 const up=o.upgrades&&typeof o.upgrades==='object'?o.upgrades as Record<string,unknown>:{};
 for(const key of UPGRADES)state.upgrades[key]=valid(up[key],0,6,0);
 state.maxFuel=240+state.upgrades.tankSize*90;state.maxGoods=30+state.upgrades.tankSize*8;
 state.fuel=Math.min(state.fuel,state.maxFuel);state.goods=Math.min(state.goods,state.maxGoods);
 const d=Array.isArray(o.debris)?o.debris:[];
 const original=new Map(state.debris.map(x=>[x.id,x]));
 for(const raw of d){
  if(!raw||typeof raw!=='object')continue;
  const item=raw as Record<string,unknown>;
  const target=original.get(item.id as number);
  if(!target)continue;
  target.cleared=item.cleared===true;
  target.durability=valid(item.durability,0,3,target.durability);
 }
 const m=o.missions&&typeof o.missions==='object'?o.missions as Record<string,unknown>:{};
 for(const key of Object.keys(MISSIONS) as Mission[])state.missions[key]=valid(m[key],0,100000,0);
 if(Array.isArray(o.claimed))state.claimed=[...new Set(o.claimed.filter(
  (x):x is Mission=>typeof x==='string'&&Object.hasOwn(MISSIONS,x)))];
 if(Array.isArray(o.staff)){
  const seen=new Set<number>();
  for(const raw of o.staff.slice(0,9)){
   if(!raw||typeof raw!=='object')continue;
   const w=raw as Record<string,unknown>;
   const id=valid(w.id,1,10000000,0);
   if(!id||seen.has(id)||!JOBS.includes(w.job as StaffJob))continue;
   const facility:Record<StaffJob,Facility>={fuel:'pump',cashier:'shop',mechanic:'garage',wash:'wash'};
   if(!state.facilities[facility[w.job as StaffJob]])continue;
   state.staff.push({id,job:w.job as StaffJob,level:valid(w.level,1,10,1)});seen.add(id);
  }
 }
 state.nextId=Math.max(state.nextId,...state.staff.map(x=>x.id+1));
 const p=o.player&&typeof o.player==='object'?o.player as Record<string,unknown>:{};
 state.player.x=typeof p.x==='number'&&Number.isFinite(p.x)?clamp(p.x,20,WORLD_W-20):470;
 state.player.y=typeof p.y==='number'&&Number.isFinite(p.y)?clamp(p.y,70,WORLD_H-20):338;
 return {state,savedAt:valid(v.savedAt,0,Number.MAX_SAFE_INTEGER,0)};
}
