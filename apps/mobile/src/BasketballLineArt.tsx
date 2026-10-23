import { useId } from 'react';
import {
  COURT_HEIGHT, COURT_WIDTH, INK_CAP, remainingInk, ROUND_SECONDS, type BallBody,
  type BasketRound, type InkStroke, type Vec,
} from '../../../packages/games/basketball-line/engine.ts';

/** Transient visual effects computed by the page from game events. */
export interface BasketFx {
  /** 0..1 — how much the net is still rippling from the latest score. */
  netFlex: number;
  /** Expanding ring at the gem's position right after collection. */
  gemRing: { x: number; y: number; age: number } | null;
}

const TAU = Math.PI * 2;
export const BASKET_PALETTE = {
  sky: '#e9e9e9',
  line: '#29a9eb',
  lineShine: '#8fe2ff',
  basketball: '#ff9e0f',
  basketballDark: '#f36b10',
  seam: '#422322',
  rim: '#e64b21',
  net: '#ffffff',
  bomb: '#182e42',
  gem: '#3ac1ef',
};
const circle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
};
const stroke = (ctx: CanvasRenderingContext2D, points: Vec[], color: string, width: number) => {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i++) {
    const point = points[i]!;
    ctx.lineTo(point.x, point.y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
};
export function paintBasketball(ctx: CanvasRenderingContext2D, ball: BallBody) {
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.rotate(ball.rotation);
  const r = ball.radius;
  const surface = ctx.createRadialGradient(-r * .4, -r * .5, r * .1, 0, 0, r * 1.16);
  surface.addColorStop(0, '#ffda47');
  surface.addColorStop(.48, BASKET_PALETTE.basketball);
  surface.addColorStop(.86, BASKET_PALETTE.basketballDark);
  surface.addColorStop(1, '#ac310f');
  circle(ctx, 0, 0, r);
  ctx.fillStyle = surface; ctx.fill();
  ctx.strokeStyle = '#50291b'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.save(); circle(ctx, 0, 0, r - 1); ctx.clip();
  ctx.strokeStyle = BASKET_PALETTE.seam; ctx.lineWidth = 2.4;
  ctx.beginPath();ctx.moveTo(-r, 0);ctx.lineTo(r, 0);ctx.moveTo(0,-r);ctx.lineTo(0,r);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-r*.84,-r);ctx.bezierCurveTo(r*.73,-r*.36,r*.73,r*.36,-r*.84,r);
  ctx.moveTo(r*.84,-r);ctx.bezierCurveTo(-r*.73,-r*.36,-r*.73,r*.36,r*.84,r);ctx.stroke();
  ctx.restore();ctx.restore();
}
export function paintBomb(ctx: CanvasRenderingContext2D, bomb: BallBody) {
  ctx.save();ctx.translate(bomb.x,bomb.y);
  circle(ctx,0,0,bomb.radius);
  const shine=ctx.createRadialGradient(-5,-8,1,0,0,25);
  shine.addColorStop(0,'#557b98');shine.addColorStop(.35,'#254459');shine.addColorStop(1,'#0a1423');
  ctx.fillStyle=shine;ctx.fill();ctx.strokeStyle='#07121d';ctx.lineWidth=2;ctx.stroke();
  ctx.rotate(-.55);ctx.fillStyle='#263a3b';ctx.fillRect(10,-20,8,7);
  ctx.strokeStyle='#513b21';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(15,-18);ctx.quadraticCurveTo(25,-32,32,-23);ctx.stroke();
  ctx.fillStyle='#fa7b27';circle(ctx,32,-23,4);ctx.fill();
  ctx.fillStyle='#ffd758';circle(ctx,32,-23,2);ctx.fill();
  ctx.restore();
}
export function paintHoop(ctx: CanvasRenderingContext2D, hoop: BasketRound['hoop'], front: boolean, flex = 0) {
  const {x,y,width} = hoop;
  ctx.save();
  if (!front) {
    // Vertical white rectangular backboard with grey hard shadow.
    const left=x-width/2-27;
    ctx.fillStyle='#96999e';ctx.fillRect(left-5,y-106,8,116);
    ctx.fillStyle='#fdfdfd';ctx.fillRect(left,y-109,29,105);
    ctx.strokeStyle='#989da1';ctx.lineWidth=2;ctx.strokeRect(left+1,y-108,26,101);
    ctx.strokeStyle='#c0c3c7';ctx.lineWidth=2;ctx.strokeRect(left+9,y-87,16,40);
    ctx.strokeStyle='#6e7072';ctx.lineWidth=3;ctx.beginPath();
    ctx.moveTo(left+24,y-10);ctx.lineTo(x-width/2,y+4);ctx.stroke();
    ctx.restore();return;
  }
  // Bright-white four-row net, prominent red rim, dark shadow underneath.
  // A fresh score ripples the net: its lower rows stretch downward briefly.
  const rx=width/2;
  const drop=flex*10;
  ctx.strokeStyle='#8f9399';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(x-rx+9,y+6);ctx.lineTo(x-rx+17,y+52+drop);
  ctx.quadraticCurveTo(x,y+63+drop,x+rx-19,y+52+drop);ctx.lineTo(x+rx-9,y+6);ctx.stroke();
  ctx.strokeStyle=BASKET_PALETTE.net;ctx.lineWidth=3.7;
  for(let i=0;i<6;i++){
    const x1=x-rx+10+i*(width-20)/5;
    const x2=x-rx+20+i*(width-40)/5;
    ctx.beginPath();ctx.moveTo(x1,y+7);ctx.lineTo(x2,y+49+drop);ctx.stroke();
  }
  for(let j=1;j<4;j++){
    const yy=y+10+j*10+drop*(j/3);
    const shrink=j*4;
    ctx.beginPath();ctx.moveTo(x-rx+10+shrink,yy);
    ctx.quadraticCurveTo(x,yy+8,x+rx-10-shrink,yy);ctx.stroke();
  }
  ctx.strokeStyle='#a82d12';ctx.lineWidth=10;ctx.beginPath();ctx.ellipse(x,y+1,rx,10,0,0,TAU);ctx.stroke();
  ctx.strokeStyle=BASKET_PALETTE.rim;ctx.lineWidth=6;ctx.beginPath();ctx.ellipse(x,y-2,rx,10,0,0,TAU);ctx.stroke();
  ctx.strokeStyle='#ff8b52';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y-5,rx-1,9,0,Math.PI*1.04,Math.PI*1.95);ctx.stroke();
  ctx.restore();
}
export function paintGem(ctx: CanvasRenderingContext2D, gem: Vec) {
  const x=gem.x,y=gem.y;
  ctx.save();ctx.translate(x,y);
  ctx.shadowColor='#8de7ff';ctx.shadowBlur=14;ctx.fillStyle='#31b8e6';
  ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(11,-4);ctx.lineTo(0,14);ctx.lineTo(-11,-4);ctx.closePath();ctx.fill();
  ctx.shadowBlur=0;ctx.strokeStyle='#126b93';ctx.lineWidth=1.5;ctx.stroke();
  ctx.strokeStyle='#a9f4ff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-10,-4);ctx.lineTo(11,-4);ctx.moveTo(0,-14);ctx.lineTo(0,14);ctx.stroke();ctx.restore();
}
/** Visible round clock: a slim bar under the header band that drains as the
 *  round's time budget elapses and pulses red in the final seconds. */
