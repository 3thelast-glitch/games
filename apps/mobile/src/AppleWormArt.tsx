import { useId } from 'react';
import type { Point } from '../../../packages/games/apple-worm/engine.ts';

/**
 * Original vector illustration informed by the visual vocabulary of classic
 * sky-and-earth puzzle games. Shapes are built from runtime board geometry;
 * no images, level sprites or code have been copied from the reference game.
 */
type Cell = Point;
type Segment = { a: Point; b: Point };
const pKey = (p: Point) => p.x + ',' + p.y;
const adj = (p: Point, dx: number, dy: number) => p.x + dx + ',' + (p.y + dy);

export function cellContour(cells: Cell[], tile: number, radius = .16): string {
  if (!cells.length) return '';
  const occupied = new Set(cells.map(pKey));
  const edges: Segment[] = [];
  for (const { x, y } of cells) {
    if (!occupied.has(adj({ x, y }, 0, -1))) edges.push({ a: { x, y }, b: { x: x + 1, y } });
    if (!occupied.has(adj({ x, y }, 1, 0))) edges.push({ a: { x: x + 1, y }, b: { x: x + 1, y: y + 1 } });
    if (!occupied.has(adj({ x, y }, 0, 1))) edges.push({ a: { x: x + 1, y: y + 1 }, b: { x, y: y + 1 } });
    if (!occupied.has(adj({ x, y }, -1, 0))) edges.push({ a: { x, y: y + 1 }, b: { x, y } });
  }
  const outgoing = new Map<string, Segment[]>();
  for (const edge of edges) {
    const key = pKey(edge.a);
    outgoing.set(key, [...(outgoing.get(key) ?? []), edge]);
  }
  const used = new Set<Segment>();
  const rings: Point[][] = [];
  for (const edge of edges) {
    if (used.has(edge)) continue;
    const ring: Point[] = [];
    let current: Segment | undefined = edge;
    for (let n = 0; current && n <= edges.length; n++) {
      if (used.has(current)) break;
      used.add(current);
      ring.push(current.a);
      if (pKey(current.b) === pKey(edge.a)) break;
      current = (outgoing.get(pKey(current.b)) ?? []).find(item => !used.has(item));
    }
    if (ring.length >= 4) rings.push(ring);
  }
  // Soft exterior corners and small inner turns mimic hand-drawn vectors.
  return rings.map(ring => {
    const commands: string[] = [];
    const r = tile * radius;
    const bends = ring.map((v, index) => {
      const prev = ring[(index - 1 + ring.length) % ring.length]!;
      const next = ring[(index + 1) % ring.length]!;
      const inLength = Math.hypot(prev.x - v.x, prev.y - v.y);
      const outLength = Math.hypot(next.x - v.x, next.y - v.y);
      const inset = Math.min(r / tile, inLength / 2, outLength / 2);
      return {
        x: v.x * tile, y: v.y * tile,
        before: { x: (v.x + (prev.x - v.x) / inLength * inset) * tile,
          y: (v.y + (prev.y - v.y) / inLength * inset) * tile },
        after: { x: (v.x + (next.x - v.x) / outLength * inset) * tile,
          y: (v.y + (next.y - v.y) / outLength * inset) * tile },
      };
    });
    for (let i = 0; i < bends.length; i++) {
      const v = bends[i]!;
      if (i === 0) commands.push('M' + v.before.x + ' ' + v.before.y);
      else commands.push('L' + v.before.x + ' ' + v.before.y);
      commands.push('Q' + v.x + ' ' + v.y + ' ' + v.after.x + ' ' + v.after.y);
    }
    return commands.join(' ') + 'Z';
  }).join(' ');
}


