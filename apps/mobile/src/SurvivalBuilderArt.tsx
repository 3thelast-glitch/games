import { useId } from 'react';
import {
  blueprintFor, newIsland, type IslandState, type Material, type Worker,
} from '../../../packages/games/survival-builder/engine.ts';

/** Original scalable isometric illustration. No images from the referenced game. */
const groundFill='#8cc464',water='#16bed0',sand='#f3d88c';
const SITE:{key:Exclude<Material,'brick'>;x:number;y:number;icon:string}[]=[
  {key:'bamboo',x:102,y:176,icon:'BAMBOO'},
  {key:'wood',x:468,y:190,icon:'WOOD'},
  {key:'clay',x:102,y:365,icon:'CLAY'},
  {key:'stone',x:502,y:365,icon:'STONE'},
];
const diamond=(x:number,y:number,rx:number,ry:number)=>
  [x+','+(y-ry),(x+rx)+','+y,x+','+(y+ry),(x-rx)+','+y].join(' ');
function Palm({x,y,scale=1}:{x:number;y:number;scale?:number}){
  return <g transform={'translate('+x+' '+y+') scale('+scale+')'} aria-hidden="true">
    <ellipse cx="2" cy="18" rx="36" ry="15" fill="#287858" opacity=".2"/>
    <path d="M0 13Q6 -30 -8 -71" stroke="#af713c" strokeWidth="11" strokeLinecap="round" fill="none"/>
    <path d="M-8 -71Q-59 -103 -66 -57Q-34 -81 -8 -69Q28 -116 61 -75Q34 -85 -8 -69Q-47 -51 -44 -16Q-18 -53 -8 -69Q36 -54 53 -21Q37 -64 -8 -69Z"
      fill="#177e50" stroke="#0c6841" strokeWidth="4" strokeLinejoin="round"/>
    <path d="M-8 -70Q-3 -112 9 -122Q3 -89 -8 -70Q-44 -80 -64 -83Q-35 -89 -8 -70Z"
      fill="#2ab95f"/>
    <path d="M-8 -70Q26 -92 66 -72Q37 -84 -8 -70Q-30 -37 -30 4Q-10 -45 -8 -70Z"
      fill="#39b65e" opacity=".95"/>
    <circle cx="-8" cy="-65" r="5.5" fill="#99633d"/>
  </g>;
}
function WorkerFigure({x,y,shirt='#3899b3',phase=0,small=false}:{
  x:number;y:number;shirt?:string;phase?:number;small?:boolean;
}){
  return <g transform={'translate('+x+' '+y+') scale('+(small ? 0.74 : 1)+')'} aria-hidden="true">
    <ellipse cx="0" cy="9" rx="15" ry="8" fill="#1f644d" opacity=".24"/>
    <path d="M-5 3L-10 14M5 3L9 14" stroke="#4b505e" strokeWidth="6" strokeLinecap="round"/>
    <path d="M-8 -22L-13 -7M8 -22L13 -8" stroke="#bc8558" strokeWidth="5" strokeLinecap="round"/>
    <path d="M-9 -22L9 -22L8 4L-8 4Z" fill={shirt} stroke="#226272" strokeWidth="2"/>
    <circle cx="0" cy="-30" r="10" fill="#c78f60"/>
    <path d="M-10 -30Q-9 -45 3 -41Q11 -40 10 -29Q5 -35 -10 -30Z" fill="#433027"/>
    <path d="M-7 -44h14l4 7H-11Z" fill="#e5c45c"/>
    <path d="M-7 -41h17" stroke="#fff5b0" strokeWidth="1.8"/>
    <path d="M-2 -26h2M5 -26h2" stroke="#533829" strokeWidth="1.7" strokeLinecap="round"/>
    {phase>.1&&<circle cx="14" cy="-11" r="3.5" fill="#eee7c5"/>}
  </g>;
}
function PalmCluster(){
  return <g>
    <Palm x={65} y={325} scale={.88}/>
    <Palm x={566} y={264} scale={.73}/>
    <Palm x={532} y={107} scale={.58}/>
    <g fill="#258e47">{[[187,81],[200,91],[215,78],[234,92],[249,84],[265,99],[281,84]].map(([x,y],i)=>
      <path key={i} d={'M'+x+' '+y+'q-10 -18 -21 -10q19 0 22 14q13 -25 26 -14q-22 0 -23 18Z'}/>)}</g>
  </g>;
}
function Site({type,x,y}:{type:Exclude<Material,'brick'>;x:number;y:number}){
  const tx=x,ty=y;
  if(type==='bamboo')return <g transform={'translate('+tx+' '+ty+')'}>
    <ellipse rx="60" ry="30" fill="#4a9b46" opacity=".42"/>
    {[-35,-16,5,24,42].map((dx,i)=><g key={i}>
      <path d={'M'+dx+' 9v-'+(37+i%3*14)} stroke="#3e9b55" strokeWidth="9" strokeLinecap="round"/>
      <path d={'M'+dx+' -'+(14+i%3*14)+'h'+5} stroke="#a4db6b" strokeWidth="3"/>
      <path d={'M'+dx+' -'+(29+i%3*14)+'h'+5} stroke="#a4db6b" strokeWidth="3"/>
    </g>)}
    <path d="M-46 16l29 -7 12 9 -28 9Z" fill="#d1ad64" />
    <path d="M-46 16v12l13 8V27Z" fill="#9b6c35"/>
  </g>;
  if(type==='wood')return <g transform={'translate('+tx+' '+ty+')'}>
    <ellipse rx="53" ry="24" fill="#2e8c4b" opacity=".25"/>
    {[-21,-3,18].map((dx,i)=><g key={i}>
      <path d={'M'+dx+' 3l-10 -'+(27+i*5)} stroke="#a96b37" strokeWidth="9" strokeLinecap="round"/>
      <circle cx={dx-10} cy={-27-i*5} r={24+i*3} fill={i===1?'#23884d':'#2eaa55'}/>
      <circle cx={dx-18} cy={-33-i*5} r="15" fill="#58c36b" opacity=".8"/>
    </g>)}
    <g transform="translate(0 23)"><path d="M-33 0l40 -17 29 7 -40 18Z" fill="#b57a46"/>
      <path d="M-33 0v9l30 10V8Z" fill="#895124"/>
      <path d="M-3 8l39 -18v11l-39 18Z" fill="#ba874e"/></g>
  </g>;
  if(type==='clay')return <g transform={'translate('+tx+' '+ty+')'}>
    <ellipse rx="54" ry="31" fill="#b6754c"/>
    <path d="M-43 -7q19 -21 48 -14q28 4 38 20q-9 22 -39 23q-40 4 -47 -29Z" fill="#ce9660"/>
    {[[-20,-3],[12,8],[0,-15],[29,-7],[-32,6]].map(([dx,dy],i)=>
      <ellipse key={i} cx={dx} cy={dy} rx={i%2?10:7} ry="5" fill="#9e633c" opacity=".7"/>)}
    <path d="M-18 -23l-8 -13M19 -19l13 -11" stroke="#e3c27a" strokeWidth="4"/>
  </g>;
  return <g transform={'translate('+tx+' '+ty+')'}>
    <ellipse rx="58" ry="26" fill="#458754" opacity=".3"/>
    {[[-21,2,24],[15,-15,32],[28,13,22]].map(([dx,dy,size],i)=><g key={i}>
      <path d={'M'+(dx-size/2)+' '+(dy+5)+'l'+(size*.2)+' -'+(size*.8)+'l'+(size*.83)+' -'+(size*.2)+'l'+(size*.3)+' '+(size*.7)+'l-'+(size*.25)+' '+(size*.85)+'Z'} fill="#7b8790"/>
      <path d={'M'+(dx-size/2)+' '+(dy+5)+'l'+(size*.2)+' -'+(size*.8)+'l'+(size*.83)+' -'+(size*.2)+'l-'+(size*.35)+' '+(size*.8)+'Z'} fill="#b7bfc0"/>
    </g>)}
  </g>;
}
function Construction({progress,feature}:{progress:number;feature:string}){
  const p=Math.max(0,Math.min(100,progress));
  const completed=p>=99.9;
  const pool=feature==='pool';
  return <g aria-hidden="true">
    <ellipse cx="320" cy="295" rx="141" ry="71" fill="#164f3d" opacity=".17"/>
    <polygon points={diamond(315,276,132,62)} fill="#c0a171" stroke="#936a42" strokeWidth="3"/>
    <polygon points={diamond(315,267,123,56)} fill="#f4dba1" stroke="#e8c183" strokeWidth="4"/>
    {pool? <g>
      <polygon points={diamond(315,267,107,48)} fill="#f7f4de" stroke="#a7beb8" strokeWidth="6"/>
      <polygon points={diamond(315,267,91,38)} fill="#3fbecb" stroke="#2c9ea9" strokeWidth="4"/>
      <path d="M268 266q27 -12 53 0t52 0" stroke="#bdf0e7" strokeWidth="4" fill="none" opacity=".7"/>
    </g>:<g>
      <polygon points="238,239 318,198 396,238 316,278" fill="#d3ad68"/>
      <polygon points="238,239 316,278 316,328 238,284" fill={completed?'#edc88b':'#bb8e53'}/>
      <polygon points="316,278 396,238 396,283 316,328" fill={completed?'#e8b970':'#a77a4d'}/>
      {p>16&&<g stroke="#815829" strokeWidth="9" strokeLinecap="round" opacity={completed?1:.93}>
        <path d="M241 237v-73M316 201v-79M394 238v-73M317 277v-75"/>
      </g>}
      {p>48&&<g>
        <polygon points="239,171 316,130 394,171 316,211" fill="#f0de9b"/>
        <polygon points="239,171 316,211 316,270 239,231" fill="#cda974"/>
        <polygon points="316,211 394,171 394,232 316,270" fill="#e6c38e"/>
        <path d="M265 186l26 14v27l-26 -12ZM341 192l28 -15v30l-28 15Z" fill="#83b2a8" stroke="#855e37" strokeWidth="5"/>
      </g>}
      {p>74&&<g>
        <polygon points="226,165 316,103 408,165 316,220" fill={feature==='tower'?'#cd793e':'#bf8145'}/>
        <polygon points="226,165 316,220 316,229 226,175" fill="#89502c"/>
        <polygon points="316,220 408,165 408,177 316,229" fill="#a26031"/>
        {[0,1,2,3].map(i=><path key={i} d={'M'+(240+i*25)+' '+(158-i*16)+'l78 51'}
          stroke="#eab87b" strokeWidth="3" opacity=".4"/>)}
      </g>}
    </g>}
    {completed&&<g fill="#ffdf75">
      <path d="M208 191l4 -12 4 12 13 4 -13 4 -4 12 -4 -12 -13 -4Z"/>
      <path d="M425 137l3 -9 3 9 9 3 -9 3 -3 9 -3 -9 -9 -3Z"/>
    </g>}
    {p>0&&!completed&&<g>
      <rect x="267" y="350" width="102" height="13" rx="7" fill="#335f4d" opacity=".75"/>
      <rect x="271" y="353" width={94*p/100} height="7" rx="3" fill="#e4d060"/>
    </g>}
  </g>;
}
const workerPos=(worker:Worker,i:number)=>{
  const spots:Record<string,[number,number]>={
    bamboo:[122,230],wood:[483,259],clay:[128,420],
    stone:[492,413],brick:[217,427],builder:[399,339],
  };
  const [x,y]=spots[worker.job]??[313,320];
  return {x:x+(i%3)*15-15,y:y+Math.floor(i/3)*19-12};
};
export function SurvivalIslandScene({state,preview=false,onCollect}:{state:IslandState;preview?:boolean;
  onCollect?:(type:Exclude<Material,'brick'>)=>void}){
  const id=useId().replace(/:/g,'')+'-island';
  const progress=state.phase==='completed'?100:state.phase==='building'?state.buildProgress:0;
  const interact=(key:Exclude<Material,'brick'>)=>!preview&&onCollect?.(key);
  return <svg viewBox="0 0 640 510" className="survival-island-scene"
      preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"
      role="img" aria-label="Isometric tropical island, gathering sites and construction">
    <defs>
      <linearGradient id={id+'sea'} x1="0" x2=".8" y1="0" y2="1">
        <stop stopColor="#39d7df"/><stop offset="1" stopColor="#078aa5"/>
      </linearGradient>
      <linearGradient id={id+'land'} x1="0" x2=".15" y1="0" y2="1">
        <stop stopColor="#c5ed79"/><stop offset=".8" stopColor="#84bc60"/>
        <stop offset="1" stopColor="#4f9750"/>
      </linearGradient>
      <radialGradient id={id+'sun'}>
        <stop stopColor="#fffcc8"/><stop offset="1" stopColor="#fffdcf" stopOpacity="0"/>
      </radialGradient>
    </defs>
    <rect width="640" height="510" fill={'url(#'+id+'sea)'}/>
    <circle cx="110" cy="33" r="240" fill={'url(#'+id+'sun)'} opacity=".25"/>
    <g stroke="#a4ebec" fill="none" strokeWidth="2" opacity=".42">
      {Array.from({length:17},(_,i)=><path key={i}
        d={'M'+(-40+i*48)+' '+(30+i%4*104)+'q17 -8 37 0t42 0'} />)}
    </g>
    <path d="M44 118L208 52L526 77L625 186L612 403L476 471L192 465L42 374L16 242Z"
      fill="#249ba3" opacity=".3" transform="translate(0 17)"/>
    <path d="M44 111L208 50L529 74L625 183L612 398L480 463L192 460L42 369L16 237Z"
      fill={sand} stroke="#d5f9d5" strokeWidth="11" strokeLinejoin="round"/>
    <path d="M87 155L231 86L502 104L580 192L558 358L459 425L215 418L95 346L65 233Z"
      fill="#bc9867" opacity=".75" transform="translate(0 12)"/>
    <path d="M87 148L231 79L502 97L580 185L558 351L459 418L215 411L95 339L65 226Z"
      fill={'url(#'+id+'land)'} stroke="#c5d881" strokeWidth="3"/>
    <g fill="#8fd16a" opacity=".65">
      {[[174,172],[399,118],[295,386],[80,280],[445,398],[539,303],[336,89]].map(([x,y],i)=>
        <ellipse key={i} cx={x} cy={y} rx={29+i%3*7} ry={14+i%2*5}/>)}
    </g>
    <PalmCluster/>
    <g role={onCollect?'group':undefined}>
      {SITE.map(site=><g key={site.key}
        className={!preview?'survival-harvest-site':''}
        onClick={()=>interact(site.key)}
        tabIndex={!preview?0:undefined}
        role={!preview?'button':undefined}
        aria-label={!preview?'Collect '+site.key:undefined}
        onKeyDown={!preview?(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();interact(site.key);}}:undefined}>
        <Site x={site.x} y={site.y} type={site.key}/>
        {!preview&&<g transform={'translate('+site.x+' '+(site.y-68)+')'}>
          <rect x="-30" y="-14" width="60" height="23" rx="11" fill="#ffffffec"
            stroke="#9fb7ac" strokeWidth="2"/>
          <text textAnchor="middle" y="2" fontWeight="900" fontSize="11" fill="#37644d">{site.icon}</text>
        </g>}
      </g>)}
    </g>
    <Construction progress={progress} feature={blueprintFor(state.island).feature}/>
    {state.workers.slice(0,10).map((worker,i)=>{
      const p=workerPos(worker,i);
      return <WorkerFigure key={worker.id} x={p.x} y={p.y}
        phase={worker.phase} small={true}
        shirt={['#46a5c4','#e6a84e','#a477cb','#5cbe98'][i%4]}/>;
    })}
    {preview&&<g>
      <path d="M45 113l100 -50 175 -8" fill="none" stroke="#fff4a7" strokeWidth="9" opacity=".4"/>
      <g transform="translate(288 451)">
        <rect x="-112" y="-26" width="224" height="53" rx="18" fill="#236c53" stroke="#f4cf76" strokeWidth="7"/>
        <text textAnchor="middle" y="9" fill="#fff3b3" fontSize="29" fontWeight="900">BUILD & SURVIVE</text>
      </g>
    </g>}
  </svg>;
}
export function SurvivalBuilderCover(){return <SurvivalIslandScene state={newIsland()} preview/>;}
