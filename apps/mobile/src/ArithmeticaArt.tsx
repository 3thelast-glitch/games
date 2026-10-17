import { useId } from 'react';

/**
 * Original wood-framed chalkboard illustration. This SVG appears on the NAQLA
 * library card; gameplay uses the same palette and composition in CSS.
 */
export const CHALK = {
  wood: '#ba7935',
  woodLight: '#ddaa5b',
  woodDark: '#6f431b',
  board: '#272a2b',
  boardDeep: '#191d1e',
  powder: '#f8f8f1',
  muted: '#a5a9aa',
  star: '#c4b96e',
  answers: '#515456',
} as const;
export function ArithmeticaCover() {
  const id = useId().replace(/:/g, '') + '-math';
  return (
    <svg viewBox="0 0 480 444" role="presentation"
      preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id + '-wood'} x1="0" x2="1" y1="0" y2=".7">
          <stop stopColor="#e1ac61"/><stop offset=".47" stopColor="#b77a37"/>
          <stop offset="1" stopColor="#794618"/>
        </linearGradient>
        <radialGradient id={id + '-chalk'} cx=".5" cy=".43" r=".88">
          <stop stopColor="#323434"/><stop offset="1" stopColor="#1b1f20"/>
        </radialGradient>
        <filter id={id+'-noise'}>
          <feTurbulence type="fractalNoise" baseFrequency=".065" numOctaves="2" seed="4"/>
          <feColorMatrix type="saturate" values="0"/>
          <feComponentTransfer><feFuncA type="linear" slope=".075"/></feComponentTransfer>
        </filter>
      </defs>
      <rect width="480" height="444" fill={'url(#'+id+'-wood)'}/>
      <path d="M0 10H480M0 428H480M15 0V444M466 0V444"
        stroke="#f1c17d" strokeWidth="4" opacity=".7"/>
      <g opacity=".16" fill="none" stroke="#61340c" strokeWidth="2.4">
        <path d="M0 7Q117 27 241 6T480 23M0 421Q152 409 268 430T480 416"/>
        <path d="M5 0Q25 131 4 263T14 444M471 0Q461 173 474 285T468 444"/>
      </g>
      <rect x="19" y="18" width="442" height="407" rx="2" fill={'url(#'+id+'-chalk)'}
        stroke="#3f3426" strokeWidth="5"/>
      <rect x="20" y="18" width="440" height="405" fill="#fff" filter={'url(#'+id+'-noise)'} opacity=".3"/>
      <g fill="#f3f3ed" fontFamily="'Comic Sans MS', 'Chalkboard SE', cursive"
        fontWeight="bold">
        <text x="36" y="65" fontSize="27">Level 1</text>
        <text x="240" y="234" fontSize="77" textAnchor="middle">2 + 4 = ?</text>
      </g>
      <rect x="229" y="39" width="224" height="28" rx="4" fill="#4b4c4d"
        stroke="#f8f8f1" strokeWidth="4"/>
      <rect x="234" y="44" width="176" height="18" rx="1" fill="#ebebea"/>
      <g fill="none" stroke="#c9bd76" strokeWidth="2.4" opacity=".86">
        {Array.from({length:5},(_,i)=>{
          const cx=257+i*42,cy=110;
          const points=Array.from({length:10},(_,j)=>{
            const a=-Math.PI/2+j*Math.PI/5, r=j%2?8:18;
            return (cx+Math.cos(a)*r)+','+(cy+Math.sin(a)*r);
          }).join(' ');
          return <polygon key={i} points={points}/>;
        })}
      </g>
      <g fill="#525454" stroke="#616466" strokeWidth="2.5">
        <circle cx="167" cy="323" r="51"/><circle cx="321" cy="323" r="51"/>
      </g>
      <g fill="#fafafa" textAnchor="middle" fontSize="43"
        fontWeight="bold" fontFamily="'Comic Sans MS','Chalkboard SE',cursive">
        <text x="167" y="339">6</text><text x="321" y="339">7</text>
      </g>
    </svg>
  );
}