export function WormSky({ width, height, id }: { width: number; height: number; id: string }) {
  const horizon = height * .65;
  return <g aria-hidden="true">
    <defs>
      <linearGradient id={id+'-sky'} x1="0" y1="0" x2=".15" y2="1">
        <stop stopColor="#59b7fa"/><stop offset=".57" stopColor="#a1ecf9"/><stop offset="1" stopColor="#e5fcf0"/>
      </linearGradient>
      <radialGradient id={id+'-sun'}><stop stopColor="#fffce1" stopOpacity=".82"/>
        <stop offset=".5" stopColor="#fff4bf" stopOpacity=".35"/>
        <stop offset="1" stopColor="#fff4bf" stopOpacity="0"/></radialGradient>
      <linearGradient id={id+'-cliff'} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#b18e79"/><stop offset=".65" stopColor="#826c72"/>
        <stop offset="1" stopColor="#5e7285"/>
      </linearGradient>
      <linearGradient id={id+'-water'} x1="0" y1="0" x2="1" y2="0">
        <stop stopColor="#c5fffd"/><stop offset=".4" stopColor="#55ddec"/>
        <stop offset="1" stopColor="#8bd7f9"/>
      </linearGradient>
    </defs>
    <rect width={width} height={height} fill={'url(#'+id+'-sky)'}/>
    <circle cx={width*.79} cy={height*.16} r={width*.28} fill={'url(#'+id+'-sun)'}/>
    <g className="worm-clouds" opacity=".85" fill="#fffdf4">
      {Array.from({length:5},(_,i)=>{
        const x=width*(i*.23-.14),y=height*(.2+(i%3)*.15);
        return <g key={i} transform={'translate('+x+' '+y+')'}>
          <ellipse cx="22" rx="55" ry="16" cy="14"/>
          <ellipse cx="0" cy="3" rx="36" ry="21"/>
          <ellipse cx="48" cy="-3" rx="37" ry="24"/>
        </g>;
      })}
    </g>
    <g opacity=".40">
      <path d={'M0 '+horizon+'L'+width*.1+' '+height*.35+'L'+width*.21+' '+height*.52+
        'L'+width*.33+' '+height*.30+'L'+width*.50+' '+height*.49+'L'+width*.65+' '+height*.27+
        'L'+width*.8+' '+height*.49+'L'+width+' '+height*.33+'V'+height+'H0Z'}
        fill="#83c0b4"/>
      <path d={'M0 '+height*.82+'Q'+width*.21+' '+height*.39+' '+width*.43+' '+height*.75+
        'Q'+width*.67+' '+height*.41+' '+width+' '+height*.67+'V'+height+'H0Z'} fill="#70afa5"/>
    </g>
    {Array.from({length:4},(_,i)=>{
      const x=width*(.11+i*.24),y=height*(.39+(i%2)*.08);
      return <g key={i} opacity=".69" transform={'translate('+x+' '+y+')'}>
        <path d="M-46 0L-28 71L4 91L34 49L49 0Z" fill={'url(#'+id+'-cliff)'}/>
        <path d="M-46 0Q-30 -22 -6 -15Q10 -29 39 -12L49 0Q0 25 -46 0Z"
          fill="#5ab97e" stroke="#459c78" strokeWidth="3"/>
        <path d="M-14 7L-10 62Q-3 82 5 88L21 13Z" fill={'url(#'+id+'-water)'} opacity=".78"/>
        <path d="M-35 -4Q-28 -29 -19 -4M14 -9Q21 -34 31 -8"
          fill="none" stroke="#46875b" strokeWidth="10" strokeLinecap="round"/>
      </g>;
    })}
    <path d={'M0 '+height*.89+'Q'+width*.14+' '+height*.75+' '+width*.31+' '+height*.91+
      'Q'+width*.50+' '+height*.72+' '+width*.65+' '+height*.90+
      'Q'+width*.82+' '+height*.76+' '+width+' '+height*.91+'V'+height+'H0Z'}
      fill="#b9e9c7" opacity=".62"/>
  </g>;
}