function paintTimer(ctx: CanvasRenderingContext2D, round: BasketRound, reducedMotion: boolean) {
  if (round.phase !== 'ready' && round.phase !== 'running') return;
  const fraction = Math.max(0, Math.min(1, 1 - round.elapsed / ROUND_SECONDS));
  const x0 = 14, x1 = COURT_WIDTH - 14, y = 92;
  ctx.save();
  ctx.fillStyle = '#ffffffa8';
  ctx.beginPath(); ctx.roundRect(x0, y, x1 - x0, 7, 4); ctx.fill();
  const urgent = round.phase === 'running' && fraction <= 5 / ROUND_SECONDS;
  ctx.fillStyle = urgent ? '#e64b21' : '#29a9eb';
  ctx.globalAlpha = urgent && !reducedMotion ? .68 + .32 * Math.sin(round.elapsed * 10) : 1;
  if (fraction > 0) {
    ctx.beginPath(); ctx.roundRect(x0, y, (x1 - x0) * fraction, 7, 4); ctx.fill();
  }
  ctx.restore();
}

export function paintBasketScene(
  ctx: CanvasRenderingContext2D,
  round: BasketRound,
  activeLine: Vec[] | null = null,
  reducedMotion = false,
  fx: BasketFx = { netFlex: 0, gemRing: null },
) {
  ctx.save();ctx.clearRect(0,0,COURT_WIDTH,COURT_HEIGHT);
  // The QKY-inspired minimalist light-gray canvas and blue physics ink.
  ctx.fillStyle=BASKET_PALETTE.sky;ctx.fillRect(0,0,COURT_WIDTH,COURT_HEIGHT);
  ctx.fillStyle='#f6f6f6';ctx.fillRect(0,0,COURT_WIDTH,84);
  ctx.fillStyle='#d8d8d8';ctx.fillRect(0,84,COURT_WIDTH,2);
  ctx.fillStyle='#f0f0f0';ctx.fillRect(0,COURT_HEIGHT-38,COURT_WIDTH,38);
  ctx.strokeStyle='#d1d2d2';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(0,COURT_HEIGHT-39);ctx.lineTo(COURT_WIDTH,COURT_HEIGHT-39);ctx.stroke();
  paintHoop(ctx,round.hoop,false);
  if(!round.gemCollected) paintGem(ctx,round.gem);
  if(fx.gemRing && fx.gemRing.age < 1){
    const ring=fx.gemRing;
    ctx.save();
    ctx.globalAlpha=(1-ring.age)*.85;
    ctx.strokeStyle='#3ac1ef';ctx.lineWidth=3;
    circle(ctx,ring.x,ring.y,10+ring.age*28);ctx.stroke();
    ctx.restore();
  }
  for(const ink of round.strokes) {
    stroke(ctx,ink.points,'#1181bd',11);
    stroke(ctx,ink.points,BASKET_PALETTE.line,8);
    stroke(ctx,ink.points,BASKET_PALETTE.lineShine,1.8);
  }
  if(activeLine && activeLine.length>1){
    stroke(ctx,activeLine,'#1181bd',11);
    stroke(ctx,activeLine,BASKET_PALETTE.line,8);
    stroke(ctx,activeLine,'#8fe2ff',1.8);
  }
  for(const ball of round.balls) if(ball.active) {
    // Soft floor shadow that tightens as the ball descends, plus a short
    // velocity smear on fast balls — both ground the motion without any
    // change to the physics.
    const groundY=COURT_HEIGHT-19;
    const proximity=Math.max(.22,Math.min(1,1-(groundY-ball.y)/(COURT_HEIGHT*.92)));
    ctx.save();
    ctx.fillStyle='rgba(28,34,40,'+(0.20*proximity).toFixed(3)+')';
    ctx.beginPath();ctx.ellipse(ball.x,groundY,ball.radius*1.05*proximity,5*proximity,0,0,TAU);ctx.fill();
    ctx.restore();
    const speed=Math.hypot(ball.vx,ball.vy);
    if(!reducedMotion && ball.kind==='basketball' && speed>150){
      ctx.save();
      for(let k=2;k>=1;k--){
        ctx.globalAlpha=k===2?.05:.1;
        ctx.fillStyle=BASKET_PALETTE.basketball;
        circle(ctx,ball.x-ball.vx*.028*k,ball.y-ball.vy*.028*k,ball.radius*(1-.1*k));ctx.fill();
      }
      ctx.restore();
    }
    if(ball.kind==='bomb') paintBomb(ctx,ball);
    else paintBasketball(ctx,ball);
  }
  paintHoop(ctx,round.hoop,true,fx.netFlex);
  paintTimer(ctx,round,reducedMotion);
  // In-scene pencil and ink-bar illustration.
  if(round.phase==='ready' && !activeLine && !reducedMotion){
    ctx.fillStyle='#777';ctx.font='15px Arial, sans-serif';ctx.textAlign='center';
    ctx.fillText('✎',COURT_WIDTH/2,COURT_HEIGHT-65);
  }
  ctx.restore();
}
export function BasketballLineCover(){
  const id=useId().replace(/:/g,'')+'-basket';
  return <svg viewBox="0 0 480 444" preserveAspectRatio="xMidYMid slice"
    xmlns="http://www.w3.org/2000/svg" role="presentation">
    <defs>
      <radialGradient id={id+'ball'} cx=".26" cy=".22" r=".92">
        <stop stopColor="#ffd34e"/><stop offset=".63" stopColor="#ff9212"/>
        <stop offset="1" stopColor="#cc4515"/>
      </radialGradient>
      <linearGradient id={id+'pencil'} x2=".94" y2="1">
        <stop stopColor="#93d4ff"/><stop offset="1" stopColor="#359bea"/>
      </linearGradient>
    </defs>
    <rect width="480" height="444" fill="#ededed"/>
    <rect x="0" y="391" width="480" height="53" fill="#ddd"/>
    <path d="M110 352Q180 325 231 360T345 314Q401 241 425 154"
      fill="none" stroke="#198acc" strokeWidth="15" strokeLinecap="round"/>
    <path d="M110 350Q180 321 231 357T345 310Q401 237 425 151"
      fill="none" stroke="#34b5f6" strokeWidth="11" strokeLinecap="round"/>
    <g transform="translate(88 297)">
      <rect x="-46" y="-118" width="16" height="125" fill="#8d929b"/>
      <rect x="-42" y="-121" width="48" height="113" fill="#fff" stroke="#aeb2b8" strokeWidth="3"/>
      <rect x="-29" y="-101" width="23" height="57" fill="none" stroke="#c4c5c6" strokeWidth="3"/>
      {[0,1,2,3].map(i=><path key={i} d={'M'+(-6+i*19)+' 3l7 47l13 -47'} stroke="white" strokeWidth="3" fill="none"/>)}
      <ellipse cx="5" cy="0" rx="54" ry="12" fill="none" stroke="#e75a27" strokeWidth="9"/>
    </g>
    <g transform="translate(385 104)">
      <circle r="60" fill={'url(#'+id+'ball)'} stroke="#4c2316" strokeWidth="5"/>
      <g stroke="#4e2822" fill="none" strokeWidth="5">
        <path d="M-60 0H60M0-60V60"/>
        <path d="M-52 -38Q43 -22 52 39M52 -40Q-43 -20 -52 36"/>
      </g>
      <ellipse cx="-22" cy="-28" rx="14" ry="8" fill="#fff3b4" opacity=".53"/>
    </g>
    <g transform="translate(114 346) rotate(39)">
      <rect x="-17" y="-113" width="36" height="123" rx="4" fill={'url(#'+id+'pencil)'}/>
      <path d="M-17 -93H19M-17 -81H19" stroke="#c9e8ff" strokeWidth="3"/>
      <path d="M-17 10L1 48L19 10Z" fill="#ffd6a0"/>
      <path d="M-6 31L1 48L8 31Z" fill="#327cb7"/>
      <rect x="-17" y="-125" width="36" height="15" rx="3" fill="#ef4f4e"/>
    </g>
  </svg>;
}
