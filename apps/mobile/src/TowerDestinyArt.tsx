import { useId } from 'react';
import {
  TOWER_HEIGHT,TOWER_WIDTH, type DefenseState,type Enemy,
  type Module,type Fx,
} from '../../../packages/games/tower-destiny/engine.ts';

const ink='#2d3942';
const round=(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number,color:string)=>{
  c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();
};
const line=(c:CanvasRenderingContext2D,x1:number,y1:number,x2:number,y2:number,color:string,w=3)=>{
  c.strokeStyle=color;c.lineWidth=w;c.lineCap='round';c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
};
const disk=(c:CanvasRenderingContext2D,x:number,y:number,r:number,color:string)=>{
  c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
};
function sky(c:CanvasRenderingContext2D,s:DefenseState){
  const gradient=c.createLinearGradient(0,0,0,650);
  gradient.addColorStop(0,s.stage%5===0?'#eb96a8':'#7af3e0');
  gradient.addColorStop(.65,s.stage%5===0?'#d3a6bb':'#58d6c6');
  gradient.addColorStop(1,s.stage%5===0?'#ecd3b1':'#a3ebe1');
  c.fillStyle=gradient;c.fillRect(0,0,TOWER_WIDTH,TOWER_HEIGHT);
  c.save();
  c.globalAlpha=.22;c.fillStyle='#318db4';
  for(let i=0;i<12;i++){
    const x=((i*75-s.timer*7)%525+525)%525-62;
    const h=85+(i*33)%120;
    c.fillRect(x,565-h,43+(i%3)*13,h);
    c.fillRect(x+14,545-h-18,10,25);
  }
  c.globalAlpha=.29;c.fillStyle='#306f92';
  for(let i=0;i<16;i++){
    const x=((i*47-s.timer*16)%520+520)%520-44;
    const h=45+(i*47)%95;
    c.fillRect(x,565-h,34+(i%3)*12,h);
  }
  c.restore();
  c.fillStyle='#b6d9c4';c.fillRect(0,563,420,8);
  c.fillStyle='#677c77';c.fillRect(0,571,420,56);
  c.fillStyle='#46575b';c.fillRect(0,619,420,61);
  c.strokeStyle='#dee6c7';c.lineWidth=5;
  c.beginPath();c.moveTo(0,633);c.lineTo(420,633);c.stroke();
  c.strokeStyle='#738b82';c.lineWidth=2;
  for(let i=0;i<7;i++){
    const x=((i*87-s.timer*25)%560+560)%560-86;
    line(c,x,590,x+39,590,'#c2d8bb',3);
  }
}
function wheel(c:CanvasRenderingContext2D,x:number,y:number,t:number){
  c.save();c.translate(x,y);c.rotate(t*.95);
  disk(c,0,0,24,'#273e44');disk(c,0,0,17,'#6b8587');disk(c,0,0,12,'#313a3b');
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5;
    disk(c,Math.cos(a)*8,Math.sin(a)*8,2.9,'#b9c6bb');
  }
  disk(c,0,0,4,'#c2a669');c.restore();
}
function gun(c:CanvasRenderingContext2D,x:number,y:number,kind:Module['weapon'],lv:number,t:number){
  c.save();c.translate(x,y);
  // Steel swivel, aligned horizontally toward the zombies.
  disk(c,0,0,18,'#4a6267');disk(c,0,0,12,'#b9d5d0');
  c.save();c.rotate(Math.sin(t*3+lv)*.045);
  if(kind==='flame'){
    round(c,4,-12,38,25,6,'#f88438');round(c,9,-7,28,14,4,'#e6c765');
    round(c,32,-8,17,17,3,'#47565d');
  }else if(kind==='saw'){
    round(c,0,-9,34,18,6,'#ffc453');disk(c,40,0,19,'#718c91');
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4+t*5;
      line(c,40+Math.cos(a)*12,Math.sin(a)*12,
        40+Math.cos(a)*23,Math.sin(a)*23,'#4d6265',5);
    }
    disk(c,40,0,10,'#d6e1dc');
  }else if(kind==='laser'){
    round(c,4,-12,38,24,5,'#617c9b');
    round(c,10,-6,25,12,4,'#6be2e9');
    round(c,34,-11,11,22,2,'#e5b66c');
  }else{
    round(c,5,-9,38,18,4,'#7595a5');
    round(c,17,-12,22,7,2,'#e7ad4e');
    round(c,35,-6,16,12,2,'#444e52');
  }
  c.restore();
  disk(c,0,0,7,'#e0b16b');c.restore();
}
function hero(c:CanvasRenderingContext2D,roofY:number,t:number){
  c.save();c.translate(126,roofY-15);
  c.strokeStyle=ink;c.lineWidth=3.8;c.lineCap='round';
  line(c,-12,0,-16,-31,'#b67345',6);
  line(c,19,-1,23,-26,'#b67345',6);
  round(c,-18,-55,38,41,8,'#d56846');
  round(c,-11,-55,26,25,3,'#617d5f');
  disk(c,0,-68,20,'#c58b5c');
  round(c,-17,-83,38,13,6,'#5a604c');
  round(c,-9,-93,20,15,5,'#53654d');
  disk(c,-7,-69,2.5,ink);disk(c,8,-69,2.5,ink);
  line(c,1,-62,6,-61,'#79482d',2.5);
  line(c,16,-36,42,-19,'#413c35',7);
  line(c,23,-39,55,-35,'#4d626b',9);
  line(c,43,-40,60,-41,'#263e49',5);
  // Floating red umbrella canopy on an arm
  line(c,-24,-67,-30,-151,'#685343',5);
  c.fillStyle='#ec6f59';c.strokeStyle='#694439';c.lineWidth=3;
  c.beginPath();c.moveTo(-78,-148);c.quadraticCurveTo(-28,-190,21,-149);
  c.quadraticCurveTo(-3,-137,-28,-142);c.quadraticCurveTo(-54,-135,-78,-148);c.fill();c.stroke();
  line(c,-30,-150,-27,-133,'#d8b387',3);
  c.restore();
}
function zombie(c:CanvasRenderingContext2D,e:Enemy,t:number){
  const x=e.x,ground=e.y;
  c.save();c.translate(x,ground);
  const scale=e.kind==='boss'?2:e.kind==='brute'?1.32:e.kind==='runner'?.83:e.kind==='flyer'?.76:1;
  c.scale(scale,scale);
  const wobble=Math.sin(t*7+e.id)*3;
  if(e.kind==='flyer'){
    c.fillStyle='#aec9a0';
    c.beginPath();c.ellipse(-20,-41,24,10,-.4,0,Math.PI*2);
    c.ellipse(22,-41,25,10,.4,0,Math.PI*2);c.fill();
  }
  c.fillStyle='#36525b';c.beginPath();c.ellipse(0,1,23,7,0,0,Math.PI*2);c.fill();
  round(c,-15,-26,12,25,3,'#59717a');
  round(c,3,-26,12,25,3,'#59717a');
  const coat=e.kind==='boss'?'#ad6c40':e.kind==='brute'?'#a35c39':e.kind==='runner'?'#e2a169':'#98b8a3';
  round(c,-19,-52+wobble,39,31,8,coat);
  round(c,-24,-44+wobble,8,22,4,'#86b34e');
  round(c,17,-44+wobble,9,22,4,'#86b34e');
  round(c,-19,-79+wobble,40,32,11,e.kind==='boss'?'#77a839':'#98cb50');
  c.fillStyle='#395535';c.beginPath();
  c.ellipse(-12,-65+wobble,5,4,0,0,Math.PI*2);
  c.ellipse(11,-65+wobble,5,4,0,0,Math.PI*2);c.fill();
  round(c,-5,-62+wobble,12,9,3,'#4a342d');
  c.fillStyle='#f4e3bf';c.fillRect(-2,-58+wobble,4,5);
  if(e.kind==='boss'){
    round(c,-23,-85+wobble,45,9,3,'#874d38');
    round(c,-5,-94+wobble,21,12,3,'#9e5b3f');
  }
  if(e.hp<e.maxHp){
    round(c,-22,-102+wobble,45,6,3,'#393d39');
    round(c,-21,-101+wobble,43*e.hp/e.maxHp,4,2,'#fd7f47');
  }
  c.restore();
}
function fx(c:CanvasRenderingContext2D,e:Fx,t:number){
  const alpha=Math.max(0,Math.min(1,e.life/.3));
  c.save();c.globalAlpha=Math.min(1,e.kind==='coin'?e.life:.4+alpha*.6);
  if(e.kind==='coin'){
    const y=e.y-(1.15-e.life)*26;
    disk(c,e.x,y,12,'#a86429');disk(c,e.x,y,9,'#ffc63f');
    c.font='bold 11px Arial';c.fillStyle='#fff5d1';c.fillText('+'+e.amount,e.x+13,y-6);
  }else if(e.kind==='shot'){
    line(c,160,392,e.x,e.y,'#fff4a1',4*alpha);
    disk(c,e.x,e.y,6,'#ffcf6e');
  }else if(e.kind==='fire'){
    c.fillStyle='#ffcd38';
    c.beginPath();c.ellipse(e.x,e.y,24+25*alpha,8+9*alpha,.15,0,Math.PI*2);c.fill();
    disk(c,e.x-11,e.y,12,'#fc8231');
  }else if(e.kind==='blast'){
    disk(c,e.x,e.y,65*(1.1-alpha)+21,'#ffe16b');
    disk(c,e.x,e.y,40*(1.1-alpha)+8,'#ff843c');
  }else if(e.kind==='laser'){
    line(c,130,390,e.x+80,e.y-20,'#8bfafa',7*alpha);
  }else{
    c.font='bold 14px Arial';c.fillStyle='#fff8dd';
    c.strokeStyle='#3d4a44';c.lineWidth=3;c.textAlign='center';
    c.strokeText('-'+e.amount,e.x,e.y-(.3-e.life)*25);
    c.fillText('-'+e.amount,e.x,e.y-(.3-e.life)*25);
  }
  c.restore();
}
export function paintTowerDefense(c:CanvasRenderingContext2D,s:DefenseState,reduced=false){
  c.save();c.clearRect(0,0,TOWER_WIDTH,TOWER_HEIGHT);
  sky(c,s);
  const boxH=80,boxW=104,bottom=564,left=69;
  c.save();c.translate(0,reduced?0:Math.sin(s.timer*7)*1.3);
  round(c,left-12,bottom-8,boxW+42,18,6,'#d39539');
  round(c,left-10,bottom-12,boxW+36,15,4,'#f8ac38');
  wheel(c,left+18,bottom+6,s.timer);
  wheel(c,left+boxW-4,bottom+6,s.timer);
  for(let i=0;i<s.modules.length;i++){
    const mod=s.modules[i]!;
    const y=bottom-25-i*boxH;
    round(c,left-4,y-8,boxW+12,boxH+4,6,'#b07836');
    round(c,left,y-7,boxW,boxH,4,'#8b9694');
    round(c,left+6,y-1,boxW-12,boxH-12,3,'#b5bbb1');
    round(c,left+11,y+6,boxW-22,boxH-27,2,'#788b85');
    round(c,left+16,y+9,boxW-32,boxH-33,2,'#9da8a1');
    for(let n=0;n<5;n++){
      line(c,left+24+n*11,y+12,left+24+n*11,y+boxH-30,'#899997',2);
    }
    line(c,left+5,y-2,left+boxW-7,y-2,'#e0c68b',3);
    disk(c,left+8,y+7,3,'#f2ca6b');
    disk(c,left+boxW-7,y+7,3,'#f2ca6b');
    gun(c,left+boxW*.64,y+boxH*.41,mod.weapon,mod.level,s.timer);
    round(c,left-13,y+boxH*.34,10,28,3,'#313e43');
    round(c,left-9,y+boxH*.38,5,20,2,'#f4a32e');
    const hpRatio=mod.hp/mod.maxHp;
    if(hpRatio<1){
      round(c,left+9,y+boxH-16,boxW-18,5,3,'#52575a');
      round(c,left+9,y+boxH-16,(boxW-18)*hpRatio,5,3,'#72df96');
    }
  }
  hero(c,bottom-25-s.modules.length*boxH,s.timer);
  c.restore();
  // Draw enemies above ground; flyers float in the sky.
  for(const e of s.enemies)if(e.alive)zombie(c,e,s.timer);
  for(const e of s.effects)fx(c,e,s.timer);
  if(s.aim){
    const x=s.aim.x,y=s.aim.y;
    c.save();c.strokeStyle='#ffffc7';c.lineWidth=2.5;
    c.beginPath();c.arc(x,y,19,0,Math.PI*2);c.stroke();
    line(c,x-29,y,x-10,y,'#ffffc7',2);
    line(c,x+10,y,x+29,y,'#ffffc7',2);
    line(c,x,y-29,x,y-10,'#ffffc7',2);
    line(c,x,y+10,x,y+29,'#ffffc7',2);c.restore();
  }
  c.restore();
}
export function TowerDefenseCover(){
  const id=useId().replace(/:/g,'')+'-tds';
  return <svg viewBox="0 0 480 444" xmlns="http://www.w3.org/2000/svg" role="presentation"
    preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id={id+'sky'} x1=".1" y1="0" x2=".8" y2="1">
      <stop stopColor="#7ef4d5"/><stop offset="1" stopColor="#39b5ca"/>
    </linearGradient></defs>
    <rect width="480" height="444" fill={'url(#'+id+'sky)'}/>
    <g fill="#63a5a2" opacity=".36">
      {Array.from({length:12},(_,i)=><rect key={i} x={i*45-8}
        y={240-(i*23)%110} width={32+i%3*6} height="180"/>)}
    </g>
    <rect x="0" y="377" width="480" height="67" fill="#58666a"/>
    <rect x="0" y="383" width="480" height="8" fill="#94c2ad"/>
    <g transform="translate(100 357)">
      <rect x="-15" y="-15" width="140" height="23" rx="6" fill="#ec9c33" stroke="#684e38" strokeWidth="6"/>
      {[13,97].map(x=><g key={x}><circle cx={x} cy="14" r="25" fill="#39444a"/>
        <circle cx={x} cy="14" r="14" fill="#99aab0" stroke="#dbd8ac" strokeWidth="5"/></g>)}
      {[0,1,2].map((n)=><g key={n} transform={'translate(2 '+(-27-n*83)+')'}>
        <rect width="108" height="78" rx="5" fill="#8f9b95" stroke="#79613c" strokeWidth="7"/>
        <rect x="8" y="6" width="92" height="64" rx="4" fill="#adb7a8"/>
        {Array.from({length:7},(_,i)=><path key={i} d={'M'+(18+i*11)+' 13v48'} stroke="#91a299" strokeWidth="4"/>)}
        <g transform="translate(78 38)">
          <circle r="21" fill="#567a81" stroke="#c3d1c7" strokeWidth="5"/>
          <rect x="7" y="-8" width="43" height="16" rx="5" fill={n===1?'#f6973a':'#759eaa'} stroke="#394d53" strokeWidth="4"/>
          <circle r="8" fill="#f5c252"/>
        </g>
      </g>)}
      <g transform="translate(70 -279)">
        <path d="M-10 0l-3 -43" stroke="#845b44" strokeWidth="6"/>
        <path d="M-62 -45q54 -58 111 0q-27 -10 -53 -4q-31 -7 -58 4Z" fill="#ed735d" stroke="#9d453e" strokeWidth="4"/>
        <rect x="-18" y="-28" width="38" height="39" rx="7" fill="#d37152"/>
        <circle cx="0" cy="-42" r="21" fill="#cd9c6f"/>
        <path d="M-22 -48q5 -24 41 -11v14Z" fill="#54624d"/>
        <path d="M13 -14l45 11" stroke="#3e5558" strokeWidth="9"/>
        <circle cx="-8" cy="-42" r="3" fill="#283f39"/><circle cx="8" cy="-42" r="3" fill="#283f39"/>
      </g>
    </g>
    <g transform="translate(346 324)">
      {[0,1,2].map((n)=><g key={n} transform={'translate('+(n*47)+' '+(n%2*23)+')'}>
        <rect x="-15" y="-6" width="32" height="30" rx="8" fill={n===1?'#ba8056':'#a8b9a0'}/>
        <rect x="-14" y="-47" width="31" height="34" rx="10" fill="#a0ce5b" stroke="#4b894f" strokeWidth="3"/>
        <circle cx="-6" cy="-32" r="3" fill="#405436"/><circle cx="9" cy="-32" r="3" fill="#405436"/>
        <rect x="-3" y="-24" width="10" height="8" fill="#5f4229"/>
      </g>)}
    </g>
    <path d="M218 263l101 30" stroke="#ffe56c" strokeWidth="13" strokeLinecap="round" opacity=".87"/>
    <circle cx="322" cy="295" r="17" fill="#ffca45" opacity=".8"/>
    {[[290,123],[326,178],[362,97]].map(([x,y],i)=><g key={i}>
      <circle cx={x} cy={y} r="13" fill="#ffbd32" stroke="#d88b28" strokeWidth="4"/>
      <circle cx={x-3} cy={y-3} r="4" fill="#fff09b"/>
    </g>)}
  </svg>;
}
