/**
 * Survival Builder — original offline island construction/worker management.
 * Eight handcrafted blueprint presets, deterministic resource economy, no server
 * and no third-party artwork or original game's level data.
 */
export const SURVIVAL_SAVE_KEY = 'survival-builder-v1';
export const MAX_ISLANDS = 8;
export type Material = 'bamboo'|'wood'|'clay'|'stone'|'brick';
export type Resource = Material | 'coins';
export type Job = Material | 'builder';
export type Stage = 'collecting'|'building'|'completed';
export interface Worker { id:number; job:Job; experience:number; phase:number }
export interface Blueprint {
  id:number; name:string; feature:'hut'|'house'|'well'|'lodge'|'pool'|'tower'|'estate'|'resort';
  requirements:Record<Material,number>; reward:number;
}
export interface IslandState {
  island:number; phase:Stage; inventory:Record<Resource,number>;
  workers:Worker[]; productivity:number; buildProgress:number;
  totalBuilt:number; elapsed:number; bestIsland:number;
  builtHistory:number[]; nextWorkerId:number; bonus:number;
}
export const MATERIALS:readonly Material[]=['bamboo','wood','clay','stone','brick'];
export const JOBS:readonly Job[]=['bamboo','wood','clay','stone','brick','builder'];
export const BLUEPRINTS:readonly Blueprint[]=[
  {id:1,name:'Bamboo Shelter',feature:'hut',requirements:{bamboo:25,wood:8,clay:6,stone:0,brick:0},reward:120},
  {id:2,name:'Island Cottage',feature:'house',requirements:{bamboo:35,wood:22,clay:16,stone:8,brick:4},reward:175},
  {id:3,name:'Village Well',feature:'well',requirements:{bamboo:16,wood:20,clay:20,stone:28,brick:12},reward:210},
  {id:4,name:'Forest Lodge',feature:'lodge',requirements:{bamboo:45,wood:38,clay:28,stone:24,brick:20},reward:290},
  {id:5,name:'Garden Pool',feature:'pool',requirements:{bamboo:24,wood:36,clay:44,stone:54,brick:38},reward:360},
  {id:6,name:'Lookout Tower',feature:'tower',requirements:{bamboo:78,wood:58,clay:38,stone:36,brick:48},reward:480},
  {id:7,name:'Island Estate',feature:'estate',requirements:{bamboo:85,wood:75,clay:60,stone:58,brick:70},reward:620},
  {id:8,name:'Tropical Resort',feature:'resort',requirements:{bamboo:110,wood:100,clay:95,stone:95,brick:100},reward:900},
];
const materialInit=():Record<Resource,number>=>({bamboo:0,wood:0,clay:0,stone:0,brick:0,coins:85});
const clamp=(x:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,x));
const integer=(value:unknown,lo:number,hi:number,fallback:number)=>
  typeof value==='number'&&Number.isFinite(value)&&Number.isSafeInteger(value)?
    clamp(value,lo,hi):fallback;
export const blueprintFor=(island:number):Blueprint=>
  BLUEPRINTS[clamp(Math.floor(island),1,MAX_ISLANDS)-1]!;
export function newIsland():IslandState{
  return {island:1,phase:'collecting',inventory:materialInit(),
    workers:[
      {id:1,job:'bamboo',experience:0,phase:0},
      {id:2,job:'wood',experience:0,phase:0},
      {id:3,job:'clay',experience:0,phase:0},
      {id:4,job:'builder',experience:0,phase:0},
    ],productivity:1,buildProgress:0,totalBuilt:0,elapsed:0,bestIsland:1,
    builtHistory:[],nextWorkerId:5,bonus:0};
}
export const workerCost=(s:IslandState)=>55+Math.max(0,s.workers.length-4)*45;
export const upgradeCost=(s:IslandState)=>65+Math.round((s.productivity-1)*150);
export const bagCapacity=(s:IslandState)=>180+Math.max(0,s.totalBuilt)*35;
export const carried=(s:IslandState)=>MATERIALS.reduce((v,key)=>v+s.inventory[key],0);
export const remaining=(s:IslandState,key:Material)=>Math.max(0,blueprintFor(s.island).requirements[key]-s.inventory[key]);
export const readyToBuild=(s:IslandState)=>s.phase==='collecting'&&
  MATERIALS.every(key=>s.inventory[key]>=blueprintFor(s.island).requirements[key]);