export function WormTerrain({ blocks, tile }: { blocks: Cell[]; tile: number }) {
  const shape=cellContour(blocks,tile,.12);
  const keys=new Set(blocks.map(pKey));
  const tops=blocks.filter(p=>!keys.has(adj(p,0,-1)));
  return <g aria-hidden="true" className="worm-terrain">
    <defs>
      <linearGradient id="worm-soil-color" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#ce9259"/><stop offset=".47" stopColor="#b87749"/><stop offset="1" stopColor="#825943"/>
      </linearGradient>
      <linearGradient id="worm-grass-color" x1="0" y1="0" x2=".4" y2="1">
        <stop stopColor="#e0f990"/><stop offset=".42" stopColor="#86d55a"/><stop offset="1" stopColor="#48a949"/>
      </linearGradient>
    </defs>
    <path d={shape} transform="translate(0 7)" fill="#385a3e" opacity=".32"/>
    <path d={shape} fill="#8c6548" stroke="#6d563d" strokeWidth="3" strokeLinejoin="round"/>
    {blocks.map(({x,y},i)=>{
      const l=x*tile,t=y*tile,above=!keys.has(x+','+(y-1));
      const seed=(x*17+y*13)%7;
      return <g key={x+'-'+y}>
        <rect x={l+1.6} y={t+1.6} width={tile-3.2} height={tile-3.2} rx={tile*.09}
          fill="url(#worm-soil-color)" stroke="#865b42" strokeWidth="1.5"/>
        <path d={'M'+(l+6)+' '+(t+tile*.63)+'q'+(tile*.3)+' -'+(tile*.10)+' '+(tile*.53)+
          ' 0'} stroke="#dc9d62" strokeWidth="2" fill="none" opacity=".45"/>
        <path d={'M'+(l+tile*.12)+' '+(t+tile*.85)+'l'+(tile*.23)+' '+(tile*.08)+
          'm'+(tile*.32)+' -'+(tile*.1)+'l'+(tile*.14)+' -'+(tile*.09)}
          stroke="#815c44" strokeWidth="2.2" fill="none" opacity=".6" strokeLinecap="round"/>
        <circle cx={l+tile*(.23+.05*seed)} cy={t+tile*.5} r={1.7} fill="#e0b588"/>
        <circle cx={l+tile*.73} cy={t+tile*(.66-.02*seed)} r={2.3} fill="#735140" opacity=".7"/>
        {above && <g>
          <path d={'M'+(l+1)+' '+(t+13)+'Q'+(l+tile*.16)+' '+(t+5)+' '+(l+tile*.33)+' '+(t+9)+
            'Q'+(l+tile*.56)+' '+(t+2)+' '+(l+tile-1)+' '+(t+8)+
            'L'+(l+tile-2)+' '+(t+19)+'Q'+(l+tile*.5)+' '+(t+15)+' '+(l+2)+' '+(t+20)+'Z'}
            fill="#3c9850"/>
          <rect x={l+2} y={t+2} width={tile-4} height={tile*.28} rx={tile*.09}
            fill="url(#worm-grass-color)" stroke="#3d9b48" strokeWidth="1.2"/>
          <path d={'M'+(l+5)+' '+(t+13)+'q4 8 9 0t9 0t8 0t9 0'} stroke="#377c38" strokeWidth="2"
            fill="none" opacity=".65"/>
          {i%4===0&&<g transform={'translate('+(l+tile*.7)+' '+(t+4)+')'}>
            <path d="M0 0q-10 -10 -12 1q6 6 12 -1q2 -12 11 -8q1 10 -11 8Z"
              fill="#399848" stroke="#237343" strokeWidth="1"/>
            <circle r="2" fill="#fef1a0"/>
          </g>}
        </g>}
      </g>;
    })}
    <path d={shape} fill="none" stroke="#694f3a" strokeWidth="2" strokeLinejoin="round"/>
    {tops.map(p=>p.x%4===0?<g key={'flower'+pKey(p)}
      transform={'translate('+(p.x*tile+tile*.76)+' '+(p.y*tile-2)+')'}>
      <path d="M0 7V-3" stroke="#3e9b4d" strokeWidth="2"/>
      {[0,72,144,216,288].map(a=><ellipse key={a} cx="0" cy="-6" rx="3.7" ry="6.1"
        transform={'rotate('+a+' 0 -6)'} fill="#f8f8dc" stroke="#eddfaf" strokeWidth=".8"/>)}
      <circle cy="-6" r="3" fill="#f4b83c"/>
    </g>:null)}
  </g>;
}
export function WormApple({ x, y, tile = 48 }: { x: number; y: number; tile?: number }) {
  const id=useId().replace(/:/g,'')+'-apple';
  const s=tile/48;
  return <g className="worm-apple" transform={'translate('+(x*tile+tile/2)+' '+(y*tile+tile/2)+') scale('+s+')'}>
    <defs><radialGradient id={id} cx=".3" cy=".23" r=".85">
      <stop stopColor="#ffbb78"/><stop offset=".25" stopColor="#fc5039"/><stop offset=".68" stopColor="#dd1f28"/>
      <stop offset="1" stopColor="#982336"/></radialGradient></defs>
    <ellipse cx="2" cy="19" rx="20" ry="6" fill="#574f37" opacity=".30"/>
    <g className="worm-apple-glow">
      <circle r="26" fill="#ffec83" opacity=".24"/>
      <circle r="29" fill="none" stroke="#ffe584" strokeWidth="1.5" strokeDasharray="4 7"/>
      <path d="M-31 0h8M23 0h8M0 -32v8M0 23v8" stroke="#fff7a4" strokeWidth="2.6" strokeLinecap="round"/>
    </g>
    <path d="M-20 -11Q-26 -21 -12 -23Q-4 -27 1 -20Q13 -27 23 -18Q29 -10 20 10Q10 27 1 20Q-14 28 -21 9Q-25 -2 -20 -11Z"
      fill={'url(#'+id+')'} stroke="#922e2c" strokeWidth="2.6" strokeLinejoin="round"/>
    <ellipse cx="-11" cy="-10" rx="6.5" ry="10" transform="rotate(-22 -11 -10)" fill="#fff9d4" opacity=".47"/>
    <path d="M0 -19Q-1 -30 5 -32" stroke="#674632" strokeWidth="4" fill="none" strokeLinecap="round"/>
    <path d="M3 -29Q13 -42 29 -32Q23 -20 7 -23Z" fill="#42b968" stroke="#1c8754" strokeWidth="2"/>
    <path d="M7 -25Q15 -30 24 -31" stroke="#b2ed8a" strokeWidth="1.6" fill="none"/>
  </g>;
}
export function WormPortal({ x, y, tile = 48, ready = false }: {
  x: number; y: number; tile?: number; ready?: boolean;
}) {
  const id=useId().replace(/:/g,'')+'-portal';
  const cx=x*tile+tile/2,cy=y*tile+tile/2,r=tile*.41;
  return <g transform={'translate('+cx+' '+cy+')'} className={ready?'worm-portal-ready':'worm-portal'}>
    <defs><radialGradient id={id}><stop stopColor={ready?'#73f9df':'#131e2c'}/>
      <stop offset=".7" stopColor={ready?'#298dbb':'#253248'}/>
      <stop offset="1" stopColor="#101c2c"/></radialGradient></defs>
    <ellipse cx="0" cy={r*.75} rx={r+3} ry="5" fill="#3c4335" opacity=".3"/>
    <circle r={r+4} fill="#e2bd77" stroke="#8d694e" strokeWidth="3"/>
    <circle r={r} fill={'url(#'+id+')'} stroke="#fff1b3" strokeWidth="2.4"/>
    <circle r={r*.75} fill="none" stroke="#a6e8cd" strokeWidth="1.8" opacity=".6" strokeDasharray="4 4"/>
    <path d={'M'+(-r*.57)+' 0Q'+(-r*.5)+' '+(-r*.60)+' 0 '+(-r*.54)+
      'Q'+(r*.7)+' '+(-r*.4)+' '+(r*.42)+' '+(r*.14)+'Q0 '+(r*.5)+' '+(-r*.17)+
      ' '+(r*.18)+'Q'+(-r*.25)+' 0 0 '+(-r*.1)}
      fill="none" stroke={ready?'#e1fff7':'#90b5c3'} strokeWidth="2.4" strokeLinecap="round"/>
    {[0,90,180,270].map(a=><circle key={a} cx={Math.cos(a*Math.PI/180)*(r+1.3)}
      cy={Math.sin(a*Math.PI/180)*(r+1.3)} r="2" fill="#fff1c5"/>)}
  </g>;
}
export function WormCharacter({ body, tile = 48, id }: {
  body: Point[]; tile?: number; id: string;
}) {
  if(!body.length)return null;
  const outline=cellContour(body,tile,.31);
  const head=body[0]!,neck=body[1]??{x:head.x-1,y:head.y};
  const angle=head.x<neck.x?180:head.y<neck.y?-90:head.y>neck.y?90:0;
  const hx=(head.x+.5)*tile,hy=(head.y+.5)*tile,c=tile/48;
  return <g className="worm-character" aria-hidden="true">
    <defs>
      <radialGradient id={id+'-green'} cx=".35" cy=".18" r=".79">
        <stop stopColor="#c4ff70"/><stop offset=".24" stopColor="#79e94a"/>
        <stop offset=".66" stopColor="#39bd35"/><stop offset="1" stopColor="#258236"/>
      </radialGradient>
      <radialGradient id={id+'-face'} cx=".28" cy=".2" r=".95">
        <stop stopColor="#d6ff92"/><stop offset=".47" stopColor="#81e64e"/>
        <stop offset="1" stopColor="#32a949"/>
      </radialGradient>
      <clipPath id={id+'-shape'}><path d={outline}/></clipPath>
    </defs>
    <path d={outline} transform="translate(0 4)" fill="#426f39" opacity=".34"/>
    <path d={outline} fill="#44b43b" stroke="#2b8b37" strokeWidth="3" strokeLinejoin="round"/>
    <g clipPath={'url(#'+id+'-shape)'}>
      {body.map((p,i)=>{
        const x=(p.x+.5)*tile,y=(p.y+.5)*tile;
        return <g key={i}>
          <ellipse cx={x+2} cy={y+5} rx={tile*.43} ry={tile*.37} fill="#3a9a37"/>
          <circle cx={x} cy={y} r={tile*.44} fill={'url(#'+id+'-green)'}/>
          <ellipse cx={x-tile*.16} cy={y-tile*.22} rx={tile*.14} ry={tile*.085}
            fill="#eaffcf" opacity=".53" transform={'rotate(-25 '+x+' '+y+')'}/>
          <path d={'M'+(x-tile*.26)+' '+(y+tile*.25)+'Q'+x+' '+(y+tile*.45)+' '+(x+tile*.24)+' '+(y+tile*.24)}
            stroke="#c5f495" strokeWidth={tile*.11} strokeLinecap="round" opacity=".8" fill="none"/>
        </g>;
      })}
    </g>
    <g transform={'translate('+hx+' '+hy+') rotate('+angle+') scale('+c+')'}>
      <circle r="22.2" fill="url(#worm-head-fill)" stroke="#207d35" strokeWidth="2.5"/>
      <circle r="22" fill={'url(#'+id+'-face)'}/>
      <path d="M-7 -18q-8 -14 -2 -18q7 -3 9 12M6 -20q1 -13 9 -16q8 2 2 15"
        fill="none" stroke="#3caa3f" strokeWidth="4.8" strokeLinecap="round"/>
      <circle cx="-10" cy="-34" r="4.6" fill="#79df45"/>
      <circle cx="17" cy="-35" r="4.6" fill="#79df45"/>
      <ellipse cx="-5" cy="-6" rx="10.3" ry="13.4" fill="#fff" stroke="#31583e" strokeWidth="1.8"/>
      <ellipse cx="13" cy="-6" rx="10.2" ry="13.4" fill="#fff" stroke="#31583e" strokeWidth="1.8"/>
      <circle cx="-1" cy="-5" r="5.9" fill="#202d35"/><circle cx="17" cy="-5" r="5.9" fill="#202d35"/>
      <circle cx="1" cy="-9" r="2" fill="#fff"/><circle cx="19" cy="-9" r="2" fill="#fff"/>
      <path d="M1 9Q12 4 20 12Q21 22 11 22Q2 20 1 9Z"
        fill="#812846" stroke="#663044" strokeWidth="1.8"/>
      <path d="M8 17Q13 12 19 18" stroke="#fa8fa0" strokeWidth="3.2" fill="none" strokeLinecap="round"/>
      <ellipse cx="-15" cy="9" rx="4" ry="2.4" fill="#f29b79" opacity=".63"/>
    </g>
  </g>;
}
export function AppleWormCover() {
  const id=useId().replace(/:/g,'')+'-cover';
  const blocks:Point[]=[
    ...Array.from({length:9},(_,x)=>({x:x+1,y:6})),
    {x:2,y:5},{x:2,y:4},{x:7,y:5},{x:8,y:5},
  ];
  return <svg viewBox="0 0 480 444" preserveAspectRatio="xMidYMid slice"
      role="presentation" xmlns="http://www.w3.org/2000/svg">
    <WormSky width={480} height={444} id={id}/>
    <WormTerrain blocks={blocks} tile={46}/>
    <WormApple x={6.8} y={5} tile={46}/>
    <WormPortal x={9} y={5.05} tile={46}/>
    <WormCharacter body={[{x:4,y:5},{x:3,y:5},{x:3,y:4}]}
      tile={46} id={id}/>
  </svg>;
}
