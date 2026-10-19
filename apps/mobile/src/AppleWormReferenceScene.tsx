import { useId } from 'react';
import type { ScreenshotLevel, ScreenshotPoint } from '../../../packages/games/apple-worm/screenshot-game.ts';
import { WormApple, WormCharacter, WormPortal, WormSky, WormTerrain } from './AppleWormArt.tsx';

/**
 * Single Apple Worm game. The PREMIUM illustration from the earlier in-game
 * screen is now rendered directly over the user's 105 PDF-derived maps.
 * The 40-level authored practice game is not a second route or fallback.
 *
 * The geometry source is strictly the PDF grid: original viewBox 640x360,
 * cell centres (33+30*x,73+30*y), tile 30. The richer art must never change
 * actual terrain/apple/worm/portal coordinates.
 */
const TILE=30;
const ORIGIN_X=18;
const ORIGIN_Y=58;
const center=([x,y]:ScreenshotPoint)=>({
  x:ORIGIN_X+(x+.5)*TILE,
  y:ORIGIN_Y+(y+.5)*TILE,
});

export function AppleWormReferenceScene({board,body,remaining}:{
  board:ScreenshotLevel;
  body:readonly ScreenshotPoint[];
  remaining:readonly ScreenshotPoint[];
}) {
  const id=useId().replace(/:/g,'')+'-source-'+board.number;
  const blocks=board.rows.flatMap((row,y)=>[...row]
    .flatMap((tile,x)=>tile==='#'?[{x,y}]:[]));
  const head=body[0];
  const wormRelative=head?body.map(([x,y])=>({x:x-head[0],y:y-head[1]})):[];
  const headPixel=head?center(head):null;
  // Preserve the observed right-facing starting mouth on the approved Level 002.
  const pdfLevelTwoStart=board.number===2&&body.length===board.worm.length&&
    body.every((p,i)=>p[0]===board.worm[i]![0]&&p[1]===board.worm[i]![1]);

  return <>
    <WormSky width={640} height={360} id={id}/>
    <g data-source-terrain="continuous" transform={'translate('+ORIGIN_X+' '+ORIGIN_Y+')'}>
      <WormTerrain blocks={blocks} tile={TILE}/>
    </g>

    {board.grayObjects.map((p,i)=>{
      const {x,y}=center(p);
      return <g key={'gray-'+i} data-source-gray-object
        transform={'translate('+x+' '+y+')'}>
        <circle r="13" fill="#596879" stroke="#364653" strokeWidth="2"/>
        <circle r="9.5" fill="#a6bcc6" stroke="#e0eef0" strokeWidth="1.4"/>
        <path d="M-7 0H7M0 -7V7M-5 -5L5 5M5 -5L-5 5"
          fill="none" stroke="#697b86" strokeWidth="1.8"/>
        <circle r="3" fill="#e2eef0" stroke="#546b76" strokeWidth="1"/>
      </g>;
    })}

    {board.portal&&(()=>{
      const {x,y}=center(board.portal);
      return <g key="portal" data-source-portal
        transform={'translate('+x+' '+y+')'}>
        <g transform="translate(-15 -15)">
          <WormPortal x={0} y={0} tile={TILE} ready/>
        </g>
      </g>;
    })()}
    {remaining.map((p,i)=>{
      const {x,y}=center(p);
      return <g key={'apple-'+i} data-source-apple
        transform={'translate('+x+' '+y+')'}>
        <g transform="translate(-15 -15)">
          <WormApple x={0} y={0} tile={TILE}/>
        </g>
      </g>;
    })}
    {headPixel&&<g data-source-worm aria-label="Apple Worm"
      transform={'translate('+headPixel.x+' '+headPixel.y+') rotate(0)'}>
      <g transform="translate(-15 -15)">
        <WormCharacter id={id+'-worm'} body={wormRelative} tile={TILE}
          faceAngle={pdfLevelTwoStart?0:undefined}/>
      </g>
    </g>}
  </>;
}
