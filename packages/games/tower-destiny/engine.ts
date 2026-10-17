/**
 * Tower Destiny: Rolling Defense — original offline mobile-tower survival game.
 * Fixed-step deterministic combat; all geometry is an internal 420 x 680 world.
 * No remote assets, Poki code, or original art/stages used.
 */
export const TOWER_SAVE_KEY = 'tower-destiny-offline-v1';
export const TOWER_WIDTH = 420;
export const TOWER_HEIGHT = 680;
export const FIXED_DT = 1/60;
export const MAX_STAGE = 30;
export type Weapon = 'rifle' | 'flame' | 'saw' | 'laser';
export type Phase = 'ready' | 'battle' | 'won' | 'lost';
export type EnemyKind = 'walker' | 'runner' | 'brute' | 'flyer' | 'boss';
export interface Enemy {
  id:number; kind:EnemyKind; x:number; y:number; hp:number; maxHp:number;
  speed:number; attack:number; touch:number; height:number; alive:boolean; attackClock:number;
}
export interface Module { weapon:Weapon; level:number; cooldown:number; hp:number; maxHp:number }
export interface Fx {id:number; x:number;y:number;kind:'shot'|'fire'|'blast'|'coin'|'hit'|'laser'; life:number; amount:number}
export interface DefenseState {
  stage:number; phase:Phase; coins:number; kills:number; bestStage:number;
  modules:Module[]; hull:number; maxHull:number; energy:number; maxEnergy:number;
  timer:number; spawnClock:number; spawned:number; targetCount:number; bossSpawned:boolean;
  enemies:Enemy[]; effects:Fx[]; heroClock:number; selectedTarget:number|null;
  aim:{x:number;y:number}|null; event:'coin'|'wave'|'boss'|'clear'|'damage'|null;
  nextId:number; tech:number; speedTech:number; armorTech:number; totalKills:number;
}
export interface DefenseProgress {
  stage:number; coins:number; bestStage:number; tech:number; speedTech:number;
  armorTech:number; totalKills:number; modules:{weapon:Weapon;level:number}[];
}
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const valid=(x:unknown,lo:number,hi:number,d:number)=>typeof x==='number'&&
  Number.isSafeInteger(x)?clamp(x,lo,hi):d;
