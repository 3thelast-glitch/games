/**
 * Backroom Bill — original offline top-down maze survival game.
 * The procedural maps, code, monster sprites and story are original.
 * Units are grid cells, with a deterministic 60 Hz simulation.
 */
export const MAP_SIZE = 29;
export const BACKROOM_STEP = 1 / 60;
export const MAX_DEPTH = 24;
export type Point = { x: number; y: number };
export type EnemyKind = 'lurker' | 'grin' | 'moth';
export type Phase = 'exploring' | 'escape' | 'dead';
export interface Enemy {
  id: number; kind: EnemyKind; x: number; y: number;
  active: boolean; alerted: boolean; cooldown: number;
  target: Point; pathTimer: number;
}
export interface Relic extends Point { found: boolean }
export interface Trap extends Point { armed: boolean }
export interface Room {
  depth: number; seed: number; width: number; height: number; walls: number[];
  start: Point; exit: Point; player: Point; facing: number; lives: number;
  stamina: number; invulnerable: number; elapsed: number; movePhase: number;
  pieces: Relic[]; traps: Trap[]; enemies: Enemy[];
  seen: number[]; phase: Phase; event: 'found' | 'caught' | 'trap' | 'exit' | null;
  discoveries: EnemyKind[];
}
export interface BackroomProgress { unlocked: number; deepest: number; catalog: EnemyKind[]; escapes: number }
export const MONSTERS: readonly EnemyKind[] = ['lurker', 'grin', 'moth'];
export const BACKROOM_SAVE = 'backroom-bill-offline-v1';
export const defaultBackroomProgress = (): BackroomProgress => ({
  unlocked: 1, deepest: 1, catalog: [], escapes: 0,
});
const pos = (x: number, y: number, width=MAP_SIZE) => y * width + x;
const copy = (p: Point): Point => ({ x: p.x, y: p.y });
const cell = (p: Point): Point => ({ x: Math.floor(p.x), y: Math.floor(p.y) });
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const distance = (a: Point, b: Point) => Math.hypot(a.x-b.x,a.y-b.y);
export function seededRandom(seed: number): () => number {
  let s = (seed | 0) || 1;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 1 | s) + 0x6d2b79f5) | 0;
    s = Math.imul(s ^ (s >>> 11), 61 | s) ^ s;
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}
const DIRECTIONS: readonly Point[] = [
  {x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1},
];
export function walkable(room: Pick<Room, 'width'|'height'|'walls'>, x: number, y: number): boolean {
  const ix=Math.floor(x),iy=Math.floor(y);
  return ix>=0 && iy>=0 && ix<room.width && iy<room.height &&
    room.walls[pos(ix,iy,room.width)] === 0;
}
export function shortestPath(room: Pick<Room, 'width'|'height'|'walls'>, a: Point, b: Point): Point[] {
  const start=cell(a),end=cell(b);
  if(!walkable(room,start.x,start.y)||!walkable(room,end.x,end.y))return [];
  const key=pos(start.x,start.y,room.width),goal=pos(end.x,end.y,room.width);
  if(key===goal)return [start];
  const parent=new Int32Array(room.walls.length).fill(-1);
  const queue=new Int32Array(room.walls.length);
  let head=0,tail=1;
  queue[0]=key;parent[key]=key;
  while(head<tail){
    const current=queue[head++]!;
    const x=current%room.width,y=Math.floor(current/room.width);
    for(const d of DIRECTIONS){
      const nx=x+d.x,ny=y+d.y;
      if(!walkable(room,nx,ny))continue;
      const next=pos(nx,ny,room.width);
      if(parent[next]!==-1)continue;
      parent[next]=current;queue[tail++]=next;
      if(next===goal){
        const path:Point[]=[];
        let c=next;
        while(c!==key){
          path.push({x:c%room.width,y:Math.floor(c/room.width)});
          c=parent[c]!;
        }
        path.push(start);
        path.reverse();return path;
      }
    }
  }
  return [];
}
export function discover(room: Room, x: number, y: number): void {
  const px=Math.floor(x),py=Math.floor(y);
  for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
    if(dx*dx+dy*dy>12)continue;
    const nx=px+dx,ny=py+dy;
    if(nx<0||ny<0||nx>=room.width||ny>=room.height)continue;
    room.seen[pos(nx,ny,room.width)]=1;
  }
}
export function createRoom(depth=1, seed=0): Room {
  const floor=clamp(Math.floor(Number.isFinite(depth)?depth:1),1,MAX_DEPTH);
  const normalizedSeed=(seed|0)||Math.imul(floor,0x4f1bbcdc) ^ 0x18f3a5;
  const random=seededRandom(normalizedSeed);
  const w=MAP_SIZE,h=MAP_SIZE,walls=new Array<number>(w*h).fill(1);
  const start={x:1,y:1};
  const stack:Point[]=[start];
  walls[pos(1,1)]=0;
  // Perfect connected maze, with loops/open rooms added after carving.
  while(stack.length){
    const current=stack[stack.length-1]!;
    const choices=DIRECTIONS.map(d=>({x:current.x+2*d.x,y:current.y+2*d.y}))
      .filter(v=>v.x>0&&v.y>0&&v.x<w-1&&v.y<h-1&&walls[pos(v.x,v.y)]===1);
    if(!choices.length){stack.pop();continue;}
    const next=choices[Math.floor(random()*choices.length)]!;
    walls[pos((next.x+current.x)/2,(next.y+current.y)/2)]=0;
    walls[pos(next.x,next.y)]=0;stack.push(next);
  }
  // Open irregular chambers, always anchored to reachable maze cells.
  for(let i=0;i<8+Math.min(8,floor);i++){
    const x=1+Math.floor(random()*13)*2,y=1+Math.floor(random()*13)*2;
    const rx=random()>.4?2:1,ry=random()>.4?2:1;
    for(let cy=Math.max(1,y-ry);cy<=Math.min(h-2,y+ry);cy++)
      for(let cx=Math.max(1,x-rx);cx<=Math.min(w-2,x+rx);cx++)
        walls[pos(cx,cy)]=0;
  }
  const grid={width:w,height:h,walls};
  const candidates: {point:Point, steps:number}[]=[];
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    if(!walkable(grid,x,y))continue;
    const path=shortestPath(grid,start,{x,y});
    if(path.length)candidates.push({point:{x,y},steps:path.length});
  }
  candidates.sort((a,b)=>b.steps-a.steps);
  const exit=copy(candidates[0]?.point??{x:w-2,y:h-2});
  const used=new Set<string>([pos(start.x,start.y).toString(),pos(exit.x,exit.y).toString()]);
  const spaced=(fraction:number, minDist:number):Point=>{
    const target=Math.floor(candidates.length*fraction);
    for(let offset=0;offset<candidates.length;offset++){
      const c=candidates[(target+offset)%candidates.length]!.point;
      const k=pos(c.x,c.y).toString();
      if(used.has(k) || distance(c,start)<minDist ||
        [...used].some(v=>{
          const number=Number(v);
          return Math.hypot(c.x-number%w,c.y-Math.floor(number/w))<4;
        }))continue;
      used.add(k);return copy(c);
    }
    const fallback=candidates.find(c=>!used.has(pos(c.point.x,c.point.y).toString()))?.point??start;
    used.add(pos(fallback.x,fallback.y).toString());return copy(fallback);
  };
  const pieces:Array<Relic>=Array.from({length:3+Math.min(3,Math.floor(floor/4))},(_,i)=>({
    ...spaced(.11+i*.16,6),found:false,
  }));
  const traps:Trap[]=Array.from({length:2+Math.min(2,Math.floor(floor/7))},(_,i)=>({
    ...spaced(.24+i*.22,5),armed:true,
  }));
  const enemies:Enemy[]=Array.from({length:Math.min(3,1+Math.floor((floor-1)/5))},(_,i)=>{
    const spawn=spaced(.07+i*.17,11);
    return {
      id:i,kind:MONSTERS[(floor-1+i)%MONSTERS.length]!,
      x:spawn.x+.5,y:spawn.y+.5,active:true,alerted:false,cooldown:0,
      target:copy(spawn),pathTimer:0,
    };
  });
  const room:Room={
    depth:floor,seed:normalizedSeed,width:w,height:h,walls,
    start:copy(start),exit,player:{x:1.5,y:1.5},facing:0,
    lives:3,stamina:1,invulnerable:1.5,elapsed:0,movePhase:0,
    pieces,traps,enemies,seen:new Array<number>(w*h).fill(0),
    phase:'exploring',event:null,discoveries:[],
  };
  discover(room,1.5,1.5);
  return room;
}
function canOccupy(room:Room,x:number,y:number,radius=.24):boolean{
  return [
    [x-radius,y-radius],[x+radius,y-radius],
    [x-radius,y+radius],[x+radius,y+radius],
    [x,y-radius],[x,y+radius],[x-radius,y],[x+radius,y],
  ].every(([px,py])=>walkable(room,px!,py!));
}
function moveBody(room:Room,body:Point,dx:number,dy:number,radius=.24):void{
  if(canOccupy(room,body.x+dx,body.y,radius))body.x+=dx;
  if(canOccupy(room,body.x,body.y+dy,radius))body.y+=dy;
}
function recordEnemy(room:Room,kind:EnemyKind):void{
  if(!room.discoveries.includes(kind))room.discoveries.push(kind);
}
export function tickRoom(
  room:Room,input:Point={x:0,y:0},dt=BACKROOM_STEP,sprint=false,
):void{
  if(room.phase!=='exploring')return;
  if(!Number.isFinite(dt)||dt<=0||dt>1/30)throw new RangeError('Invalid fixed step');
  const length=Math.hypot(input.x,input.y);
  const vx=length>0?input.x/length:0,vy=length>0?input.y/length:0;
  const speed=sprint&&room.stamina>.025?4.6:2.65;
  room.stamina=clamp(room.stamina+(sprint&&length>.01?-dt*.22:dt*.13),0,1);
  if(length>.01)room.facing=Math.atan2(vy,vx);
  const moved=Math.hypot(vx,vy)*speed*dt;
  room.movePhase+=moved;
  moveBody(room,room.player,vx*speed*dt,vy*speed*dt);
  room.elapsed+=dt;
  room.invulnerable=Math.max(0,room.invulnerable-dt);
  discover(room,room.player.x,room.player.y);
  for(const piece of room.pieces){
    if(!piece.found&&distance(room.player,{x:piece.x+.5,y:piece.y+.5})<.62){
      piece.found=true;room.event='found';
    }
  }
  // Monster navigation: short deterministic BFS over fully connected maze.
  // Cheap timer removes repeated full path searches at 60fps.
  for(const enemy of room.enemies){
    if(!enemy.active)continue;
    enemy.cooldown=Math.max(0,enemy.cooldown-dt);
    const range=distance(room.player,enemy);
    enemy.alerted=range < 7.2 || (enemy.alerted&&range<11);
    enemy.pathTimer-=dt;
    if(enemy.pathTimer<=0){
      enemy.pathTimer=.22+enemy.id*.05;
      const chase=enemy.alerted?cell(room.player):enemy.target;
      const path=shortestPath(room,enemy,chase);
      if(!enemy.alerted&&(path.length<=1 || range>13)){
        // Patrol toward an adjacent non-wall tile, not toward player.
        const directions=DIRECTIONS.filter(d=>walkable(room,Math.floor(enemy.x)+d.x,Math.floor(enemy.y)+d.y));
        const next=directions[Math.floor(seededRandom(Math.floor(room.elapsed*4)+enemy.id*33+room.seed)()*directions.length)];
        if(next)enemy.target={x:Math.floor(enemy.x)+next.x,y:Math.floor(enemy.y)+next.y};
      }
      const nextPath=shortestPath(room,enemy,enemy.alerted?cell(room.player):enemy.target);
      enemy.target={
        x:nextPath[1]?.x??nextPath[0]?.x??Math.floor(enemy.x),
        y:nextPath[1]?.y??nextPath[0]?.y??Math.floor(enemy.y),
      };
    }
    const tx=enemy.target.x+.5,ty=enemy.target.y+.5;
    const deltaX=tx-enemy.x,deltaY=ty-enemy.y;
    const delta=Math.hypot(deltaX,deltaY);
    if(delta>.05){
      const amount=Math.min(delta,(enemy.alerted?1.62+room.depth*.024: .85)*dt);
      moveBody(room,enemy,deltaX/delta*amount,deltaY/delta*amount,.23);
    }
    for(const trap of room.traps){
      if(trap.armed && distance(enemy,{x:trap.x+.5,y:trap.y+.5})<.42){
        trap.armed=false;enemy.active=false;room.event='trap';
        recordEnemy(room,enemy.kind);break;
      }
    }
    if(enemy.active&&room.invulnerable===0&&distance(enemy,room.player)<.52){
      room.lives--;
      room.invulnerable=2.7;room.event='caught';
      recordEnemy(room,enemy.kind);
      if(room.lives<=0){room.phase='dead';return;}
      // Respawn at safe start, never inside a creature.
      room.player={x:room.start.x+.5,y:room.start.y+.5};
      room.stamina=.7;
      discover(room,room.player.x,room.player.y);
    }
  }
  if(room.pieces.every(p=>p.found)&&
    distance(room.player,{x:room.exit.x+.5,y:room.exit.y+.5})<.64){
    room.phase='escape';room.event='exit';
    for(const enemy of room.enemies)recordEnemy(room,enemy.kind);
  }
}
export function collectMessage(room:Room):Room['event'] {
  const event=room.event;room.event=null;return event;
}
export function remainingPieces(room:Room):number{return room.pieces.filter(p=>!p.found).length;}
export function saveBackroomProgress(raw:unknown):BackroomProgress{
  if(!raw||typeof raw!=='object')return defaultBackroomProgress();
  const value=raw as Record<string,unknown>;
  const number=(name:string,min:number,max:number,fallback:number)=>
    Number.isSafeInteger(value[name])?clamp(value[name] as number,min,max):fallback;
  const unlocked=number('unlocked',1,MAX_DEPTH,1);
  const deepest=number('deepest',1,MAX_DEPTH,1);
  const escapes=number('escapes',0,100000,0);
  const catalog=Array.isArray(value.catalog)?[...new Set(value.catalog)].filter(
    (key):key is EnemyKind=>MONSTERS.includes(key as EnemyKind)
  ):[];
  return {unlocked,deepest,catalog,escapes};
}
export function recordRoomVictory(previous:BackroomProgress,room:Room):BackroomProgress{
  if(room.phase!=='escape')return previous;
  return {
    unlocked:Math.max(previous.unlocked,Math.min(MAX_DEPTH,room.depth+1)),
    deepest:Math.max(previous.deepest,room.depth),
    escapes:previous.escapes+1,
    catalog:[...new Set([...previous.catalog,...room.discoveries])],
  };
}
export function recordRoomDefeat(previous:BackroomProgress,room:Room):BackroomProgress{
  if(room.phase!=='dead')return previous;
  return {...previous,catalog:[...new Set([...previous.catalog,...room.discoveries])]};
}
