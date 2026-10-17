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
  const cloudsY = height * .74;
  return <g>
    <defs>
      <linearGradient id={id + '-sky'} x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#6e9df1" /><stop offset=".7" stopColor="#7bb2f4"/>
        <stop offset="1" stopColor="#b7d4f5"/>
      </linearGradient>
    </defs>
    <rect width={width} height={height} fill={'url(#' + id + '-sky)'}/>
    <g opacity=".14" fill="#d3e5ff">
      <path d={'M' + (width * .34) + ' 0 L' + (width * .58) + ' 0 L' +
        (width * .92) + ' ' + height + ' L' + (width * .67) + ' ' + height + 'Z'}/>
      <path d={'M' + (width * .01) + ' 0 L' + (width * .19) + ' 0 L' +
        (width * .43) + ' ' + height + ' L' + (width * .2) + ' ' + height + 'Z'}/>
      <path d={'M' + (width * .8) + ' 0 L' + width + ' 0 L' +
        (width * .78) + ' ' + height + ' L' + (width * .65) + ' ' + height + 'Z'}/>
    </g>
    <g fill="#dcecf9" opacity=".59">
      <path d={'M0 ' + (cloudsY + 45) +
        'Q' + (width * .04) + ' ' + (cloudsY - 15) + ' ' + (width * .12) + ' ' + (cloudsY + 9) +
        'Q' + (width * .17) + ' ' + (cloudsY - 48) + ' ' + (width * .27) + ' ' + (cloudsY + 9) +
        'Q' + (width * .34) + ' ' + (cloudsY - 22) + ' ' + (width * .42) + ' ' + (cloudsY + 24) +
        'Q' + (width * .48) + ' ' + (cloudsY - 12) + ' ' + (width * .56) + ' ' + (cloudsY + 17) +
        'Q' + (width * .62) + ' ' + (cloudsY - 37) + ' ' + (width * .72) + ' ' + (cloudsY + 9) +
        'Q' + (width * .83) + ' ' + (cloudsY - 48) + ' ' + (width * .9) + ' ' + (cloudsY + 12) +
        'Q' + (width * .97) + ' ' + (cloudsY - 14) + ' ' + width + ' ' + (cloudsY + 20) +
        'V' + height + 'H0Z'}/>
    </g>
    <path d={'M0 ' + (height - 22) +
      'Q' + (width * .05) + ' ' + (height - 72) + ' ' + (width * .12) + ' ' + (height - 44) +
      'Q' + (width * .17) + ' ' + (height - 94) + ' ' + (width * .24) + ' ' + (height - 40) +
      'Q' + (width * .34) + ' ' + (height - 67) + ' ' + (width * .42) + ' ' + (height - 35) +
      'Q' + (width * .53) + ' ' + (height - 85) + ' ' + (width * .63) + ' ' + (height - 35) +
      'Q' + (width * .71) + ' ' + (height - 83) + ' ' + (width * .79) + ' ' + (height - 43) +
      'Q' + (width * .9) + ' ' + (height - 75) + ' ' + width + ' ' + (height - 29) +
      'V' + height + 'H0Z'} fill="#96be82" opacity=".83"/>
    <path d={'M0 ' + (height - 8) + 'Q' + (width * .2) + ' ' + (height - 35) +
      ' ' + (width * .35) + ' ' + (height - 14) + 'T' + width + ' ' + (height - 10) +
      'V' + height + 'H0Z'} fill="#83af77" opacity=".48"/>
    {Array.from({ length: 22 }, (_, i) => {
      const x = ((i * 97 + 31) % Math.max(1, Math.floor(width)));
      const y = height - 7 - (i * 13 % 28);
      return <ellipse key={i} cx={x} cy={y} rx="4.5" ry="2.5" fill="#c3d784" opacity=".45"/>;
    })}
  </g>;
}

