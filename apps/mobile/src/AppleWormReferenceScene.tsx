import type { ScreenshotLevel, ScreenshotPoint } from '../../../packages/games/apple-worm/screenshot-game.ts';

/**
 * The ONE Apple Worm playfield is now the formerly reference-only 105-stage
 * brown-block / green-circle board requested in the user's desktop capture.
 *
 * It uses the same PDF-derived data for rendering AND actual movement.
 * Neither the independently authored 40-stage set nor the floating-island
 * artwork may replace the approved 105 stage maps.
 *
 * Gallery-native coordinate system: 21 columns x 9 rows, 30px cells,
 * 630 x 270 viewBox. Level selection does not change renderers.
 */
const CELL=30;
const point=([x,y]:ScreenshotPoint)=>({x:x*CELL+15,y:y*CELL+15});

export function AppleWormReferenceScene({board,body,remaining}:{
  board:ScreenshotLevel;
  body:readonly ScreenshotPoint[];
  remaining:readonly ScreenshotPoint[];
}) {
  return <>
    <rect width="630" height="270" fill="#a4eaff"/>
    <path d="M0 224 Q70 175 135 219 T270 220 T405 218 T540 220 T675 219V270H0Z"
      fill="#e9faff"/>
    <g data-source-terrain="gallery-approved">
      {board.rows.map((line,y)=>[...line].map((tile,x)=>tile==='#'
        ?<g key={y*21+x}>
          <rect x={x*CELL} y={y*CELL} width={CELL} height={CELL}
            fill="#7b4d31" stroke="#523727" strokeWidth="1.5"/>
          <path d={'M'+(x*CELL+2)+' '+(y*CELL+3)+'h26'}
            stroke="#ac7651" strokeWidth="2"/>
        </g>:null))}
    </g>
    {board.grayObjects.map((p,i)=>{
      const {x,y}=point(p);
      return <g key={'gray-'+i} data-source-gray-object
        transform={'translate('+x+' '+y+')'}>
        <rect x="-13" y="-13" width="26" height="26" rx="5"
          fill="#95a1ad" stroke="#5f6c78" strokeWidth="2"/>
        <text textAnchor="middle" y="6" fontSize="18" fill="#253442">?</text>
      </g>;
    })}
    {remaining.map((p,i)=>{
      const {x,y}=point(p);
      return <g key={'apple-'+i} data-source-apple>
        <circle cx={x} cy={y+2} r="12" fill="#e13930"
          stroke="#a81825" strokeWidth="1.5"/>
        <path d={'M'+x+' '+(y-8)+'l2 -8m-2 6q8 -9 11 -1'}
          fill="none" stroke="#227b43" strokeWidth="3"
          strokeLinecap="round"/>
      </g>;
    })}
    <g data-source-worm aria-label="Apple Worm">
      {body.map((p,i)=>{
        const {x,y}=point(p);
        return <circle key={'worm-'+i} data-worm-segment
          cx={x} cy={y} r="14" fill="#55c733"
          stroke="#289331" strokeWidth="2"/>;
      })}
    </g>
    {board.portal&&(()=>{
      const {x,y}=point(board.portal);
      return <g key="portal" data-source-portal
        transform={'translate('+x+' '+y+')'}>
        <circle r="16" fill="#17253c" stroke="#505975" strokeWidth="3"/>
        <path d="M-10 -3C3 -19 16 -4 6 6S-6 8 1 1"
          stroke="#c0c2ea" strokeWidth="2" fill="none"/>
      </g>;
    })()}
    <rect x="1" y="1" width="628" height="268"
      fill="none" stroke="#e9fbff" strokeOpacity=".55" strokeWidth="2"/>
  </>;
}
