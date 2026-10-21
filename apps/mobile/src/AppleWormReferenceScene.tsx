import { useId, type CSSProperties } from 'react';
import type { ScreenshotLevel, ScreenshotPoint } from '../../../packages/games/apple-worm/screenshot-game.ts';
import { displayGrayPositions } from '../../../packages/games/apple-worm/gray-box-physics-batch-3.ts';
import { WormApple, WormCharacter, WormPortal, WormSky, WormTerrain }
  from './AppleWormArt.tsx';
import { appleWormFacingAngle, appleWormMouthCue } from './apple-worm-animation-cues.ts';

/**
 * VISUAL-ONLY ART PASS — PDF105-R5.
 *
 * Keep the exact 21 x 9 / 30px-grid positions from the user's approved
 * source layouts (viewBox 630 x 270). This component never edits game state,
 * changes the 105 source maps, offsets a cell, or decides whether a move wins.
 *
 * Premium WormSky/Terrain/Character/Apple/Portal are the previous, attractive
 * artwork, now applied to the ONE approved PDF stage renderer. All sprite
 * anchors are at precisely (x+0.5)*30, (y+0.5)*30, including offboard exits.
 */
const CELL=30;
const anchor=([x,y]:ScreenshotPoint)=>({
  x:(x+.5)*CELL,y:(y+.5)*CELL,
});