export function WormTerrain({ blocks, tile }: { blocks: Cell[]; tile: number }) {
  const shape = cellContour(blocks, tile, .10);
  const keys = new Set(blocks.map(pKey));
  const tops = blocks.filter(p => !keys.has(adj(p, 0, -1)));
  const lefts = blocks.filter(p => !keys.has(adj(p, -1, 0)));
  const rights = blocks.filter(p => !keys.has(adj(p, 1, 0)));
  return <g aria-hidden="true" strokeLinejoin="round" strokeLinecap="round">
    <path d={shape} transform="translate(0 3)" fill="#342116" stroke="#302019" strokeWidth="5"/>
    <path d={shape} fill="#57321f" stroke="#302019" strokeWidth="4.2"/>
    {lefts.map(p => <path key={'left' + pKey(p)}
      d={'M' + (p.x * tile + 3) + ' ' + (p.y * tile + 8) + 'L' +
        (p.x * tile + tile * .18) + ' ' + (p.y * tile + 13) + 'V' +
        (p.y * tile + tile - 7) + 'L' + (p.x * tile + 3) + ' ' + (p.y * tile + tile - 12) + 'Z'}
      fill="#3e251b" stroke="#9d6c46" strokeWidth="1.6" />)}
    {tops.map(p => <path key={'top' + pKey(p)}
      d={'M' + (p.x * tile + 2) + ' ' + (p.y * tile + 3) + 'L' +
        ((p.x + 1) * tile - 3) + ' ' + (p.y * tile + 3) + 'L' +
        ((p.x + 1) * tile - 10) + ' ' + (p.y * tile + 14) + 'L' +
        (p.x * tile + 9) + ' ' + (p.y * tile + 14) + 'Z'}
      fill="#96613f" stroke="#ae754b" strokeWidth="1.25" />)}
    {rights.map(p => <path key={'right' + pKey(p)}
      d={'M' + ((p.x + 1) * tile - 4) + ' ' + (p.y * tile + 8) + 'L' +
        ((p.x + 1) * tile - 4) + ' ' + ((p.y + 1) * tile - 9)}
      fill="none" stroke="#a06c44" strokeWidth="2" opacity=".85"/>)}
    <path d={shape} fill="none" stroke="#8c5b3c" strokeWidth="2.7" opacity=".98"/>
  </g>;
}

export function WormApple({ x, y, tile = 48 }: { x: number; y: number; tile?: number }) {
  const c = tile / 48;
  return <g transform={'translate(' + (x * tile + tile / 2) + ' ' + (y * tile + tile / 2 + 3) + ') scale(' + c + ')'}>
    <path d="M-19 -11C-25 -23 -8 -27 0 -17C12 -27 28 -20 22 -4C21 8 15 21 4 22C-2 25 -12 21 -17 12C-23 3 -24 -3 -19 -11Z"
      fill="#bd2118" stroke="#632b1a" strokeWidth="3.6" strokeLinejoin="round"/>
    <path d="M-18 -9C-14 -18 -6 -18 0 -16C8 -20 20 -16 20 -7L18 9Q10 26 0 18Q-10 23 -17 7Z"
      fill="#e32c18" opacity=".9"/>
    <path d="M-16 -12Q-3 -18 13 -11" fill="none" stroke="#ffac47" strokeWidth="3.4" strokeLinecap="round"/>
    <path d="M-3 -18Q-3 -27 4 -30" fill="none" stroke="#372c16" strokeWidth="4" strokeLinecap="round"/>
    <path d="M1 -28Q13 -42 29 -33Q21 -20 7 -23Z" fill="#117d32" stroke="#093b29" strokeWidth="3" strokeLinejoin="round"/>
    <path d="M-17 -8Q-12 -14 -6 -13" fill="none" stroke="#ffe08b" strokeWidth="3" opacity=".8" strokeLinecap="round"/>
  </g>;
}

export function WormPortal({ x, y, tile = 48, ready = false }: {
  x: number; y: number; tile?: number; ready?: boolean;
}) {
  const radius = tile * .42;
  const centerX = x * tile + tile / 2;
  const centerY = y * tile + tile / 2;
  return <g transform={'translate(' + centerX + ' ' + centerY + ')'}>
    <circle r={radius + 1.5} fill="#24262a" stroke="#101114" strokeWidth="3.2"/>
    <circle r={radius - 3} fill="#090b0d" stroke="#373b40" strokeWidth="2.2"/>
    <circle r={radius - 8} fill="#0f1013" stroke="#20242a" strokeWidth="2"/>
    <path d={'M-' + (radius * .65) + ' 0C-' + (radius * .76) + ' -' + (radius * .7) +
      ' ' + (radius * .63) + ' -' + (radius * .75) + ' ' + (radius * .65) + ' -1C' +
      (radius * .66) + ' ' + (radius * .66) + ' -' + (radius * .53) + ' ' + (radius * .62) +
      ' -' + (radius * .52) + ' 0C-' + (radius * .47) + ' ' + (radius * .46) +
      ' ' + (radius * .42) + ' ' + (radius * .38) + ' ' + (radius * .36) + ' 0C' +
      (radius * .4) + ' -' + (radius * .29) + ' -' + (radius * .16) + ' -' + (radius * .25) +
      ' -' + (radius * .1) + ' 0'}
      stroke="#3c4042" strokeWidth="2.1" fill="none" strokeLinecap="round"/>
    <circle r="2.7" fill="#020303"/>
    {ready && <circle r={radius + 4} fill="none" stroke="#474a4a" opacity=".65" strokeWidth="1.7"/>}
  </g>;
}

