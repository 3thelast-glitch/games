/** Premium Ludo boards inspired by classic square and six-way radial Ludo references.
 * Every interactive cell derives from engine route IDs, not decorative coordinates.
 */
import { useMemo } from 'react';
import { circuitSize, isSafe, nodeFor, tokensPerSeat, type LudoState, type LudoToken, type SeatCount } from '../../../packages/games/ludo/engine.ts';
import { useI18n } from './i18n.tsx';

export const LUDO_COLORS = ['#10a33c','#f5bf18','#228afa','#f32737','#8a40ed','#f48221','#12bfc3','#ec4a9d','#84c92d','#3457c8'];
/** Blends two #rrggbb colors; amt 0 returns the first, 1 the second. */
function mix(hex: string, hex2: string, amt: number): string {
  const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const a = p(hex), b = p(hex2);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i]! - v) * amt)).join(',')})`;
}
export const LUDO_SYMBOLS = ['●','◆','▲','■','⬟','⬡','✚','☾','✴','⬢'];
export type Point = { x: number; y: number };
export type LudoLayout = { nodes: Record<string, Point>; bases: Point[]; trackWidth: number };
const CENTER = 500;
const GRID = 60;
const polar = (radius: number, angle: number): Point => ({
  x: CENTER + radius * Math.cos(angle),
  y: CENTER + radius * Math.sin(angle),
});
function rotate(row: number, col: number, turns: number): [number, number] {
  for (let j = 0; j < turns; j++) [row, col] = [col, 14 - row];
  return [row, col];
}
export function buildLudoLayout(count: SeatCount): LudoLayout {
  const nodes: Record<string, Point> = {};
  const bases: Point[] = [];
  if (count === 4) {
    // 15×15 classical Ludo lattice; the 52-cell circuit remains adjacent.
    const seed: [number, number][] = [[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8]];
    for (let seat=0;seat<4;seat++) {
      for (let index=0;index<13;index++) {
        const [row,col]=rotate(seed[index]![0],seed[index]![1],seat);
        nodes['c:'+(13*seat+index)]={x:50+GRID*(col+.5),y:50+GRID*(row+.5)};
      }
      for (let index=0;index<5;index++) {
        const [row,col]=rotate(7,index+1,seat);
        nodes['home:'+seat+':'+index]={x:50+GRID*(col+.5),y:50+GRID*(row+.5)};
      }
      const [row,col]=rotate(7,6,seat);
      nodes['finish:'+seat]={x:50+GRID*(col+.5),y:50+GRID*(row+.5)};
      const [br,bc]=rotate(2.5,2.5,seat);
      bases.push({x:50+GRID*(bc+.5),y:50+GRID*(br+.5)});
    }
  } else {
    const C=circuitSize(count);
    const angle=(index:number)=>-Math.PI/2+Math.PI*2*index/C;
    for (let index=0;index<C;index++) nodes['c:'+index]=polar(310,angle(index));
    for (let seat=0;seat<count;seat++) {
      const a=angle(13*seat+5);
      for (let index=0;index<5;index++) nodes['home:'+seat+':'+index]=polar(276-index*31,a);
      nodes['finish:'+seat]=polar(117,a);
      bases.push(polar(413,a));
    }
  }
  const slots=tokensPerSeat(count);
  for (let seat=0;seat<count;seat++) {
    const base=bases[seat]!;
    for (let slot=0;slot<slots;slot++) {
      let dx=0,dy=0;
      if (slots===4) {dx=slot%2===0?-63:63;dy=slot<2?-63:63;}
      if (slots===2) dx=slot===0?-29:29;
      // The smaller six-player radial bases need a tighter 2×2 grouping.
      const scale=count===6?.45:1;
      nodes['base:'+seat+':'+slot]={x:base.x+dx*scale,y:base.y+dy*scale};
    }
  }
  return {nodes,bases,trackWidth:count===4?58:Math.max(12,2*Math.PI*310/circuitSize(count)-2)};
}
const sectorPoint=(r:number,a:number)=>{const p=polar(r,a);return p.x.toFixed(2)+','+p.y.toFixed(2);};
function BoardBackdrop({count,layout}:{count:SeatCount;layout:LudoLayout}) {
  if (count===4) {
    const wedges=[
      '500,500 410,410 410,590', // green left
      '500,500 410,410 590,410', // yellow top
      '500,500 590,410 590,590', // blue right
      '500,500 410,590 590,590', // red bottom
    ];
    return <>
      <rect x="23" y="23" width="954" height="954" rx="35" fill="url(#ludo-frame)" stroke="#f3bf54" strokeWidth="11"/>
      <rect x="50" y="50" width="900" height="900" rx="11" fill="#f9f6ef"/>
      {layout.bases.map((base,seat)=><g key={seat} data-ludo-base={seat}>
        <rect x={base.x-180} y={base.y-180} width="360" height="360" rx="13"
          fill={LUDO_COLORS[seat]} stroke="#b17c31" strokeWidth="3"/>
        <rect x={base.x-139} y={base.y-139} width="278" height="278" rx="26"
          fill="#fffdf7" stroke="#ffeba8" strokeWidth="8"/>
        <rect x={base.x-133} y={base.y-133} width="266" height="266" rx="22"
          fill="none" stroke="#14364b" strokeOpacity=".12" strokeWidth="3"/>
        <text x={base.x} y={base.y-151} fontSize="23" fontWeight="900"
          fill="#fff" stroke="#252b38" strokeWidth=".7" textAnchor="middle">{seat+1}</text>
        {Array.from({length:tokensPerSeat(count)},(_,slot)=> {
          const p=layout.nodes['base:'+seat+':'+slot]!;
          return <circle key={slot} data-ludo-base-slot={seat+':'+slot}
            cx={p.x} cy={p.y} r="43" fill="#f0ebdf" stroke="#d9bd73" strokeWidth="3"/>;
        })}
      </g>)}
      {wedges.map((points,seat)=><polygon key={seat} points={points} fill={LUDO_COLORS[seat]}
        stroke="#fff4ca" strokeWidth="3"/>)}
      <circle cx="500" cy="500" r="17" fill="#ffda72" stroke="#b18135" strokeWidth="4"/>
    </>;
  }
  const sectorSize=Math.PI*2/count;
  return <>
    <circle cx="500" cy="500" r="475" fill="url(#ludo-frame)" stroke="#ffcd63" strokeWidth="10"/>
    <circle cx="500" cy="500" r="457" fill="#fff7e5" stroke="#bc8e3c" strokeWidth="3"/>
    {layout.bases.map((base,seat)=>{
      const a=-Math.PI/2+sectorSize*(seat+5/13);
      const left=a-sectorSize*.49,right=a+sectorSize*.49;
      return <g key={seat} data-ludo-base={seat}>
        <path d={`M ${sectorPoint(343,left)} L ${sectorPoint(459,left)} A 459 459 0 0 1 ${sectorPoint(459,right)} L ${sectorPoint(343,right)} A 343 343 0 0 0 ${sectorPoint(343,left)} Z`}
          fill={LUDO_COLORS[seat]} fillOpacity=".9" stroke="#fff2d1" strokeWidth="2"/>
        <circle cx={base.x} cy={base.y} r={count===6?68:count===8?60:52}
          fill="#fffdf7" stroke="#f6c561" strokeWidth="7"/>
        <circle cx={base.x} cy={base.y} r={count===6?61:count===8?53:45}
          fill="#fffdf7" stroke={LUDO_COLORS[seat]} strokeWidth="4"/>
        <text x={base.x} y={base.y-(count===6?74:count===8?66:58)}
          fill="#232630" stroke="#fffdf4" strokeWidth="2" paintOrder="stroke"
          fontSize="24" fontWeight="900" textAnchor="middle">{seat+1}</text>
        {Array.from({length:tokensPerSeat(count)},(_,slot)=>{
          const p=layout.nodes['base:'+seat+':'+slot]!;
          return <circle key={slot} data-ludo-base-slot={seat+':'+slot}
            cx={p.x} cy={p.y} r={count===6?22:count===8?24:30}
            fill="#f0ede5" stroke="#d8b565" strokeWidth="2"/>;
        })}
      </g>;
    })}
    <circle cx="500" cy="500" r="330" fill="#fff8e9" stroke="#c99d57" strokeWidth="5"/>
    {layout.bases.map((_,seat)=>{
      const a=-Math.PI/2+sectorSize*(seat+5/13);
      return <path key={seat} d={`M 500 500 L ${sectorPoint(125,a-sectorSize/2)} A 125 125 0 0 1 ${sectorPoint(125,a+sectorSize/2)} Z`}
        fill={LUDO_COLORS[seat]} stroke="#fff7da" strokeWidth="2"/>;
    })}
    <circle cx="500" cy="500" r="50" fill="url(#ludo-gold)" stroke="#fff0b9" strokeWidth="7"/>
    <text x="500" y="516" textAnchor="middle" fontSize="47" fill="#785019">★</text>
  </>;
}
function Pawn({token,point,radius,legal,onChoose,stackOffset}:{
  token:LudoToken;point:Point;radius:number;legal:boolean;onChoose:(id:string)=>void;stackOffset:number;
}) {
  const x=point.x+stackOffset,y=point.y,r=radius,color=LUDO_COLORS[token.seat];
  const rim=r>=18?2.2:Math.max(.7,r*.09);
  // A classic Ludo piece, drawn standing on the cell: tiered round base,
  // gold collar, tapered glossy body, spherical head. The slot number sits
  // on the body so the head stays a clean sphere.
  const bodyPath=[
    `M ${x-r*.40} ${y+r*.56}`,
    `C ${x-r*.31} ${y+r*.28} ${x-r*.225} ${y+r*.04} ${x-r*.20} ${y-r*.15}`,
    `L ${x+r*.20} ${y-r*.15}`,
    `C ${x+r*.225} ${y+r*.04} ${x+r*.31} ${y+r*.28} ${x+r*.40} ${y+r*.56}`,
    `C ${x+r*.20} ${y+r*.67} ${x-r*.20} ${y+r*.67} ${x-r*.40} ${y+r*.56} Z`,
  ].join(' ');
  return <g data-ludo-token={token.id} className={legal?'ludo-legal-pawn':'ludo-pawn'}
      tabIndex={legal?0:undefined} role={legal?'button':undefined}
      aria-label={legal?`Token ${token.slot+1}`:undefined}
      onClick={legal?()=>onChoose(token.id):undefined}
      onKeyDown={legal?e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onChoose(token.id);}}:undefined}>
    {legal && <circle cx={x} cy={y-r*.05} r={radius+8} fill="none" stroke="#fffada" strokeWidth="4" className="ludo-pawn-glow"/>}
    <ellipse cx={x} cy={y+r*1.0} rx={r*.84} ry={r*.23} fill="#0c1627" opacity=".32"/>
    <ellipse cx={x} cy={y+r*.80} rx={r*.84} ry={r*.27} fill={mix(color,'#0a1428',.5)} stroke="#0b1525" strokeOpacity=".3" strokeWidth={rim*.6}/>
    <ellipse cx={x} cy={y+r*.70} rx={r*.84} ry={r*.27} fill={mix(color,'#ffffff',.16)} stroke="#fff4cc" strokeOpacity=".55" strokeWidth={rim*.6}/>
    <ellipse cx={x} cy={y+r*.56} rx={r*.60} ry={r*.19} fill={mix(color,'#0a1428',.28)}/>
    <path d={bodyPath} fill={`url(#ludo-pawn-body-${token.seat})`} stroke="#0b1525" strokeOpacity=".35" strokeWidth={rim*.7}/>
    <ellipse cx={x-r*.13} cy={y+r*.18} rx={r*.085} ry={r*.30} fill="#fff" opacity=".30" transform={`rotate(-8 ${x-r*.13} ${y+r*.18})`}/>
    <ellipse cx={x} cy={y-r*.17} rx={r*.315} ry={r*.105} fill="url(#ludo-gold)" stroke="#a8742a" strokeWidth={rim*.55}/>
    <circle cx={x} cy={y-r*.52} r={r*.335} fill={`url(#ludo-token-${token.seat})`} stroke="#fff4cc" strokeWidth={rim}/>
    <ellipse cx={x-r*.115} cy={y-r*.665} rx={r*.105} ry={r*.058} fill="#fff" opacity=".8" transform={`rotate(-25 ${x-r*.115} ${y-r*.665})`}/>
    <text x={x} y={y+r*.44} textAnchor="middle" fill="#fff"
      stroke="#0b1525" strokeWidth={radius<12?.8:1.3} paintOrder="stroke" fontWeight="900"
      fontSize={Math.max(8,radius*.56)}>{token.slot+1}</text>
    {legal && <circle cx={x} cy={y-r*.05} r={Math.max(radius+8,17)} fill="transparent"/>}
  </g>;
}
export function LudoBoard({state,legal,onChoose,zoom,center}:{
  state:LudoState;legal:readonly string[];onChoose:(id:string)=>void;zoom:number;center:Point;
}) {
  const {lang}=useI18n();
  const layout=useMemo(()=>buildLudoLayout(state.seatCount),[state.seatCount]);
  const n=state.seatCount,C=circuitSize(n),square=n===4,step=Math.PI*2/C;
  const size=1000/zoom,half=size/2;
  const clamp=(v:number)=>Math.max(half,Math.min(1000-half,v));
  const bounds=[clamp(center.x)-half,clamp(center.y)-half,size,size].join(' ');
  const stack=new Map<string,number>();
  const pawns=state.tokens.map(token=>{
    const key=nodeFor(state,token);
    const offset=stack.get(key)??0;
    stack.set(key,offset+1);
    return {token,key,offset,point:layout.nodes[key]};
  });
  return <svg className="ludo-board" data-ludo-board-variant={square?'square':'radial'}
      data-ludo-player-count={n} viewBox={bounds} role="img"
      aria-label={lang==='ar'?'لوحة لودو: اختر قطعة مضاءة أو استخدم أزرار الحركة':'Ludo board: choose a highlighted pawn or use the move controls'}
      style={{direction:'ltr'}}>
    <defs>
      <linearGradient id="ludo-frame" x1="0" x2="1" y1="0" y2="1">
        <stop stopColor="#f8d77f"/><stop offset=".35" stopColor="#c88d2d"/><stop offset=".66" stopColor="#ffdf88"/><stop offset="1" stopColor="#a66d29"/>
      </linearGradient>
      <radialGradient id="ludo-gold"><stop stopColor="#ffeaa9"/><stop offset="1" stopColor="#bb7c23"/></radialGradient>
      <linearGradient id="ludo-tile" x1="0" x2="0" y1="0" y2="1">
        <stop stopColor="#fffefb"/><stop offset="1" stopColor="#eceae5"/>
      </linearGradient>
      {LUDO_COLORS.slice(0,n).map((color,seat)=><radialGradient key={seat} id={`ludo-token-${seat}`} cx=".3" cy=".2" r=".9">
        <stop stopColor="#ffffff" stopOpacity=".6"/><stop offset=".29" stopColor={color}/><stop offset="1" stopColor={mix(color,'#12213d',.5)}/>
      </radialGradient>)}
      {LUDO_COLORS.slice(0,n).map((color,seat)=><linearGradient key={'b'+seat} id={`ludo-pawn-body-${seat}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={mix(color,'#ffffff',.48)}/><stop offset=".45" stopColor={color}/><stop offset="1" stopColor={mix(color,'#0a1428',.44)}/>
      </linearGradient>)}
    </defs>
    <BoardBackdrop count={n} layout={layout}/>
    {Array.from({length:C},(_,i)=>{
      const point=layout.nodes['c:'+i]!,seat=Math.floor(i/13),start=i%13===0,safe=isSafe(n,i);
      const rotation=square?0:(-Math.PI/2+(i*step))*180/Math.PI+90;
      const cellWidth=square?58:layout.trackWidth,cellHeight=square?58:37;
      const next=layout.nodes['c:'+((i+1)%C)]!;
      const arrowDeg=Math.atan2(next.y-point.y,next.x-point.x)*180/Math.PI;
      return <g key={i} data-ludo-cell={i}>
        <rect x={point.x-cellWidth/2} y={point.y-cellHeight/2} width={cellWidth} height={cellHeight}
          rx={square?4:3} transform={square?undefined:`rotate(${rotation} ${point.x} ${point.y})`}
          fill={start?LUDO_COLORS[seat]:'url(#ludo-tile)'}
          stroke={safe?'#bf8c38':'#b9a994'} strokeWidth={safe?2.5:1.25}/>
        {safe&&!start&&<text x={point.x} y={point.y+5} textAnchor="middle"
          fontSize={square?28:Math.max(12,layout.trackWidth*.85)} fontWeight="900"
          fill="#bb8a30" stroke="#fff8de" strokeWidth="1.3" paintOrder="stroke">★</text>}
        {start&&<path d="M -11 -5 L 1 -5 L 1 -11 L 12 0 L 1 11 L 1 5 L -11 5 Z"
          transform={`translate(${point.x} ${point.y}) rotate(${arrowDeg}) scale(${square?1.0:layout.trackWidth/29})`}
          fill="#fffdf0" stroke="#26502f" strokeWidth="1.2"/>}
      </g>;
    })}
    {layout.bases.map((_,seat)=><g key={seat}>
      {Array.from({length:5},(_,j)=>{
        const point=layout.nodes['home:'+seat+':'+j]!;
        const rotation=square?0:(-Math.PI/2+Math.PI*2*(13*seat+5)/C)*180/Math.PI+90;
        const w=square?57:30;
        return <rect key={j} data-ludo-home-cell={seat+':'+j}
          x={point.x-w/2} y={point.y-w/2} width={w} height={w} rx={square?4:3}
          transform={square?undefined:`rotate(${rotation} ${point.x} ${point.y})`}
          fill={LUDO_COLORS[seat]} stroke="#fff0d4" strokeWidth="2"/>;
      })}
    </g>)}
    {pawns.map(({token,key,offset,point})=>{
      if(!point)return null;
      const base=key.startsWith('base:'),group=stack.get(key)??0;
      const radius=base?(square?32:n===6?19:n===8?21:27):
        key.startsWith('finish:')?(square?21:17):
        square?23:Math.max(7,layout.trackWidth*.44);
      const dx=group>1&&!base?(offset-(group-1)/2)*radius*.53:0;
      return <Pawn key={token.id} token={token} point={point} radius={radius} legal={legal.includes(token.id)}
        onChoose={onChoose} stackOffset={dx}/>;
    })}
  </svg>;
}
