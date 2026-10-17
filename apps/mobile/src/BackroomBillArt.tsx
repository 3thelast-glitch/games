import { useId } from 'react';
import {
  MAP_SIZE, remainingPieces, type Enemy, type EnemyKind,
  type Room,
} from '../../../packages/games/backroom-bill/engine.ts';

export const VIEW_WIDTH=720;
export const VIEW_HEIGHT=600;
export const BACKROOM_TILE=56;
export const backroomColors={
  floor:'#c7b06d',floorBright:'#dbc77f',wall:'#ebd976',wallLight:'#f9e894',
  wallpaper:'#e7d07a',corner:'#9f853e',shadow:'#6f6238',door:'#7da180',
  red:'#b64547',ink:'#38372a',hazmat:'#f5c845',
};
const PI=Math.PI;
const drawLine=(ctx:CanvasRenderingContext2D,x1:number,y1:number,x2:number,y2:number)=>{
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
};
const drawCircle=(ctx:CanvasRenderingContext2D,x:number,y:number,r:number)=>{
  ctx.beginPath();ctx.arc(x,y,r,0,PI*2);
};
const fillRound=(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number,color:string)=>{
  ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();
};
function drawBill(ctx:CanvasRenderingContext2D,x:number,y:number,angle:number,t:number,invulnerable=false){
  if(invulnerable&&Math.floor(t*10)%2===0)return;
  ctx.save();ctx.translate(x,y);ctx.rotate(angle+PI/2);
  ctx.fillStyle='#6e5630';ctx.globalAlpha=.19;
  ctx.beginPath();ctx.ellipse(3,6,19,15,.15,0,PI*2);ctx.fill();ctx.globalAlpha=1;
  const step=Math.sin(t*12)*3;
  fillRound(ctx,-15,8+step,12,13,4,'#5b543d');
  fillRound(ctx,4,8-step,12,13,4,'#5b543d');
  fillRound(ctx,-22,-5,11,21,5,'#d3982b');
  fillRound(ctx,11,-5,11,21,5,'#d3982b');
  fillRound(ctx,-17,-12,34,34,10,'#9d752e');
  fillRound(ctx,-16,-15,32,32,9,backroomColors.hazmat);
  fillRound(ctx,-12,1,24,9,4,'#edab35');
  fillRound(ctx,-8,7,16,7,4,'#675a41');
  ctx.fillStyle='#fbe58d';drawCircle(ctx,0,-15,19);ctx.fill();
  ctx.lineWidth=3;ctx.strokeStyle='#ac8933';ctx.stroke();
  ctx.fillStyle='#ac9950';drawCircle(ctx,0,-13,14.5);ctx.fill();
  ctx.fillStyle='#253f48';ctx.beginPath();ctx.ellipse(0,-15,12,9,0,0,PI*2);ctx.fill();
  ctx.fillStyle='#8fc5bf';ctx.beginPath();ctx.ellipse(-3,-19,6,3,-.15,0,PI*2);ctx.fill();
  fillRound(ctx,-8,-8,16,6,2,'#354347');
  ctx.fillStyle='#71847b';drawCircle(ctx,0,-5,3.5);ctx.fill();
  ctx.restore();
}
function drawMonster(ctx:CanvasRenderingContext2D,m:Enemy,t:number,reduced:boolean){
  ctx.save();ctx.translate(m.x*BACKROOM_TILE,m.y*BACKROOM_TILE);
  const sway=reduced?0:Math.sin(t*3+m.id)*2;
  ctx.translate(0,sway);
  ctx.fillStyle='#3e322d';ctx.globalAlpha=.24;
  ctx.beginPath();ctx.ellipse(0,12,21,11,0,0,PI*2);ctx.fill();
  ctx.globalAlpha=1;
  if(m.kind==='moth'){
    ctx.fillStyle='#555052';ctx.beginPath();
    ctx.ellipse(-14,-4,16,21,-.5,0,PI*2);
    ctx.ellipse(14,-4,16,21,.5,0,PI*2);ctx.fill();
    ctx.fillStyle='#2f3335';drawCircle(ctx,0,0,11);ctx.fill();
    ctx.strokeStyle='#c8bfa3';ctx.lineWidth=2;
    drawLine(ctx,-5,-7,-9,-17);drawLine(ctx,5,-7,9,-17);
  } else if(m.kind==='grin'){
    ctx.fillStyle='#28242a';ctx.beginPath();
    ctx.moveTo(-16,-13);ctx.quadraticCurveTo(-23,3,-13,17);
    ctx.lineTo(15,15);ctx.quadraticCurveTo(23,0,14,-13);
    ctx.closePath();ctx.fill();
    ctx.strokeStyle='#e7dfb9';ctx.lineWidth=2.8;ctx.beginPath();
    ctx.arc(0,2,11,.15,PI-.15);ctx.stroke();
    for(let i=-7;i<=7;i+=5)drawLine(ctx,i,6,i+1,11);
  } else {
    ctx.fillStyle='#37312b';ctx.beginPath();
    ctx.moveTo(-13,-18);ctx.quadraticCurveTo(-24,-10,-18,10);
    ctx.lineTo(-23,23);ctx.lineTo(-7,15);ctx.lineTo(6,21);ctx.lineTo(16,14);
    ctx.lineTo(23,25);ctx.lineTo(17,4);ctx.quadraticCurveTo(19,-20,0,-23);
    ctx.closePath();ctx.fill();
  }
  ctx.fillStyle=m.alerted?'#fc6b49':'#f0ca8a';
  drawCircle(ctx,-6,-3,3.5);ctx.fill();
  drawCircle(ctx,6,-3,3.5);ctx.fill();
  if(m.alerted){ctx.shadowColor='#e64d3c';ctx.shadowBlur=14;
    drawCircle(ctx,-6,-3,3);ctx.fill();drawCircle(ctx,6,-3,3);ctx.fill();}
  ctx.restore();
}
function drawWall(ctx:CanvasRenderingContext2D,x:number,y:number,
  neighbors:{left:boolean;right:boolean;up:boolean;down:boolean},seed:number){
  const t=BACKROOM_TILE;
  const edge=4;
  ctx.fillStyle='#b39e57';ctx.fillRect(x+2,y+9,t-2,t-5);
  ctx.fillStyle=backroomColors.wall;ctx.fillRect(x,y,t,t-11);
  ctx.fillStyle=backroomColors.wallLight;ctx.fillRect(x+2,y+2,t-4,t-17);
  // Vertical faded wallpaper stripes: flat cartoon illustration, not photo texture.
  ctx.strokeStyle='#d7be66';ctx.lineWidth=1.35;ctx.globalAlpha=.48;
  for(let i=7;i<t;i+=11)drawLine(ctx,x+i,y+4,x+i,y+t-16);
  ctx.globalAlpha=1;
  ctx.fillStyle='#c4aa57';ctx.fillRect(x,y+t-16,t,5);
  ctx.fillStyle='#a88e46';ctx.fillRect(x,y+t-11,t,5);
  if(!neighbors.up){
    ctx.fillStyle='#fff0a1';ctx.fillRect(x+edge,y+2,t-edge*2,3);
    ctx.fillStyle='#efdf83';ctx.fillRect(x+3,y+6,t-6,4);
  }
  if(!neighbors.down){
    ctx.fillStyle='#8d793f';ctx.fillRect(x,y+t-4,t,4);
  }
  if(!neighbors.right){ctx.fillStyle='#998146';ctx.fillRect(x+t-6,y+8,6,t-8);}
  if(!neighbors.left){ctx.fillStyle='#fff0a9';ctx.fillRect(x,y+5,3,t-12);}
  if((seed+x*11+y*7)%29===0){
    ctx.fillStyle='#c5ab60';ctx.fillRect(x+15,y+15,14,2);
  }
}
export function paintBackroom(
  ctx:CanvasRenderingContext2D,room:Room,progressTime:number,
  reducedMotion=false,
){
  const t=BACKROOM_TILE;
  const cameraX=room.player.x*t-VIEW_WIDTH/2;
  const cameraY=room.player.y*t-VIEW_HEIGHT/2;
  const x1=Math.max(0,Math.floor(cameraX/t)-1);
  const y1=Math.max(0,Math.floor(cameraY/t)-1);
  const x2=Math.min(room.width-1,Math.ceil((cameraX+VIEW_WIDTH)/t)+1);
  const y2=Math.min(room.height-1,Math.ceil((cameraY+VIEW_HEIGHT)/t)+1);
  ctx.save();
  ctx.fillStyle='#241e19';ctx.fillRect(0,0,VIEW_WIDTH,VIEW_HEIGHT);
  ctx.translate(-cameraX,-cameraY);
  for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++){
    const sx=x*t,sy=y*t,index=y*room.width+x;
    if(room.walls[index]===0){
      const off=(x*29+y*23+room.seed)%13;
      ctx.fillStyle=off<=2?'#cfba73':off>=11?'#c4af6b':backroomColors.floor;
      ctx.fillRect(sx,sy,t+1,t+1);
      ctx.fillStyle='#dfcc89';ctx.globalAlpha=.27;
      ctx.fillRect(sx+3,sy+3,t-6,1.4);
      ctx.globalAlpha=1;
      ctx.strokeStyle='#ad9859';ctx.lineWidth=.85;ctx.globalAlpha=.19;
      drawLine(ctx,sx,sy+t-1,sx+t,sy+t-1);
      drawLine(ctx,sx+t-1,sy,sx+t-1,sy+t);ctx.globalAlpha=1;
      if(off===8){ctx.fillStyle='#9e945e';ctx.globalAlpha=.22;ctx.fillRect(sx+9,sy+28,23,5);ctx.globalAlpha=1;}
      continue;
    }
    const nearby=(dx:number,dy:number)=>{
      const nx=x+dx,ny=y+dy;
      return nx<0||ny<0||nx>=room.width||ny>=room.height ||
        room.walls[ny*room.width+nx]===1;
    };
    drawWall(ctx,sx,sy,{up:nearby(0,-1),down:nearby(0,1),
      left:nearby(-1,0),right:nearby(1,0)},room.seed);
  }
  // Fluorescent overhead fixtures suspended visually above traversable corridors.
  for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++){
    if((x+room.seed)%6!==0||(y*3+room.depth)%5!==0||room.walls[y*room.width+x]!==0)continue;
    const sx=x*t,sy=y*t;
    ctx.fillStyle='#e4d6a0';ctx.fillRect(sx+11,sy+8,37,9);
    ctx.fillStyle='#f9ecba';ctx.fillRect(sx+13,sy+10,33,5);
  }
  const portal=room.exit;
  const done=remainingPieces(room)===0;
  fillRound(ctx,portal.x*t+4,portal.y*t+2,t-8,t-6,5,done?'#4f846e':'#666956');
  fillRound(ctx,portal.x*t+12,portal.y*t+5,t-24,t-11,3,done?'#89c6a0':'#3d4841');
  ctx.fillStyle=done?'#def9c7':'#959992';ctx.font='700 13px sans-serif';
  ctx.textAlign='center';ctx.fillText(done?'EXIT':'LOCK',portal.x*t+t/2,portal.y*t+t/2+4);
  for(const trap of room.traps){
    if(!trap.armed)continue;
    const tx=(trap.x+.5)*t,ty=(trap.y+.5)*t;
    ctx.save();ctx.translate(tx,ty);
    ctx.fillStyle='#595d4a';ctx.beginPath();ctx.moveTo(0,-17);ctx.lineTo(16,0);
    ctx.lineTo(0,17);ctx.lineTo(-16,0);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#e9ae65';ctx.lineWidth=3;
    ctx.stroke();drawLine(ctx,-8,0,8,0);drawLine(ctx,0,-8,0,8);
    ctx.restore();
  }
  for(const piece of room.pieces){
    if(piece.found)continue;
    const px=(piece.x+.5)*t,py=(piece.y+.5)*t;
    ctx.save();ctx.translate(px,py);
    const bob=reducedMotion?0:Math.sin(progressTime*3+piece.x)*3;
    ctx.translate(0,bob);ctx.shadowColor='#9fe4e8';ctx.shadowBlur=12;
    ctx.fillStyle='#49c2c2';ctx.beginPath();ctx.moveTo(0,-13);
    ctx.lineTo(10,-4);ctx.lineTo(9,9);ctx.lineTo(-9,12);ctx.lineTo(-12,-4);
    ctx.closePath();ctx.fill();
    ctx.shadowBlur=0;ctx.strokeStyle='#efffea';ctx.lineWidth=2;
    drawLine(ctx,-8,-2,3,-8);drawLine(ctx,3,-8,9,-3);
    ctx.restore();
  }
  for(const enemy of room.enemies)if(enemy.active)drawMonster(ctx,enemy,room.elapsed,reducedMotion);
  drawBill(ctx,room.player.x*t,room.player.y*t,room.facing,room.movePhase,
    room.invulnerable>0);
  ctx.restore();
  // Camera-attached lighting: readable around player, deep dark peripheral corners.
  const radius=Math.max(VIEW_WIDTH,VIEW_HEIGHT)*.73;
  const dark=ctx.createRadialGradient(VIEW_WIDTH/2,VIEW_HEIGHT/2,125,
    VIEW_WIDTH/2,VIEW_HEIGHT/2,radius);
  dark.addColorStop(0,'#30250e00');
  dark.addColorStop(.58,'#271e1633');
  dark.addColorStop(1,'#171313f2');
  ctx.fillStyle=dark;ctx.fillRect(0,0,VIEW_WIDTH,VIEW_HEIGHT);
  const ambient=reducedMotion?0:Math.sin(progressTime*3.1)*.018;
  ctx.fillStyle='rgba(246,210,105,'+(.055+ambient)+')';
  ctx.fillRect(0,0,VIEW_WIDTH,VIEW_HEIGHT);
  // Soft vignette and scan noise remain low contrast to avoid strobing.
  ctx.save();ctx.globalAlpha=.10;ctx.strokeStyle='#6b563e';ctx.lineWidth=1;
  for(let y=1;y<VIEW_HEIGHT;y+=5)drawLine(ctx,0,y,VIEW_WIDTH,y);
  ctx.restore();
}
export function paintBackroomMap(ctx:CanvasRenderingContext2D,room:Room) {
  const t=5.25;
  const left=6,top=6;
  ctx.save();ctx.clearRect(0,0,MAP_SIZE*t+12,MAP_SIZE*t+12);
  fillRound(ctx,0,0,MAP_SIZE*t+12,MAP_SIZE*t+12,8,'#0c1014ee');
  for(let y=0;y<room.height;y++)for(let x=0;x<room.width;x++){
    const i=y*room.width+x;
    if(room.seen[i]!==1)continue;
    ctx.fillStyle=room.walls[i]===0?'#b3aa7e':'#555943';
    ctx.fillRect(left+x*t,top+y*t,t+.3,t+.3);
  }
  const point=(p:{x:number;y:number},color:string,sz=2.6)=>{
    ctx.fillStyle=color;drawCircle(ctx,left+p.x*t,top+p.y*t,sz);ctx.fill();
  };
  const allPiecesFound=remainingPieces(room)===0;
  if(room.seen[room.exit.y*room.width+room.exit.x])point({x:room.exit.x+.5,y:room.exit.y+.5},
    allPiecesFound?'#6ef5a2':'#b7aa8a',3.7);
  for(const p of room.pieces)if(!p.found && room.seen[p.y*room.width+p.x])
    point({x:p.x+.5,y:p.y+.5},'#6ae0e8');
  for(const e of room.enemies)if(e.active&&e.alerted)
    point(e,'#f05a56',3);
  point(room.player,'#ffe169',4.2);
  ctx.restore();
}
export function BackroomBillCover() {
  const id=useId().replace(/:/g,'')+'-bill';
  return <svg viewBox="0 0 480 444" preserveAspectRatio="xMidYMid slice" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id={id+'floor'} x2=".8" y2="1">
        <stop stopColor="#decd8b"/><stop offset="1" stopColor="#ac9861"/>
      </linearGradient>
      <linearGradient id={id+'wall'} x2="0" y2="1">
        <stop stopColor="#f9e796"/><stop offset=".82" stopColor="#d5bc69"/><stop offset="1" stopColor="#a88b49"/>
      </linearGradient>
      <radialGradient id={id+'light'}>
        <stop stopColor="#fff9ce" stopOpacity=".5"/><stop offset="1" stopColor="#191d20" stopOpacity=".4"/>
      </radialGradient>
    </defs>
    <rect width="480" height="444" fill={'url(#'+id+'floor)'}/>
    <path d="M0 0H480V85H292V184H392V444H298V285H187V372H82V281H0Z"
      fill="#524a2c" opacity=".36" transform="translate(9 12)"/>
    <path d="M0 0H480V85H292V184H392V444H298V285H187V372H82V281H0Z"
      fill={'url(#'+id+'wall)'} stroke="#ad954b" strokeWidth="8" strokeLinejoin="miter"/>
    <g stroke="#c6ad5d" strokeWidth="2" opacity=".65">
      {Array.from({length:18},(_,i)=><path key={i} d={'M'+(i*31)+' 5v73'}/>)}
      {Array.from({length:12},(_,i)=><path key={'v'+i} d={'M304 '+(i*32+92)+'h78'}/>)}
    </g>
    <rect x="0" y="0" width="480" height="444" fill={'url(#'+id+'light)'}/>
    <g transform="translate(222 255)">
      <ellipse cx="8" cy="22" rx="41" ry="18" fill="#41321b" opacity=".4"/>
      <path d="M-18 3l-7 21h13l8-15M15 3l13 21H13L7 8" fill="#5f5535" stroke="#2c302c" strokeWidth="4"/>
      <rect x="-24" y="-18" width="48" height="43" rx="16" fill="#f0bc34" stroke="#9c802e" strokeWidth="5"/>
      <rect x="-35" y="-15" width="18" height="32" rx="7" fill="#e5a42b" stroke="#a47d29" strokeWidth="4"/>
      <rect x="18" y="-15" width="18" height="32" rx="7" fill="#e5a42b" stroke="#a47d29" strokeWidth="4"/>
      <circle cx="0" cy="-27" r="29" fill="#f4ca3e" stroke="#8f7c3c" strokeWidth="6"/>
      <ellipse cx="0" cy="-29" rx="20" ry="15" fill="#223b42"/>
      <ellipse cx="-6" cy="-34" rx="9" ry="5" fill="#94c1b9" opacity=".9"/>
      <rect x="-13" y="-14" width="26" height="9" rx="4" fill="#455457"/>
    </g>
    <g transform="translate(341 342)">
      <ellipse rx="33" ry="17" cy="18" fill="#231d21" opacity=".6"/>
      <path d="M-22 -39Q-42 -25 -28 13L-34 41L-8 26L14 40L27 22L32 40L25 -19Q10 -58 -22 -39"
        fill="#3b3634" stroke="#201f23" strokeWidth="5"/>
      <ellipse cx="-12" cy="-12" rx="6" ry="6" fill="#fa694b"/>
      <ellipse cx="11" cy="-12" rx="6" ry="6" fill="#fa694b"/>
    </g>
    <g transform="translate(136 214)">
      <path d="M0 -20L17 -3L11 20L-12 21L-21 -4Z" fill="#48bdbb" stroke="#e5fff2" strokeWidth="4"/>
      <path d="M-17 -2L7 -15" stroke="#e2fffa" strokeWidth="3"/>
    </g>
  </svg>;
}