export function WormCharacter({ body, tile = 48, id }: {
  body: Point[]; tile?: number; id: string;
}) {
  if (!body.length) return null;
  const outline = cellContour(body, tile, .31);
  const head = body[0]!;
  const neck = body[1] ?? { x: head.x - 1, y: head.y };
  const angle = head.x < neck.x ? 180 : head.y < neck.y ? -90 : head.y > neck.y ? 90 : 0;
  const hx = (head.x + .5) * tile;
  const hy = (head.y + .5) * tile;
  const c = tile / 48;
  return <g className="worm-character" aria-hidden="true">
    <defs>
      <linearGradient id={id + '-green'} x1=".1" y1="0" x2=".94" y2=".9">
        <stop stopColor="#098100"/><stop offset=".63" stopColor="#098000"/>
        <stop offset="1" stopColor="#035b05"/>
      </linearGradient>
      <clipPath id={id + '-shape'}><path d={outline}/></clipPath>
    </defs>
    <path d={outline} transform="translate(0 2)" fill="#124d0d" opacity=".33"/>
    <path d={outline} fill={'url(#' + id + '-green)'} stroke="#064109"
      strokeWidth={3.5*c} strokeLinejoin="round"/>
    <g clipPath={'url(#' + id + '-shape)'}>
      {body.map((p, i) => <g key={i}>
        <path d={'M' + (p.x * tile + 3) + ' ' + (p.y * tile + 4) + 'H' +
          (p.x * tile + tile * .48) + 'Q' + (p.x * tile + tile * .68) + ' ' +
          (p.y * tile + tile * .45) + ' ' + (p.x * tile + 5) + ' ' +
          (p.y * tile + tile * .75) + 'Z'} fill="#1f9f12" opacity={i === 0 ? .47 : .28}/>
        {i > 0 && <path d={'M' + (p.x * tile + tile * .85) + ' ' + (p.y * tile + 3) +
          'V' + (p.y * tile + tile - 6)} stroke="#034c08" strokeWidth={tile * .035} opacity=".19"/>}
      </g>)}
    </g>
    <g transform={'translate(' + hx + ' ' + hy + ') rotate(' + angle + ') scale(' + c + ')'}>
      <ellipse cx="0" cy="-10" rx="12" ry="13.5" fill="#fcffff"
        stroke="#14181e" strokeWidth="3.1"/>
      <ellipse cx="15" cy="-10" rx="11.5" ry="13" fill="#fcffff"
        stroke="#14181e" strokeWidth="3.1"/>
      <circle cx="5.5" cy="-11" r="5.1" fill="#12161c"/>
      <circle cx="18.3" cy="-11" r="4.7" fill="#12161c"/>
      <circle cx="7" cy="-14" r="1.65" fill="#fff"/>
      <circle cx="19.8" cy="-14" r="1.55" fill="#fff"/>
      <path d="M6 7Q20 3 23 11V23Q11 26 3 20Q-1 13 6 7Z"
        fill="#b727a4" stroke="#24111e" strokeWidth="3.6" strokeLinejoin="round"/>
      <path d="M6 14H23" stroke="#311333" strokeWidth="2.6" strokeLinecap="round"/>
      <path d="M10 20H21" stroke="#e65ed5" strokeWidth="2.2" strokeLinecap="round"/>
    </g>
  </g>;
}

export function AppleWormCover() {
  const id = useId().replace(/:/g, '') + '-cover';
  const blocks: Point[] = [
    ...Array.from({ length: 8 }, (_, x) => ({ x: x + 1, y: 7 })),
    ...Array.from({ length: 4 }, (_, i) => ({ x: 1, y: i + 3 })),
    ...Array.from({ length: 3 }, (_, i) => ({ x: 7, y: i + 4 })),
    ...Array.from({ length: 3 }, (_, i) => ({ x: 8, y: i + 4 })),
    { x: 6, y: 6 },
  ];
  return <svg viewBox="0 0 480 444" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <WormSky width={480} height={444} id={id}/>
    <WormTerrain blocks={blocks} tile={47}/>
    <WormApple x={4.5} y={5.8} tile={47}/>
    <WormPortal x={8.55} y={3.05} tile={47}/>
    <WormCharacter body={[{ x: 3, y: 2 }, { x: 2, y: 2 }, { x: 1, y: 2 }]}
      tile={47} id={id}/>
  </svg>;
}
