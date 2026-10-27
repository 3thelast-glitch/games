/**
 * NAQLA Tactics — independently written tactical rules for the NAQLA platform.
 * This is NOT the commercial Athena Crisis engine and contains no proprietary content.
 */
export type Side = 1 | 2;
export type Kind = 'infantry' | 'scout' | 'tank' | 'artillery';
export type Terrain = '.' | 'F' | 'M' | '~';
export type Unit = { id: number; side: Side; kind: Kind; x: number; y: number; hp: number; moved: boolean; acted: boolean };
export type Site = { x: number; y: number; kind: 'base' | 'city'; side: 0 | Side };
export type Battle = { version: 1; mission: number; mode: 'ai' | 'local'; tiles: string[]; units: Unit[]; sites: Site[]; turn: Side; round: number; gold: Record<Side, number>; winner: 0 | Side; nextId: number };
export const COST: Record<Kind, number> = { infantry: 100, scout: 180, tank: 300, artillery: 260 };
export const STATS: Record<Kind, { hp: number; movement: number; power: number; min: number; max: number }> = {
  infantry: { hp: 10, movement: 3, power: 4, min: 1, max: 1 },
  scout: { hp: 8, movement: 5, power: 3, min: 1, max: 1 },
  tank: { hp: 10, movement: 4, power: 6, min: 1, max: 1 },
  artillery: { hp: 8, movement: 2, power: 6, min: 2, max: 3 },
};
const maps = [
 ['...F....M.','..F.......','.....F....','.F..~~.F..','....~~....','...F......','..M....F..','...F......'],
 ['.F....F...','...F...M..','..F.......','...~~~....','.....F....','..M....F..','........F.','.F....M...'],
 ['...M...F..','..F....F..','...F......','..~~..~~..','...F......','......F...','..F...M...','....F.....'],
];
const scenarios: Array<{ units: Array<[Side,Kind,number,number]>; sites: Array<[number,number,'base'|'city',0|Side]> }> = [
  { units: [[1,'infantry',1,6],[1,'tank',2,6],[1,'scout',1,7],[2,'infantry',8,1],[2,'tank',7,1],[2,'scout',8,0]],
    sites: [[0,7,'base',1],[9,0,'base',2],[2,3,'city',0],[7,4,'city',0]] },
  { units: [[1,'infantry',0,6],[1,'artillery',1,7],[1,'scout',2,6],[2,'infantry',9,1],[2,'artillery',8,0],[2,'tank',8,2]],
    sites: [[0,7,'base',1],[9,0,'base',2],[2,2,'city',0],[6,5,'city',0],[5,2,'city',0]] },
  { units: [[1,'infantry',0,6],[1,'tank',2,7],[1,'artillery',1,7],[2,'infantry',9,1],[2,'tank',7,0],[2,'artillery',8,0]],
    sites: [[0,7,'base',1],[9,0,'base',2],[3,2,'city',0],[6,5,'city',0],[4,6,'city',0]] },
];
export function createBattle(mission = 0, mode: Battle['mode'] = 'ai'): Battle {
  const i = Math.max(0, Math.min(maps.length - 1, Math.floor(mission) || 0));
  const s = scenarios[i];
  return { version: 1, mission: i, mode, tiles: [...maps[i]],
    units: s.units.map(([side,kind,x,y],index) => ({ id:index+1, side, kind, x,y, hp:STATS[kind].hp, moved:false, acted:false })),
    sites:s.sites.map(([x,y,kind,side])=>({x,y,kind,side})), turn:1, round:1, gold:{1:300,2:300}, winner:0, nextId:s.units.length+1 };
}
export const distance = (a:{x:number;y:number},b:{x:number;y:number}) => Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
export const at = (s:Battle,x:number,y:number) => s.units.find(u=>u.x===x&&u.y===y);
export const siteAt = (s:Battle,x:number,y:number) => s.sites.find(p=>p.x===x&&p.y===y);
export const tileAt = (s:Battle,x:number,y:number) => s.tiles[y]?.[x] as Terrain | undefined;
const inside = (x:number,y:number) => x>=0&&x<10&&y>=0&&y<8;
const cost = (tile:Terrain|undefined,kind:Kind) => tile==='~'||(tile==='M'&&kind!=='infantry')?Infinity:tile==='F'&&kind!=='infantry'?2:1;
function own(s:Battle,id:number) { const u=s.units.find(u=>u.id===id); if(!u||u.side!==s.turn||s.winner) throw Error('Invalid turn or unit');return u; }
export function moves(s:Battle,id:number) {
  const u=s.units.find(u=>u.id===id);if(!u||u.moved||u.acted||u.side!==s.turn||s.winner)return [];
  const seen=new Map<string,number>([[u.x+','+u.y,0]]), pending=[{x:u.x,y:u.y,d:0}];
  while(pending.length){pending.sort((a,b)=>a.d-b.d);const p=pending.shift()!;
    if(p.d!==seen.get(p.x+','+p.y))continue;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const x=p.x+dx,y=p.y+dy;if(!inside(x,y)||at(s,x,y))continue;
      const d=p.d+cost(tileAt(s,x,y),u.kind),key=x+','+y;
      if(d>STATS[u.kind].movement||d>=(seen.get(key)??Infinity))continue;
      seen.set(key,d);pending.push({x,y,d});
    }
  }
  seen.delete(u.x+','+u.y);return [...seen].map(([key])=>{const [x,y]=key.split(',').map(Number);return {x,y};});
}
export function targets(s:Battle,id:number) {
  const u=s.units.find(u=>u.id===id);if(!u||u.acted||u.side!==s.turn||s.winner||(u.kind==='artillery'&&u.moved))return [];
  const spec=STATS[u.kind];return s.units.filter(v=>v.side!==u.side&&distance(v,u)>=spec.min&&distance(v,u)<=spec.max);
}
export function move(s:Battle,id:number,x:number,y:number) {
  const u=own(s,id);if(!moves(s,id).some(m=>m.x===x&&m.y===y))throw Error('Illegal movement');
  u.x=x;u.y=y;u.moved=true;return s;
}
export function attack(s:Battle,id:number,targetId:number) {
  const u=own(s,id),v=s.units.find(u=>u.id===targetId);
  if(!v||!targets(s,id).some(t=>t.id===targetId))throw Error('Illegal attack');
  const t=tileAt(s,v.x,v.y),defense=(t==='F'?1:t==='M'?2:0)+(siteAt(s,v.x,v.y)?1:0);
  const damage=Math.max(1,Math.round((STATS[u.kind].power-defense)*u.hp/STATS[u.kind].hp));
  v.hp=Math.max(0,v.hp-damage);u.acted=true;u.moved=true;
  if(!v.hp)s.units=s.units.filter(x=>x.id!==v.id);
  else if(v.kind!=='artillery'&&distance(u,v)===1){
    u.hp=Math.max(0,u.hp-Math.max(1,Math.round(STATS[v.kind].power*v.hp/STATS[v.kind].hp)/2));
    if(!u.hp)s.units=s.units.filter(x=>x.id!==u.id);
  }
  checkWin(s);return s;
}
export function capture(s:Battle,id:number) {
  const u=own(s,id),p=siteAt(s,u.x,u.y);if(u.kind!=='infantry'||u.acted||!p||p.side===u.side)throw Error('Illegal capture');
  const was=p.side;p.side=u.side;u.acted=true;u.moved=true;if(p.kind==='base'&&was!==0)s.winner=u.side;return s;
}
export function train(s:Battle,kind:Kind,x:number,y:number) {
  if(s.winner||!STATS[kind]||s.gold[s.turn]<COST[kind]||at(s,x,y)||!s.sites.some(p=>p.kind==='base'&&p.side===s.turn&&p.x===x&&p.y===y))throw Error('Illegal recruitment');
  s.gold[s.turn]-=COST[kind];s.units.push({id:s.nextId++,side:s.turn,kind,x,y,hp:STATS[kind].hp,moved:true,acted:true});return s;
}
export function finishTurn(s:Battle) {
  if(s.winner)return s;
  s.turn=s.turn===1?2:1;if(s.turn===1)s.round++;
  s.gold[s.turn]+=s.sites.filter(p=>p.side===s.turn).reduce((n,p)=>n+(p.kind==='base'?150:100),0);
  s.units.forEach(u=>{if(u.side===s.turn){u.moved=false;u.acted=false;}});return s;
}
function checkWin(s:Battle) { for(const team of [1,2] as const){if(!s.units.some(u=>u.side===team))s.winner=team===1?2:1;} }
export function aiTurn(s:Battle) {
  if(s.mode!=='ai'||s.turn!==2||s.winner)return s;
  for(const u of [...s.units].filter(u=>u.side===2)){
    let enemy=targets(s,u.id)[0];
    if(enemy){attack(s,u.id,enemy.id);continue;}
    const m=moves(s,u.id);
    if(m.length){const objective=s.sites.find(p=>p.side!==2)??s.units.find(u=>u.side===1);
      m.sort((a,b)=>(objective?distance(a,objective)-distance(b,objective):0));
      move(s,u.id,m[0].x,m[0].y);
      if(u.kind==='infantry'&&siteAt(s,u.x,u.y)?.side!==2&&siteAt(s,u.x,u.y))capture(s,u.id);
      enemy=targets(s,u.id)[0];if(enemy)attack(s,u.id,enemy.id);
    }
  }
  if(!s.winner)finishTurn(s);return s;
}