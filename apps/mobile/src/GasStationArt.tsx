import {useId, type MouseEvent} from 'react';
import {
 TARGETS,WORLD_W,WORLD_H,newGasStation,type State,type Vehicle,type Facility,type Debris,
} from '../../../packages/games/gas-station/engine.ts';

/** Self-contained original isometric roadside world, all drawn using SVG. */
function Diamond({x,y,w,h,color}:{x:number;y:number;w:number;h:number;color:string}){
 const points=[x+','+(y-h),(x+w)+','+y,x+','+(y+h),(x-w)+','+y].join(' ');
 return <polygon points={points} fill={color} stroke="#b6a387" strokeWidth="3"/>;
}
function Palm({x,y,scale=1}:{x:number;y:number;scale?:number}){
 return <g transform={'translate('+x+' '+y+') scale('+scale+')'}>
  <ellipse cx="4" cy="13" rx="34" ry="12" fill="#92724b" opacity=".2"/>
  <path d="M-3 12Q6 -38 -7 -65" stroke="#a97b4f" strokeWidth="9" strokeLinecap="round" fill="none"/>
  <path d="M-7 -65Q-46 -100 -57 -62Q-31 -83 -7 -65Q30 -98 57 -72Q30 -79 -7 -65Q-42 -41 -39 -24Q-17 -49 -7 -65Q27 -51 41 -25Q32 -52 -7 -65Z"
    fill="#25975d" stroke="#17865a" strokeWidth="3" strokeLinejoin="round"/>
  <path d="M-7 -65Q-5 -92 17 -99Q9 -75 -7 -65Z" fill="#56bd76"/>
 </g>;
}
function Person({x,y,shirt='#df624a',small=false}:{
 x:number;y:number;shirt?:string;small?:boolean;
}){
 return <g transform={'translate('+x+' '+y+') scale('+(small ? .72 : 1)+')'}>
  <ellipse cx="0" cy="5" rx="15" ry="7" fill="#6b584e" opacity=".26"/>
  <path d="M-6 -9l-7 17M6 -9l9 17" stroke="#444855" strokeWidth="7" strokeLinecap="round"/>
  <rect x="-13" y="-38" width="26" height="31" rx="8" fill={shirt}/>
  <path d="M-12 -31l-11 13M12 -31l11 13" stroke="#d79f79" strokeWidth="6" strokeLinecap="round"/>
  <circle cx="0" cy="-50" r="14" fill="#d09a72" stroke="#b87e56" strokeWidth="2"/>
  <path d="M-14 -53Q-14 -69 4 -68Q18 -68 14 -51Z" fill="#8b4b31"/>
  <circle cx="-5" cy="-49" r="1.8" fill="#4a3837"/><circle cx="6" cy="-49" r="1.8" fill="#4a3837"/>
 </g>;
}
function GasCar({car,active}:{car:Vehicle;active:boolean}){
 const {x,y,color,type}=car,wide=type==='truck'||type==='van';
 return <g transform={'translate('+x+' '+y+')'} aria-hidden="true">
  <ellipse rx={wide?61:48} ry="25" cy="9" fill="#635e58" opacity=".25"/>
  <g transform="rotate(-22)">
   <rect x={wide?-53:-45} y="-26" width={wide?106:91} height="48" rx={wide?8:16}
     fill={color} stroke="#514c56" strokeWidth="3"/>
   <path d={wide?'M-25 -20h34l15 19h-65Z':'M-17 -20h36l15 19h-64Z'}
     fill="#9fd0dc" stroke="#547b89" strokeWidth="2"/>
   <path d="M-15 6h34" stroke="#d9e7d6" strokeWidth="4" strokeLinecap="round"/>
   <rect x={wide?-49:-42} y="16" width="18" height="6" rx="2" fill="#f7d882"/>
   <rect x={wide?30:24} y="16" width="18" height="6" rx="2" fill="#ffdd86"/>
   <rect x={wide?-58:-49} y="-12" width="8" height="21" rx="4" fill="#39424d"/>
   <rect x={wide?50:43} y="-12" width="8" height="21" rx="4" fill="#39424d"/>
   {type==='sport'&&<path d="M-29 17h64" stroke="#fafafa" strokeWidth="5"/>}
  </g>
  {active&&<g transform="translate(0 -70)">
    <rect x="-43" y="-26" width="86" height="31" rx="15" fill="#fffefa"
      stroke={car.event?'#ffce58':'#7cc8bd'} strokeWidth="3"/>
    <text textAnchor="middle" x="0" y="-5" fontSize="17" fontWeight="900"
      fill="#4a796f">{car.facility==='pump'?'⛽':car.facility==='shop'?'🛒':
      car.facility==='garage'?'🔧':car.facility==='wash'?'💧':'◉'}
      {' '+Math.round(car.reward)}</text>
    {car.status==='servicing'&&<g>
      <rect x="-36" y="8" width="72" height="8" rx="4" fill="#557f7c"/>
      <rect x="-34" y="10" width={68*car.progress/Math.max(1,car.needs)} height="4" rx="2" fill="#94eb9b"/>
    </g>}
  </g>}
 </g>;
}
function Pump({x,y}:{x:number;y:number}){
 return <g transform={'translate('+x+' '+y+')'}>
  <ellipse cy="12" rx="43" ry="19" fill="#e5d0aa" stroke="#be9e79" strokeWidth="3"/>
  <path d="M-27 -62L3 -72L30 -58L-2 -47Z" fill="#68a8c6" stroke="#547382" strokeWidth="3"/>
  <path d="M-27 -62v61l25 13v-59Z" fill="#527a9d"/>
  <path d="M-2 -47L30 -58V-2L-2 12Z" fill="#44718f"/>
  <path d="M-21 -44L-3 -34V-17L-21 -25Z" fill="#e2f6db"/>
  <path d="M14 -30q35 10 17 29l-12 1" stroke="#333c3d" strokeWidth="5" fill="none"/>
  <rect x="3" y="-36" width="8" height="21" rx="2" fill="#273d42"/>
  <path d="M-25 -7l23 11" stroke="#f9d87f" strokeWidth="5"/>
 </g>;
}
function Building({x,y,w,h,title,color='#d9755d',locked=false}:{
 x:number;y:number;w:number;h:number;title:string;color?:string;locked?:boolean;
}){
 const roof='M'+(-w/2)+','+(-h/2+30)+'L0,'+(-h/2-4)+'L'+(w/2)+','+(-h/2+30)+'L0,'+(-h/2+61)+'Z';
 const side='M'+(-w/2)+','+(-h/2+30)+'L0,'+(-h/2-4)+'L'+(w/2)+','+(-h/2+30)
  +'V'+(h/2)+'L0,'+(h/2+33)+'L'+(-w/2)+','+(h/2)+'Z';
 return <g transform={'translate('+x+' '+y+')'} opacity={locked?.64:1}>
  <ellipse cx="0" cy="10" rx={w*.67} ry={h*.35} fill="#aa886c" opacity=".3"/>
  <path d={side} fill={locked?'#92979a':'#dae4df'} stroke="#8b9e99" strokeWidth="4"/>
  <path d={roof} fill={color} stroke="#976d65" strokeWidth="4"/>
  <path d={'M'+(-w/2+12)+','+(h/2-48)+'L0,'+(h/2-14)+'L'+(w/2-12)+','+(h/2-48)
   +'V'+(h/2-8)+'L0,'+(h/2+20)+'L'+(-w/2+12)+','+(h/2-8)+'Z'}
   fill={locked?'#87979a':'#80b4bb'} stroke="#508291" strokeWidth="3"/>
  <rect x={-title.length*3.7-8} y={-h/2+3} width={title.length*7.4+16} height="28" rx="6"
    fill="#fff4d8" stroke="#b68a63" strokeWidth="3"/>
  <text textAnchor="middle" y={-h/2+22} fontSize="14" fontWeight="900" fill="#4c7072">{title}</text>
  {locked&&<text textAnchor="middle" y="5" fontSize="32">🔒</text>}
 </g>;
}
function Scrap({item}:{item:Debris}){
 return <g transform={'translate('+item.x+' '+item.y+')'}>
  <ellipse rx="21" ry="12" fill="#946845" opacity=".3"/>
  <path d="M-17 0L-14 -21L-1 -17L12 -27L22 -4L6 9Z" fill="#717c79" stroke="#52636a" strokeWidth="3"/>
  <path d="M-14 -13l31 11M1 -19l4 20" stroke="#b9b7a3" strokeWidth="4"/>
  <circle cx="11" cy="-12" r="6" fill="#c17c52"/>
 </g>;
}
const banners:{key:Facility;title:string;color:string}[]=[
 {key:'shop',title:'MARKET',color:'#e6ac5d'},
 {key:'garage',title:'GARAGE',color:'#e68b64'},
 {key:'wash',title:'CAR WASH',color:'#5baad0'},
 {key:'tires',title:'TIRES',color:'#cbb27a'},
];
export function GasStationWorld({state,preview=false,onWalk,onService,onJunk,onFacility}:{
 state:State;preview?:boolean;onWalk?:(x:number,y:number)=>void;
 onService?:(id:number)=>void;onJunk?:(id:number)=>void;onFacility?:(key:Facility)=>void;
}){
 const id=useId().replace(/:/g,'')+'-road';
 const cars=preview?[
 {id:903,type:'sedan',facility:'pump',bay:0,status:'waiting',x:301,y:353,color:'#6abb6b',
 patience:33,amount:0,progress:0,needs:27,reward:120,event:false,condition:1},
 {id:904,type:'sport',facility:'pump',bay:1,status:'waiting',x:412,y:356,color:'#d077a8',
 patience:29,amount:0,progress:0,needs:22,reward:150,event:false,condition:1}
 ] as Vehicle[]:state.cars;
 const scene=preview?{...state,facilities:{pump:2,shop:1,garage:1,wash:0,tires:0},
 debris:state.debris.slice(0,10)}:state;
 const clickGround=(e:MouseEvent<SVGSVGElement>)=>{
  if(!onWalk||preview)return;
  const target=e.target as Element;
  if(target.closest?.('.gas-interactable'))return;
  const rect=e.currentTarget.getBoundingClientRect();
  onWalk((e.clientX-rect.left)/Math.max(1,rect.width)*WORLD_W,
    (e.clientY-rect.top)/Math.max(1,rect.height)*WORLD_H);
 };
 return <svg viewBox={'0 0 '+WORLD_W+' '+WORLD_H} className="gas-station-scene"
   preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"
   role="img" aria-label="Isometric roadside gas station with cars, pumps, workshops, shops and a walking character"
   onClick={clickGround}>
   <defs>
    <linearGradient id={id+'sand'} x1=".3" y1="0" x2=".8" y2="1">
     <stop stopColor="#f6d8aa"/><stop offset="1" stopColor="#eabb83"/>
    </linearGradient>
    <linearGradient id={id+'road'} x2=".8" y2=".8">
     <stop stopColor="#8d9290"/><stop offset="1" stopColor="#606f76"/>
    </linearGradient>
   </defs>
   <rect width="960" height="640" fill={'url(#'+id+'sand)'}/>
   <path d="M0 291L362 95L960 375V483L637 639L0 399Z"
     fill={'url(#'+id+'road)'} stroke="#e8d9b4" strokeWidth="9"/>
   <path d="M0 331L360 143L960 415" fill="none" stroke="#d5d3bd" strokeWidth="3"
    strokeDasharray="22 15" opacity=".7"/>
   <path d="M0 435L362 244L960 507" fill="none" stroke="#ffe4b7" strokeWidth="4" opacity=".62"/>
   <Palm x={67} y={130} scale={.75}/><Palm x={904} y={112} scale={.75}/>
   <Palm x={93} y={561} scale={.62}/><Palm x={903} y={559} scale={.68}/>
   <Diamond x={651} y={222} w={149} h={80} color="#c7dfc4"/>
   <Diamond x={813} y={391} w={119} h={72} color="#b5cfc8"/>
   <Diamond x={740} y={535} w={127} h={62} color="#badbe4"/>
   <Diamond x={578} y={518} w={89} h={48} color="#f0cc94"/>
   <Building x={652} y={181} w={171} h={135} title="MINI MART"
     color="#edb566" locked={!scene.facilities.shop}/>
   <Building x={820} y={350} w={162} h={144} title="GARAGE"
     color="#e89173" locked={!scene.facilities.garage}/>
   <Building x={744} y={512} w={153} h={120} title="WASH"
     color="#73c5db" locked={!scene.facilities.wash}/>
   <Building x={563} y={494} w={101} h={83} title="TIRES"
     color="#ddbf83" locked={!scene.facilities.tires}/>
   <path d="M204 281L358 198L500 280L347 360Z" fill="#86654b" opacity=".25"
    transform="translate(6 16)"/>
   <path d="M204 255L359 175L508 252L350 336Z" fill="#f7dfaf"
     stroke="#c89869" strokeWidth="7"/>
   <path d="M211 254L356 182L501 253L351 327Z" fill="#ed7466" stroke="#fff3cc" strokeWidth="6"/>
   <path d="M211 255L351 327L351 338L211 267ZM351 327L501 253L501 265L351 338Z" fill="#d7ae69"/>
   <path d="M249 277v73M462 277v73" stroke="#e7e9d9" strokeWidth="11"/>
   <path d="M249 280v67M462 283v67" stroke="#788b8e" strokeWidth="3"/>
   {Array.from({length:scene.facilities.pump},(_,i)=>
     <g key={i} className={!preview?'gas-interactable':''}
      role={!preview?'button':undefined} tabIndex={!preview?0:undefined}
      aria-label={'Fuel station '+(i+1)}
      onClick={e=>{e.stopPropagation();onFacility?.('pump');}}
      onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onFacility?.('pump');}}}>
      <Pump x={275+i*112} y={335}/>
     </g>
   )}
   {scene.debris.filter(x=>!x.cleared).map(item=>
     <g key={item.id} className={!preview?'gas-interactable':''}
      role={!preview?'button':undefined} tabIndex={!preview?0:undefined}
      aria-label={'Clear junk '+item.id}
      onClick={e=>{e.stopPropagation();onJunk?.(item.id);}}
      onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onJunk?.(item.id);}}}>
      <Scrap item={item}/>
     </g>)}
   {cars.map(car=><g key={car.id}
     className={!preview?'gas-interactable':''}
     role={!preview?'button':undefined} tabIndex={!preview?0:undefined}
     aria-label={'Serve '+car.type+' '+car.facility}
     onClick={e=>{e.stopPropagation();onService?.(car.id);}}
     onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onService?.(car.id);}}}>
     <GasCar car={car} active={car.status!=='done'}/>
    </g>)}
   {!preview&&banners.filter(item=>scene.facilities[item.key]>0).map(item=>{
    const loc=TARGETS[item.key];
    return <g key={item.key} className="gas-interactable" role="button"
      tabIndex={0} aria-label={'Walk to '+item.title}
      onClick={e=>{e.stopPropagation();onFacility?.(item.key);}}
      onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onFacility?.(item.key);}}}>
      <ellipse cx={loc.x} cy={loc.y+20} rx="28" ry="14"
       fill={item.color} opacity=".65" stroke="#fff3bc" strokeWidth="3"/>
      <text x={loc.x} y={loc.y+24} fontWeight="900" fontSize="17" textAnchor="middle" fill="#335360">↗</text>
    </g>;
   })}
   <Person x={preview?465:state.player.x} y={preview?343:state.player.y} shirt="#eb8057"/>
   {!preview&&state.player.tx!==null&&state.player.ty!==null&&
    <g opacity=".85" transform={'translate('+state.player.tx+' '+state.player.ty+')'}>
     <circle r="12" fill="none" stroke="#fff5ba" strokeWidth="4"/>
     <circle r="4" fill="#fff5ba"/>
    </g>}
   {preview&&<g>
    <rect x="307" y="46" width="349" height="79" rx="25"
      fill="#fcf7dd" stroke="#c6825b" strokeWidth="8"/>
    <text x="481" y="98" textAnchor="middle" fontWeight="900" fontSize="43"
      fill="#d2734e">GAS STATION</text>
   </g>}
 </svg>;
}
export function GasStationCover(){return <GasStationWorld state={newGasStation()} preview/>;}