export function AppleWormReferenceScene({board,body,remaining,grayPositions,phase='playing',biteFx=null,showSky=true,previousWormHead=null,wormMotionKey=0}:{
  board:ScreenshotLevel;
  body:readonly ScreenshotPoint[];
  remaining:readonly ScreenshotPoint[];
  grayPositions?:readonly ScreenshotPoint[];
  phase?:'playing'|'won'|'lost';
  biteFx?:{key:number;apple:ScreenshotPoint}|null;
  showSky?:boolean;
  previousWormHead?:ScreenshotPoint|null;
  wormMotionKey?:number;
}) {
  const id=useId().replace(/:/g,'')+'-pdf105-r9';
  // Retain the seven fixed gray pillar cells while animating Stage 104's crate.
  const currentGray=displayGrayPositions(board.number,board.grayObjects,grayPositions);
  const blocks=board.rows.flatMap((row,y)=>[...row].flatMap((tile,x)=>
    tile==='#'?[{x,y}]:[]));
  const worm=body.map(([x,y])=>({x,y}));
  const head=body[0],neck=body[1];
  const headAnchor=head?anchor(head):null;
  // Stage 2's approved source frame shows a right-facing mouth on the bend.
  // This is art direction ONLY; it does not change the worm body's direction.
  const stageTwoSourcePose=board.number===2&&body.length===board.worm.length&&
    body.every((p,i)=>p[0]===board.worm[i]![0]&&p[1]===board.worm[i]![1]);
  // The head always faces along its own body direction; NEVER toward fruit.
  // Keep the original source-frame head pose as a cosmetic exception on L002.
  const faceAngle=appleWormFacingAngle(body,stageTwoSourcePose);
  const occupied:ScreenshotPoint[]=[...blocks.map(p=>[p.x,p.y] as const),
    ...currentGray,...body.slice(1)];
  const cue=appleWormMouthCue(head,remaining,phase,faceAngle,occupied);
  const chewing=biteFx!==null&&phase!=='lost';

  return <>
    {showSky&&<WormSky width={630} height={270} id={id+'-sky'}/> }
    <defs>
      <radialGradient id={id+'-gleam'} cx=".5" cy=".5" r=".5">
        <stop stopColor="#ffffff" stopOpacity=".7"/>
        <stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
      </radialGradient>
      <linearGradient id={id+'-metal'} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#f6fcff"/>
        <stop offset=".31" stopColor="#bccfda"/>
        <stop offset=".7" stopColor="#718fa4"/>
        <stop offset="1" stopColor="#466273"/>
      </linearGradient>
      <linearGradient id={id+'-metal-inset'} x1="0" y1="0" x2=".8" y2="1">
        <stop stopColor="#c5deeb"/>
        <stop offset="1" stopColor="#6c92a4"/>
      </linearGradient>
    </defs>
    <g aria-hidden="true" opacity=".48" className="worm-world-glints">
      <circle cx="76" cy="59" r="28" fill={'url(#'+id+'-gleam)'}/>
      <circle cx="516" cy="45" r="21" fill={'url(#'+id+'-gleam)'}/>
      <path d="M88 63v9m-5-4h10M537 103v8m-4-4h8M288 30v7m-3-3h6"
        stroke="#fffbe1" strokeWidth="1.5" strokeLinecap="round"/>
    </g>

    <g data-source-terrain="premium-art" data-terrain-cell-count={blocks.length}>
      <WormTerrain blocks={blocks} tile={CELL}/>
    </g>

    {currentGray.map((point,i)=>{
      const {x,y}=anchor(point);
      return <g key={'obstacle-'+i} data-source-gray-object
        transform={'translate('+x+' '+y+')'}>
        <rect x="-13" y="-12" width="26" height="26" rx="6" fill="#203f4c" opacity=".24"
          transform="translate(1 3)"/>
        <rect x="-13" y="-13" width="26" height="26" rx="6"
          fill={'url(#'+id+'-metal)'} stroke="#456274" strokeWidth="1.8"/>
        <rect x="-10.5" y="-10.5" width="21" height="21" rx="4.5"
          fill={'url(#'+id+'-metal-inset)'} stroke="#e7f4f7" strokeWidth="1"/>
        <path d="M-9-9h15" stroke="#ffffff" strokeWidth="1.7"
          strokeLinecap="round" opacity=".8"/>
        <path d="M-6-3Q-6-8 0-8Q6-8 6-3Q6 0 1 2L1 4"
          fill="none" stroke="#395a6a" strokeWidth="2.1"
          strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="1" cy="8" r="1.5" fill="#395a6a"/>
        <circle cx="-9" cy="9" r="1" fill="#f2ffff"/>
        <circle cx="9" cy="-9" r="1" fill="#f2ffff"/>
      </g>;
    })}

    {board.portal&&(()=>{
      const {x,y}=anchor(board.portal);
      return <g key="portal" data-source-portal
        transform={'translate('+x+' '+y+')'}>
        {/* Portal is active regardless of apples; effects never gate winning. */}
        <g className="worm-portal-energy" aria-hidden="true">
          <circle className="worm-portal-breath" r="19" fill="none"
            stroke="#b7fff0" strokeWidth="1.5" opacity=".6"/>
          <g className="worm-portal-orbit">
            <circle r="21.5" fill="none" stroke="#75ebf7"
              strokeWidth="1.6" strokeDasharray="2.5 9" opacity=".8"/>
            <circle cx="21.5" cy="0" r="2.2" fill="#fffbd3"/>
            <circle cx="-21.5" cy="0" r="1.4" fill="#85fcf3"/>
          </g>
          {[0,1,2,3].map(i=><circle key={'portal-spark-'+i}
            className="worm-portal-spark" cx={Math.cos(i*Math.PI/2)*19}
            cy={Math.sin(i*Math.PI/2)*19} r="1.5" fill="#eafffb"
            style={{animationDelay:(i*.35)+'s'}}/>)}
        </g>
        <g transform={'translate('+(-CELL/2)+' '+(-CELL/2)+')'}>
          <WormPortal x={0} y={0} tile={CELL} ready/>
        </g>
        {phase==='won'&&<g className="worm-portal-victory" aria-hidden="true">
          <circle r="16" fill="none" stroke="#fff7bd" strokeWidth="3"/>
          <circle r="25" fill="none" stroke="#79ffe7" strokeWidth="2"/>
        </g>}
      </g>;
    })()}

    {remaining.map((p,i)=>{
      const {x,y}=anchor(p);
      return <g key={'apple-'+i} data-source-apple
        transform={'translate('+x+' '+y+')'}>
        <g className="worm-fruit-aura" aria-hidden="true">
          <circle className="worm-fruit-pulse" r="17" fill="none"
            stroke="#fff6a1" strokeWidth="1.6" opacity=".7"/>
          <path d="M-19 -8l-3 -4M20 9l4 3M0 -20v-5"
            stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round"/>
        </g>
        <g className="worm-fruit-float">
          <g transform={'translate('+(-CELL/2)+' '+(-CELL/2)+')'}>
            <WormApple x={0} y={0} tile={CELL}/>
          </g>
        </g>
      </g>;
    })}
    {biteFx&&(()=>{
      const {x,y}=anchor(biteFx.apple);
      return <g key={'bite-fx-'+biteFx.key} data-apple-bite-fx
        className="worm-apple-crumbs" aria-hidden="true"
        transform={'translate('+x+' '+y+')'}>
        <circle className="worm-bite-ring" r="5" fill="none"
          stroke="#fff5ae" strokeWidth="2.3"/>
        {[0,1,2,3,4,5,6,7].map(i=>{
          const a=i*Math.PI/4;
          return <g key={'crumb-'+i}
            transform={'rotate('+(i*45)+')'}>
            <path className="worm-bite-spark"
              d="M0 -9Q2 -15 0 -21Q-2 -15 0 -9Z"
              fill={i%2?'#e5ff88':'#ffcb5f'}/>
          </g>;
        })}
        <circle r="3" fill="#fff7c7"/>
      </g>;
    })()}

    {headAnchor&&<g data-source-worm
      data-head-x={headAnchor.x} data-head-y={headAnchor.y}
      data-body-length={body.length}
      data-neck-x={neck?anchor(neck).x:undefined}
      data-neck-y={neck?anchor(neck).y:undefined}
      data-face-angle={faceAngle} data-mouth-target-distance={cue.distance??'none'}>
      <g key={wormMotionKey}
        className={previousWormHead&&head?'worm3-worm-step-motion':''}
        style={previousWormHead&&head?{
          '--worm-motion-dx':(Math.max(-2.5,Math.min(2.5,previousWormHead[0]-head[0]))*CELL)+'px',
          '--worm-motion-dy':(Math.max(-2.5,Math.min(2.5,previousWormHead[1]-head[1]))*CELL)+'px',
        } as CSSProperties:undefined}>
        <WormCharacter body={worm} tile={CELL} id={id+'-worm'}
          anticipating={cue.hungry&&!chewing} bite={chewing}
          faceAngle={faceAngle}/>
      </g>
    </g>}
  </>;
}
