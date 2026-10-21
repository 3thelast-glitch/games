import {useId} from 'react';
import type {ScreenshotLevel, ScreenshotPoint} from '../../../packages/games/apple-worm/screenshot-game.ts';
import {displayGrayPositions} from '../../../packages/games/apple-worm/gray-box-physics-batch-3.ts';

/**
 * Fullscreen classic SVG gameplay skin inspired by user's Apple Worm
 * reference shots. Geometry and positions come solely from the 105-level
 * source engine; this view never changes collisions or physics.
 */
const CELL=30;
const key=([x,y]:readonly[number,number])=>x+','+y;
function outline(points:readonly ScreenshotPoint[],stroke:string,width=2.8){
  const occupied=new Set(points.map(key));
  const lines:string[]=[];
  for(const [x,y] of points){
    const left=x*CELL,top=y*CELL,right=left+CELL,bottom=top+CELL;
    if(!occupied.has((x)+','+(y-1)))lines.push('M'+left+' '+top+'H'+right);
    if(!occupied.has((x+1)+','+y))lines.push('M'+right+' '+top+'V'+bottom);
    if(!occupied.has((x)+','+(y+1)))lines.push('M'+left+' '+bottom+'H'+right);
    if(!occupied.has((x-1)+','+y))lines.push('M'+left+' '+top+'V'+bottom);
  }
  return <path d={lines.join('')} fill="none" stroke={stroke} strokeWidth={width}
    strokeLinejoin="round" strokeLinecap="round"/>;
}
export function AppleWormClassicBoard({board,body,remaining,grayPositions,biteFx}:{ 
  board:ScreenshotLevel;
  body:readonly ScreenshotPoint[];
  remaining:readonly ScreenshotPoint[];
  grayPositions?:readonly ScreenshotPoint[];
  biteFx?:{key:number;apple:ScreenshotPoint}|null;
}){
  const id=useId().replace(/:/g,'');
  const terrain=board.rows.flatMap((row,y)=>[...row].flatMap((ch,x)=>
    ch==='#'?[[x,y] as ScreenshotPoint]:[]));
  const boxes=displayGrayPositions(board.number,board.grayObjects,grayPositions);
  const head=body[0],neck=body[1];
  const dx=head&&neck?Math.sign(head[0]-neck[0]):1;
  const facingLeft=dx<0;
  return <g className="worm3-classic-objects">
    <defs>
      <linearGradient id={id+'dirt'} x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#86502f"/><stop offset=".22" stopColor="#784426"/>
        <stop offset="1" stopColor="#5d3622"/>
      </linearGradient>
      <linearGradient id={id+'worm'} x1="0" y1="0" x2="1" y2=".9">
        <stop stopColor="#38c716"/><stop offset=".6" stopColor="#0ca10a"/>
        <stop offset="1" stopColor="#07830a"/>
      </linearGradient>
      <radialGradient id={id+'apple'} cx=".27" cy=".22" r=".9">
        <stop stopColor="#ff9d65"/><stop offset=".45" stopColor="#ed3830"/>
        <stop offset="1" stopColor="#a91d27"/>
      </radialGradient>
    </defs>
    <g data-source-terrain="classic-solid-dirt"
      data-terrain-cell-count={terrain.length}>
      {terrain.map(([x,y],i)=><rect key={i}
        x={x*CELL} y={y*CELL} width={CELL} height={CELL}
        fill={'url(#'+id+'dirt)'}/>)}
      {outline(terrain,'#3d291e',3.5)}
      {terrain.map(([x,y],i)=>{
        if(terrain.some(([a,b])=>a===x&&b===y-1))return null;
        return <path key={'top'+i} d={'M'+(x*CELL+2)+' '+(y*CELL+3)+'h26'}
          stroke="#b77a48" strokeWidth="2.8" opacity=".75"/>;
      })}
    </g>
    {boxes.map(([x,y],i)=><g key={'gray'+i} data-source-gray-object>
      <rect x={x*CELL+1} y={y*CELL+1} width={CELL-2} height={CELL-2}
        rx="3" fill="#a0a5a6" stroke="#505c67" strokeWidth="2"/>
      <path d={'M'+(x*CELL+6)+' '+(y*CELL+6)+'h15'}
        stroke="#e9edef" strokeWidth="2"/>
    </g>)}
    {board.portal&&(()=>{
      const [x,y]=board.portal;
      return <g data-source-portal transform={'translate('+((x+.5)*CELL)+' '+((y+.5)*CELL)+')'}>
        <circle r="14" fill="#2a2531" stroke="#574a5c" strokeWidth="3"/>
        <path d="M-11 -2C-10 -15 11 -17 12 -2C12 13 -8 14 -7 0C-6 -10 5 -10 5 -1C5 6 -2 5 -1 -1"
          fill="none" stroke="#100e17" strokeWidth="3.3" strokeLinecap="round"/>
      </g>;
    })()}
    {remaining.map(([x,y],i)=><g key={'a'+i} data-source-apple
      transform={'translate('+((x+.5)*CELL)+' '+((y+.5)*CELL)+')'}>
      <circle cy="1" r="12" fill={'url(#'+id+'apple)'} stroke="#9d1b28" strokeWidth="1.8"/>
      <path d="M0 -9q1 -9 6 -10M1 -14q6 -7 11 -2"
        stroke="#46762e" fill="none" strokeWidth="2.3" strokeLinecap="round"/>
    </g>)}
    <g data-source-worm data-body-length={body.length}
      data-head-x={head?(head[0]+.5)*CELL:undefined}
      data-head-y={head?(head[1]+.5)*CELL:undefined}>
      {body.map(([x,y],i)=><g key={'seg'+i}>
        <rect x={x*CELL+.2} y={y*CELL+.2} width={CELL-.4} height={CELL-.4}
          rx="4.5" fill={'url(#'+id+'worm)'}/>
        {i>0&&<path d={'M'+(x*CELL+4)+' '+(y*CELL+5)+'h16'}
          stroke="#99ec57" strokeWidth="3" opacity=".15"/>}
      </g>)}
      {outline(body,'#056b0b',3.7)}
      {head&&<g transform={'translate('+(head[0]*CELL)+' '+(head[1]*CELL)+')'}>
        <g transform={facingLeft?'translate(30 0) scale(-1 1)':undefined}>
          <ellipse cx="12" cy="12.5" rx="5.7" ry="6.8" fill="#fff"/>
          <ellipse cx="23" cy="12.5" rx="5.5" ry="6.6" fill="#fff"/>
          <circle cx="14" cy="11.5" r="2.6" fill="#282232"/>
          <circle cx="25" cy="11.5" r="2.6" fill="#282232"/>
          <path d="M12 21Q22 18 30 21L29 27Q19 29 12 26Z"
            fill="#871590" stroke="#29202d" strokeWidth="1.5"/>
          <path d="M14 24Q23 22 28 24" fill="none" stroke="#cc49bb" strokeWidth="1.6"/>
        </g>
      </g>}
    </g>
    {biteFx&&(()=>{const [x,y]=biteFx.apple;return <g
      key={'bite'+biteFx.key} data-apple-bite-fx
      transform={'translate('+((x+.5)*CELL)+' '+((y+.5)*CELL)+')'}>
      <circle className="worm-bite-ring" r="9" fill="none"
        stroke="#ffec99" strokeWidth="3"/>
    </g>;})()}
  </g>;
}