export function tapCollect(s:IslandState,material:Exclude<Material,'brick'>):boolean{
  if(!['bamboo','wood','clay','stone'].includes(material))return false;
  if(carried(s)>=bagCapacity(s)||s.phase==='completed')return false;
  const grant=1+Math.floor((s.productivity-1)/1.5);
  s.inventory[material]+=Math.min(grant,bagCapacity(s)-carried(s));
  s.bonus+=1;
  if(s.bonus%9===0)s.inventory.coins+=5;
  return true;
}
export function assignWorker(s:IslandState,id:number,job:Job):boolean{
  const worker=s.workers.find(w=>w.id===id);
  if(!worker||!JOBS.includes(job))return false;
  worker.job=job;worker.phase=0;return true;
}
export function hireWorker(s:IslandState):boolean{
  if(s.workers.length>=12||s.inventory.coins<workerCost(s))return false;
  s.inventory.coins-=workerCost(s);
  s.workers.push({id:s.nextWorkerId++,job:'builder',phase:0,experience:0});
  return true;
}
export function upgradeWorkers(s:IslandState):boolean{
  const cost=upgradeCost(s);
  if(s.productivity>=6||s.inventory.coins<cost)return false;
  s.inventory.coins-=cost;
  s.productivity=Math.round((s.productivity+.35)*100)/100;
  return true;
}
export function refineBrick(s:IslandState):boolean{
  if(s.phase==='completed'||s.inventory.clay<2||
     carried(s)>=bagCapacity(s))return false;
  s.inventory.clay-=2;s.inventory.brick+=1;return true;
}
export function sellSurplus(s:IslandState,key:Material,count=5):boolean{
  if(!MATERIALS.includes(key)||!Number.isSafeInteger(count)||count<=0)return false;
  // Never auto-sell resources committed for the current blueprint.
  if(s.phase==='building')return false;
  const reserve=s.phase==='completed'?0:blueprintFor(s.island).requirements[key];
  if(s.inventory[key]-reserve<count)return false;
  s.inventory[key]-=count;s.inventory.coins+=count*3;return true;
}
export function beginConstruction(s:IslandState):boolean{
  if(!readyToBuild(s))return false;
  for(const key of MATERIALS)s.inventory[key]-=blueprintFor(s.island).requirements[key];
  s.phase='building';s.buildProgress=0;return true;
}
export function finishIsland(s:IslandState):boolean{
  if(s.phase!=='completed'||s.island>=MAX_ISLANDS)return false;
  s.island++;s.bestIsland=Math.max(s.island,s.bestIsland);
  s.phase='collecting';s.buildProgress=0;return true;
}
/** Offline fixed-step-ish simulation; no wall-clock payouts while app is closed. */
export function tickIsland(s:IslandState,dt:number):IslandState{
  if(!Number.isFinite(dt)||dt<0||dt>1)throw new RangeError('Invalid tick');
  if(!dt)return s;
  s.elapsed+=dt;
  if(s.phase==='completed')return s;
  for(const w of s.workers){
    const rate=s.productivity*(1+Math.min(2,w.experience*.0006));
    if(w.job==='builder'){
      if(s.phase!=='building')continue;
      s.buildProgress=Math.min(100,s.buildProgress+dt*(2.2+rate*1.7));
      w.experience+=dt;
      continue;
    }
    if(s.phase==='building')continue;
    const duration=w.job==='brick'?4.7:2.2;
    w.phase+=dt*rate/duration;
    const cycles=Math.min(4,Math.floor(w.phase));
    if(!cycles)continue;
    w.phase-=cycles;
    for(let i=0;i<cycles;i++){
      if(w.job==='brick'){
        if(s.inventory.clay<2||carried(s)>=bagCapacity(s))continue;
        s.inventory.clay-=2;s.inventory.brick+=1;
      }else{
        if(carried(s)>=bagCapacity(s))break;
        s.inventory[w.job]+=1;
      }
      w.experience+=1;
    }
  }
  if(s.phase==='building'&&s.buildProgress>=100){
    s.buildProgress=100;s.phase='completed';
    s.inventory.coins+=blueprintFor(s.island).reward;
    if(!s.builtHistory.includes(s.island)){
      s.totalBuilt++;s.builtHistory.push(s.island);
    }
    s.bestIsland=Math.max(s.bestIsland,s.island);
  }
  return s;
}
export function sanitizeIsland(raw:unknown):IslandState{
  const initial=newIsland();
  if(!raw||typeof raw!=='object')return initial;
  const obj=raw as Record<string,unknown>;
  const inv=(obj.inventory&&typeof obj.inventory==='object'?
    obj.inventory:{}) as Record<string,unknown>;
  const inventory=materialInit();
  for(const key of [...MATERIALS,'coins'] as Resource[]){
    inventory[key]=integer(inv[key],0,1_000_000,inventory[key]);
  }
  const island=integer(obj.island,1,MAX_ISLANDS,1);
  const rawWorkers=Array.isArray(obj.workers)?obj.workers:[];
  const workers:Worker[]=[];
  for(const item of rawWorkers.slice(0,12)){
    if(!item||typeof item!=='object')continue;
    const candidate=item as Record<string,unknown>;
    if(!JOBS.includes(candidate.job as Job))continue;
    const id=integer(candidate.id,1,99999,0);
    if(!id||workers.some(worker=>worker.id===id))continue;
    workers.push({id,job:candidate.job as Job,
      experience:integer(candidate.experience,0,100000,0),
      phase:typeof candidate.phase==='number'&&Number.isFinite(candidate.phase)?
        clamp(candidate.phase,0,.99999):0});
  }
  if(!workers.length)workers.push(...initial.workers);
  const builtHistory=Array.isArray(obj.builtHistory)?
    [...new Set(obj.builtHistory.filter((n):n is number=>
      Number.isSafeInteger(n)&&n>=1&&n<=MAX_ISLANDS))]:[];
  const phase=['collecting','building','completed'].includes(obj.phase as string)?
    obj.phase as Stage:'collecting';
  const bestIsland=integer(obj.bestIsland,1,MAX_ISLANDS,island);
  return {
    island,phase,inventory,workers,
    productivity:typeof obj.productivity==='number'&&Number.isFinite(obj.productivity)?
      clamp(obj.productivity,1,6):1,
    buildProgress:phase==='completed'?100:phase==='collecting'?0:
      typeof obj.buildProgress==='number'&&Number.isFinite(obj.buildProgress)?
        clamp(obj.buildProgress,0,99.99):0,
    totalBuilt:Math.max(builtHistory.length,integer(obj.totalBuilt,0,MAX_ISLANDS,0)),
    builtHistory,elapsed:0,
    nextWorkerId:Math.max(...workers.map(w=>w.id),integer(obj.nextWorkerId,1,99999,5))+1,
    bestIsland:Math.max(island,bestIsland),bonus:integer(obj.bonus,0,1_000_000,0),
  };
}