export const WEAPONS:readonly Weapon[]=['rifle','flame','saw','laser'];
export const ENEMIES:readonly EnemyKind[]=['walker','runner','brute','flyer','boss'];
export const weaponCost=(s:DefenseState)=>Math.round(75 + s.modules.length*65 + s.stage*9);
export const armorCost=(s:DefenseState)=>50+s.armorTech*45;
export const speedCost=(s:DefenseState)=>70+s.speedTech*55;
export const powerCost=(s:DefenseState)=>65+s.tech*48;
export const weaponUpgradeCost=(s:DefenseState,index:number)=>50+s.modules[index]!.level*40;
export const enemyCount=(stage:number)=>8+Math.min(24,stage*2);
export const isBossStage=(stage:number)=>stage%5===0;
const baseHull=(mods:Module[],armorTech:number)=>100+armorTech*32+mods.length*55;
const baseModule=(weapon:Weapon,level=1):Module=>({weapon,level,cooldown:0,hp:50+level*10,maxHp:50+level*10});
export function newDefense(progress?:Partial<DefenseProgress>):DefenseState{
  const saved=readDefenseProgress(progress);
  const modules=saved.modules.map(m=>baseModule(m.weapon,m.level));
  const maxHull=baseHull(modules,saved.armorTech);
  return {
    stage:saved.stage,phase:'ready',coins:saved.coins,kills:0,bestStage:saved.bestStage,
    modules,hull:maxHull,maxHull,energy:20,maxEnergy:100,
    timer:0,spawnClock:0,spawned:0,targetCount:enemyCount(saved.stage),bossSpawned:false,
    enemies:[],effects:[],heroClock:0,selectedTarget:null,aim:null,event:null,
    nextId:1,tech:saved.tech,speedTech:saved.speedTech,armorTech:saved.armorTech,
    totalKills:saved.totalKills,
  };
}
export function readDefenseProgress(raw:unknown):DefenseProgress{
  const obj=(raw&&typeof raw==='object'?raw:{}) as Record<string,unknown>;
  const input=Array.isArray(obj.modules)?obj.modules:[];
  const modules:{weapon:Weapon;level:number}[]=[];
  for(const v of input.slice(0,5)){
    if(!v||typeof v!=='object')continue;
    const m=v as Record<string,unknown>;
    if(!WEAPONS.includes(m.weapon as Weapon))continue;
    modules.push({weapon:m.weapon as Weapon,level:valid(m.level,1,20,1)});
  }
  if(!modules.length)modules.push({weapon:'rifle',level:1});
  const stage=valid(obj.stage,1,MAX_STAGE,1);
  return {stage,coins:valid(obj.coins,0,10000000,140),
    bestStage:Math.max(stage,valid(obj.bestStage,1,MAX_STAGE,stage)),
    tech:valid(obj.tech,0,20,0),speedTech:valid(obj.speedTech,0,20,0),
    armorTech:valid(obj.armorTech,0,20,0),totalKills:valid(obj.totalKills,0,10000000,0),
    modules};
}
export const captureDefense=(s:DefenseState):DefenseProgress=>({
  stage:s.stage,coins:s.coins,bestStage:s.bestStage,
  tech:s.tech,speedTech:s.speedTech,armorTech:s.armorTech,totalKills:s.totalKills,
  modules:s.modules.map(m=>({weapon:m.weapon,level:m.level})),
});
export function addFloor(s:DefenseState,weapon:Weapon):boolean{
  if(s.phase!=='ready'||s.modules.length>=5||!WEAPONS.includes(weapon))return false;
  const cost=weaponCost(s);
  if(s.coins<cost)return false;
  s.coins-=cost;s.modules.push(baseModule(weapon));
  const before=s.maxHull;s.maxHull=baseHull(s.modules,s.armorTech);
  s.hull+=s.maxHull-before;
  return true;
}
export function upgradeFloor(s:DefenseState,i:number):boolean{
  if(s.phase!=='ready'||!Number.isSafeInteger(i)||i<0||i>=s.modules.length)return false;
  const m=s.modules[i]!;
  if(m.level>=20||s.coins<weaponUpgradeCost(s,i))return false;
  s.coins-=weaponUpgradeCost(s,i);
  m.level++;
  m.maxHp+=12;m.hp=m.maxHp;return true;
}
export function upgradeDefense(s:DefenseState,kind:'armor'|'speed'|'power'):boolean{
  if(s.phase!=='ready')return false;
  const cost=kind==='armor'?armorCost(s):kind==='speed'?speedCost(s):powerCost(s);
  if(s.coins<cost)return false;
  if((kind==='armor'&&s.armorTech>=20)||(kind==='speed'&&s.speedTech>=20)||
    (kind==='power'&&s.tech>=20))return false;
  s.coins-=cost;
  if(kind==='armor'){s.armorTech++;s.maxHull+=32;s.hull+=32;}
  if(kind==='speed')s.speedTech++;
  if(kind==='power')s.tech++;
  return true;
}
export function launchDefense(s:DefenseState):boolean{
  if(s.phase!=='ready')return false;
  s.phase='battle';s.timer=0;s.spawnClock=0;s.event='wave';return true;
}
export function aimDefense(s:DefenseState,x:number,y:number):boolean{
  if(s.phase!=='battle'||!Number.isFinite(x)||!Number.isFinite(y))return false;
  s.aim={x:clamp(x,90,TOWER_WIDTH-10),y:clamp(y,155,585)};
  const near=s.enemies.filter(e=>e.alive).sort((a,b)=>
    Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];
  s.selectedTarget=near?.id??null;
  return true;
}
export function clearAim(s:DefenseState){s.aim=null;s.selectedTarget=null;}
const effect=(s:DefenseState,kind:Fx['kind'],x:number,y:number,amount=0)=>{
  s.effects.push({id:s.nextId++,kind,x,y,life:kind==='coin'?1.15:.27,amount});
  if(s.effects.length>70)s.effects.shift();
};
const spawnEnemy=(s:DefenseState,kind:EnemyKind)=>{
  const level=s.stage;
  const seed=s.spawned*29+s.stage*13;
  const y=kind==='flyer'?330+(seed%3)*29:555+(seed%3)*11;
  const hpScale=1+(level-1)*.24;
  const base=kind==='runner'?28:kind==='brute'?94:kind==='flyer'?40:kind==='boss'?850:48;
  const hp=Math.round(base*hpScale);
  s.enemies.push({id:s.nextId++,kind,x:440+seed%42,y,hp,maxHp:hp,
    speed:(kind==='runner'?56:kind==='brute'?16:kind==='flyer'?36:kind==='boss'?13:27)+Math.min(22,level*.75),
    attack:kind==='boss'?30:kind==='brute'?15:kind==='runner'?7:kind==='flyer'?9:8,
    touch:kind==='boss'?150:96,height:kind==='flyer'?25:30,alive:true,attackClock:0});
};
const deal=(s:DefenseState,e:Enemy,amount:number)=>{
  if(!e.alive)return;
  e.hp=Math.max(0,e.hp-amount);effect(s,'hit',e.x,e.y-30,Math.round(amount));
  if(e.hp===0){
    e.alive=false;s.kills++;s.totalKills++;
    const gold=e.kind==='boss'?170: e.kind==='brute'?19:8;
    s.coins+=gold;effect(s,'coin',e.x,e.y-52,gold);s.event='coin';
  }
};
const nearest=(s:DefenseState):Enemy|undefined=>{
  const live=s.enemies.filter(e=>e.alive);
  if(s.selectedTarget!==null){
    const chosen=live.find(e=>e.id===s.selectedTarget);
    if(chosen)return chosen;
  }
  return live.reduce<Enemy|undefined>((best,e)=>!best||e.x<best.x?e:best,undefined);
};
export function specialDefense(s:DefenseState,kind:'blast'|'repair'|'overdrive'):boolean{
  const cost=kind==='blast'?35:kind==='repair'?40:55;
  if(s.phase!=='battle'||s.energy<cost)return false;
  if(kind==='repair'&&s.hull>=s.maxHull)return false;
  s.energy-=cost;
  if(kind==='repair'){s.hull=Math.min(s.maxHull,s.hull+75+s.armorTech*18);effect(s,'blast',145,370,0);}
  else if(kind==='blast'){
    const e=nearest(s);if(!e){s.energy+=cost;return false;}
    effect(s,'blast',e.x,e.y,0);
    for(const target of s.enemies)if(target.alive&&Math.abs(target.x-e.x)<125)deal(s,target,150+s.tech*35);
  }else{
    for(const target of s.enemies)if(target.alive)deal(s,target,80+s.tech*15);
    effect(s,'laser',195,390,0);
  }
  return true;
}
/** Fixed dt simulation, always mutates the explicit match state, never any globals. */
export function tickDefense(s:DefenseState,dt=FIXED_DT):Phase{
  if(s.phase!=='battle')return s.phase;
  if(!Number.isFinite(dt)||dt<=0||dt>1/30)throw new RangeError('Invalid fixed step');
  s.timer+=dt;
  s.energy=Math.min(s.maxEnergy,s.energy+(5.4+s.speedTech*1.4)*dt);
  s.effects=s.effects.filter(f=>(f.life-=dt)>0);
  s.spawnClock-=dt;
  if(s.spawned<s.targetCount&&s.spawnClock<=0){
    const index=s.spawned++;
    const kind:EnemyKind=index%9===6?'brute':index%6===5?'runner':index%8===7?'flyer':'walker';
    spawnEnemy(s,kind);
    s.spawnClock=.82+((s.stage+index)%3)*.19;
  }
  if(isBossStage(s.stage)&&!s.bossSpawned&&s.spawned>=s.targetCount){
    s.bossSpawned=true;spawnEnemy(s,'boss');s.event='boss';
  }
  for(const e of s.enemies){
    if(!e.alive)continue;
    if(e.x>e.touch) e.x=Math.max(e.touch,e.x-e.speed*dt);
    else{
      e.attackClock-=dt;
      if(e.attackClock<=0){
        const damage=Math.max(1,e.attack-s.armorTech*.6);
        s.hull=Math.max(0,s.hull-damage);
        e.attackClock=.75;s.event='damage';
        effect(s,'hit',125,522,damage);
        if(s.hull<=0){s.phase='lost';return s.phase;}
      }
    }
  }
  // Automatic roof hero rifle.
  s.heroClock-=dt;
  if(s.heroClock<=0){
    const target=nearest(s);
    if(target){
      s.heroClock=.51/(1+s.speedTech*.10);
      deal(s,target,18+s.tech*4);
      effect(s,'shot',target.x,target.y-18,0);
    }
  }
  s.modules.forEach((mod,index)=>{
    mod.cooldown-=dt;
    if(mod.cooldown>0)return;
    const target=nearest(s);if(!target)return;
    const level=mod.level+s.tech*.28;
    const speedBoost=1+s.speedTech*.075;
    const duration=(mod.weapon==='rifle'?.34:mod.weapon==='flame'?.20:mod.weapon==='saw'?.39:.75)/speedBoost;
    mod.cooldown=duration;
    const amount=mod.weapon==='rifle'?13+level*6:mod.weapon==='flame'?8+level*4:
      mod.weapon==='saw'?17+level*8:36+level*14;
    if(mod.weapon==='saw'&&target.x>245)return;
    if(mod.weapon==='flame'){
      for(const mob of s.enemies)if(mob.alive&&mob.x<target.x+70&&mob.x>target.x-85)
        deal(s,mob,amount);
      effect(s,'fire',Math.min(380,target.x),target.y,amount);
    }else{
      deal(s,target,amount);
      effect(s,mod.weapon==='laser'?'laser':'shot',target.x,target.y-15,amount);
    }
  });
  if(s.spawned>=s.targetCount&&(!isBossStage(s.stage)||s.bossSpawned)&&
    s.enemies.every(e=>!e.alive)){
    s.phase='won';s.event='clear';s.coins+=55+s.stage*12;
    s.bestStage=Math.max(s.bestStage,s.stage);
  }
  return s.phase;
}
export function continueDefense(s:DefenseState):DefenseState{
  if(s.phase!=='won')return s;
  const progress=captureDefense(s);
  progress.stage=Math.min(MAX_STAGE,s.stage+1);
  progress.bestStage=Math.max(progress.bestStage,progress.stage);
  const next=newDefense(progress);
  return next;
}
export function retryDefense(s:DefenseState):DefenseState{
  if(s.phase!=='lost')return s;
  return newDefense(captureDefense(s));
}
