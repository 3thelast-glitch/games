import type { ScreenshotLevel, ScreenshotPoint } from '../../../packages/games/apple-worm/screenshot-game.ts';

/**
 * In-game artwork, not a menu thumbnail. Based on the 105 supplied reference
 * frames: radial cyan sky, scalloped clouds, low green bushes, connected
 * chocolate terrain (brick texture from stage 31), green continuous worm,
 * red fruit, and an always-active black spiral exit.
 *
 * Terrain/objects still use the stage-specific source-evidence grid. Artwork
 * does not imply that mid-play screenshots are verified initial positions.
 */
const CELL = 30;
/** Calibration to the reference 640×360 gameplay pixels: grid centres 33+30x, 73+30y. */
const center = ([x,y]:ScreenshotPoint) => ({x:33+x*CELL,y:73+y*CELL});
const touching = (a:ScreenshotPoint,b:ScreenshotPoint) =>
  Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])===1;

export function AppleWormReferenceScene({board,body,remaining}:{
  board:ScreenshotLevel;
  body:readonly ScreenshotPoint[];
  remaining:readonly ScreenshotPoint[];
}) {
  const brick=board.number>=31;
  const cells=board.rows.flatMap((line,y)=>
    [...line].flatMap((tile,x)=>tile==='#'?[{x,y}]:[]));
  const occupied=new Set(cells.map(({x,y})=>x+','+y));
  const exposed=(x:number,y:number)=>!occupied.has(x+','+y);
  const connected=body.every((part,i)=>i===0||touching(part,body[i-1]!));
  const ordered=body.slice().reverse();
  const points=ordered.map(p=>{const c=center(p);return c.x+','+c.y;}).join(' ');
  const head=body[0],neck=body[1];
  // The Level 002 PDF shows the mouth facing right on the upper bend,
  // even though the next visible body section is below the head.
  // Use this authored orientation only for the untouched reference pose.
  const stageTwoInitial=board.number===2&&body.length===board.worm.length&&
    body.every((p,i)=>p[0]===board.worm[i]![0]&&p[1]===board.worm[i]![1]);
  const face=stageTwoInitial?0:head&&neck
    ? head[0]>neck[0]?0:head[0]<neck[0]?180:head[1]>neck[1]?90:-90
    : 0;

  return <>
    <defs>
      <linearGradient id="wormref-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#67b6f4"/>
        <stop offset="100%" stopColor="#89d7fa"/>
      </linearGradient>
      <linearGradient id="wormref-earth" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#9b6338"/>
        <stop offset="35%" stopColor="#784324"/>
        <stop offset="100%" stopColor="#5f321f"/>
      </linearGradient>
      <linearGradient id="wormref-brick" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#c6754a"/>
        <stop offset="100%" stopColor="#924d34"/>
      </linearGradient>
      <linearGradient id="wormref-worm" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#51d823"/>
        <stop offset="100%" stopColor="#29951b"/>
      </linearGradient>
      <linearGradient id="wormref-apple" x1="0" y1="0" x2=".8" y2="1">
        <stop offset="0%" stopColor="#ff7762"/>
        <stop offset="55%" stopColor="#ed3021"/>
        <stop offset="100%" stopColor="#af1918"/>
      </linearGradient>
      <linearGradient id="wormref-metal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#e2e4de"/>
        <stop offset="100%" stopColor="#75808b"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="640" height="360" fill="url(#wormref-sky)"/>
    <g fill="#ffffff" opacity=".1" aria-hidden="true">
      <path d="M315 -70L0 205 0 148Z"/>
      <path d="M315 -70L0 95 0 62Z"/>
      <path d="M315 -70L105 270 167 270Z"/>
      <path d="M315 -70L245 270 289 270Z"/>
      <path d="M315 -70L395 270 452 270Z"/>
      <path d="M315 -70L510 270 575 270Z"/>
      <path d="M315 -70L630 175 630 215Z"/>
      <path d="M315 -70L630 77 630 110Z"/>
    </g>
    <g transform="translate(0 70)">
    <path d="M0 211 Q22 202 40 215 T88 211 T134 207 T181 220 T236 216 T283 207 T336 219 T387 214 T439 205 T493 215 T548 209 T601 212 T650 207 L650 290H0Z"
      fill="#effaff" opacity=".8"/>
    <path d="M-10 229 Q18 203 47 229 T102 232 T158 239 T211 233 T271 236 T329 241 T388 234 T446 232 T508 237 T565 228 T635 227 L635 285H-10Z"
      fill="#f3fbff" opacity=".92"/>
    <path d="M0 252 Q22 232 48 255 T101 255 T154 260 T207 257 T264 260 T317 258 T378 254 T438 260 T492 255 T550 259 T607 254 L630 270H0Z"
      fill="#80b983"/>
    <path d="M0 263 Q35 246 70 267 T139 268 T215 264 T292 269 T375 266 T449 268 T527 264 T630 269 L630 280H0Z"
      fill="#5ca263"/>
    </g>
    {/* Draw a continuous landmass. Internal tile outlines created artificial
          square seams that are absent from the approved PDF platform shape. */}
    <g data-source-terrain="continuous">
      {cells.map(({x,y})=><rect key={'terrain-fill-'+x+'-'+y}
        x={18+x*CELL} y={58+y*CELL} width={CELL} height={CELL}
        fill={brick?'url(#wormref-brick)':'url(#wormref-earth)'}/>)}
      {cells.map(({x,y})=>{
        const top=exposed(x,y-1),bottom=exposed(x,y+1);
        const left=exposed(x-1,y),right=exposed(x+1,y);
        const tx=18+x*CELL,ty=58+y*CELL;
        return <g key={'terrain-details-'+x+'-'+y}
          transform={'translate('+tx+' '+ty+')'}>
          {/* A shared cap and perimeter shadow follow only exposed edges. */}
          {top&&<g fill="none" strokeLinecap="square">
            <path d="M0 1H30" stroke={brick?'#f2b07e':'#cb8751'}
              strokeWidth="3"/>
            <path d="M0 5H30" stroke={brick?'#c9855d':'#ad7040'}
              strokeWidth="1.5" opacity=".9"/>
          </g>}
          {bottom&&<path d="M0 29H30" stroke="#3c221a"
            strokeWidth="3"/>}
          {left&&<path d="M1 0V30" stroke="#4e2b1b"
            strokeWidth="3"/>}
          {right&&<path d="M29 0V30" stroke="#4e2b1b"
            strokeWidth="3"/>}
          {brick?<g fill="none" stroke="#71402c" strokeWidth="1.3" opacity=".7">
            <path d="M0 11H30M0 23H30M15 0V11M6 11V23M22 23V30"/>
          </g>:<g fill="none">
            <path d="M2 10H27M4 19H29" stroke="#9b5e37" strokeWidth="2"
              opacity=".6"/>
            <path d="M7 15H23M3 26H18" stroke="#4d301e" strokeWidth="2"
              opacity=".45"/>
          </g>}
        </g>;
      })}
    </g>
    {board.grayObjects.map((p,i)=>{
      const {x,y}=center(p);
      return <g key={'metal-'+i} transform={'translate('+x+' '+y+')'}
        data-source-gray-object>
        <rect x="-13" y="-13" width="26" height="26" rx="2"
          fill="url(#wormref-metal)" stroke="#5d6870" strokeWidth="2"/>
        <path d="M-10 -7H10M-10 3H10" stroke="#f5f9fa" opacity=".45" strokeWidth="2"/>
        <circle cx="-8" cy="-8" r="1.6" fill="#646e78"/>
        <circle cx="8" cy="-8" r="1.6" fill="#646e78"/>
        <circle cx="-8" cy="8" r="1.6" fill="#646e78"/>
        <circle cx="8" cy="8" r="1.6" fill="#646e78"/>
      </g>;
    })}
    {board.portal&&(()=>{
      const {x,y}=center(board.portal);
      return <g key="portal" transform={'translate('+x+' '+y+')'} data-source-portal
        aria-label="Open exit">
        <ellipse cx="0" cy="3" rx="14" ry="15" fill="#202329"
          stroke="#4a392c" strokeWidth="2"/>
        <path d="M-10 -2C-9 -12 6 -13 10 -4C17 10 -3 14 -5 6C-6 0 4 -2 4 3"
          stroke="#0a111a" strokeWidth="3" strokeLinecap="round" fill="none"/>
        <path d="M-9 -7Q-4 -13 4 -10" stroke="#67757b" strokeWidth="1.5"
          fill="none" opacity=".65"/>
      </g>;
    })()}
    {remaining.map((p,i)=>{
      const {x,y}=center(p);
      return <g key={'fruit-'+i} transform={'translate('+x+' '+y+')'} data-source-apple>
        <path d="M0 -10C-14 -16 -17 0 -10 10C-4 18 1 13 3 14C11 18 18 4 13 -7C10 -13 5 -13 0 -10Z"
          fill="url(#wormref-apple)" stroke="#a81915" strokeWidth="1.5"/>
        <path d="M0 -9L2 -17" stroke="#72401f" strokeWidth="3" strokeLinecap="round"/>
        <path d="M1 -17Q10 -21 13 -13Q6 -11 1 -17Z" fill="#32923b"/>
        <path d="M-9 -4Q-13 3 -7 7" stroke="#ffb3a4" strokeWidth="2.5"
          strokeLinecap="round" fill="none" opacity=".75"/>
      </g>;
    })}
    {connected&&body.length>1?<g fill="none" strokeLinejoin="round" strokeLinecap="round"
      aria-hidden="true">
      <polyline points={points} stroke="#1d8020" strokeWidth="31"/>
      <polyline points={points} stroke="url(#wormref-worm)" strokeWidth="27"/>
      <polyline points={points} stroke="#5de134" strokeWidth="15" opacity=".35"/>
    </g>:body.slice(1).map((p,i)=>{
      const {x,y}=center(p);
      return <rect key={'unknown-part-'+i} x={x-14} y={y-14} width="28" height="28"
        rx="7" fill="url(#wormref-worm)" stroke="#2a8922" strokeWidth="2"/>;
    })}
    {head&&(()=>{
      const {x,y}=center(head);
      return <g transform={'translate('+x+' '+y+') rotate('+face+')'} data-source-worm
        aria-label="Apple Worm">
        <rect x="-15" y="-15" width="30" height="30" rx="7"
          fill="url(#wormref-worm)" stroke="#23861c" strokeWidth="1.5"/>
        <path d="M-10 -11L-10 8" stroke="#93ed57" strokeWidth="2"
          opacity=".7" strokeLinecap="round"/>
        <ellipse cx="6" cy="-9" rx="5" ry="4" fill="#fff"/>
        <ellipse cx="7.5" cy="-9" rx="2.5" ry="3" fill="#172e17"/>
        <ellipse cx="6" cy="-1" rx="4.5" ry="3.5" fill="#fff"/>
        <ellipse cx="7.5" cy="-1" rx="2.2" ry="2.7" fill="#172e17"/>
        <path d="M9 4Q16 5 14 13Q10 15 7 12Z" fill="#a91e8e" stroke="#67115a"
          strokeWidth="1.2"/>
      </g>;
    })()}
  </>;
}
