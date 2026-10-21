import { useId } from 'react';

/** Decorative lightweight, original vector art: endless green woodland and airy sky.
 * No user-provided game screenshot is used as an in-app texture.
 */
export function AppleWormForest() {
  const id=useId().replace(/:/g,'');
  return <svg className="worm3-forest" aria-hidden="true" focusable="false"
    viewBox="0 0 1536 716" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id={id+'sky'} x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#5fa8e3"/><stop offset=".55" stopColor="#b2e2f8"/>
        <stop offset="1" stopColor="#e2f6c7"/>
      </linearGradient>
      <radialGradient id={id+'sun'}>
        <stop stopColor="#fffef0" stopOpacity=".64"/>
        <stop offset="1" stopColor="#fffef0" stopOpacity="0"/>
      </radialGradient>
      <linearGradient id={id+'ground'} x1="0" x2="0" y1="0" y2="1">
        <stop stopColor="#94cf92"/><stop offset="1" stopColor="#9bbd9d"/>
      </linearGradient>
      <filter id={id+'soft'} x="-25%" y="-50%" width="150%" height="200%">
        <feGaussianBlur stdDeviation="22"/>
      </filter>
    </defs>
    <rect width="1536" height="716" fill={'url(#'+id+'sky)'}/>
    <circle cx="1076" cy="125" r="274" fill={'url(#'+id+'sun)'}/>
    <g fill="#f3ffff" opacity=".42" filter={'url(#'+id+'soft)'}>
      <ellipse cx="200" cy="180" rx="260" ry="60"/>
      <ellipse cx="840" cy="125" rx="210" ry="55"/>
      <ellipse cx="1350" cy="195" rx="280" ry="80"/>
    </g>
    <path d="M0 450Q70 396 160 443Q236 397 317 458Q395 410 469 458Q555 402 650 457Q731 421 816 455Q912 399 1018 455Q1136 397 1247 461Q1401 404 1536 443V716H0Z"
      fill="#c2e0c0" opacity=".68"/>
    <g opacity=".48">
      {Array.from({length:36},(_,i)=>{
        const x=i*47-34,h=52+(i*37%90),y=504+(i*13%35);
        return <g key={i}>
          <path d={`M${x} ${y}V${y-h*.66}`} stroke="#4a9e96" strokeWidth="4"/>
          <path d={`M${x-h*.34} ${y-13}L${x} ${y-h}L${x+h*.36} ${y-13}Z`}
            fill={i%3===0?'#65a6a2':'#83bcae'}/>
        </g>;
      })}
    </g>
    <path d="M0 543Q250 485 495 544Q717 490 918 539Q1200 483 1536 542V716H0Z"
      fill={'url(#'+id+'ground)'} opacity=".9"/>
    <g opacity=".78">
      {Array.from({length:18},(_,i)=>{
        const x=i*97-16,h=86+(i*29%130),bottom=568+(i*7%32);
        return <g key={i}>
          <path d={`M${x} ${bottom+13}V${bottom-h*.75}`} stroke="#5a9c72" strokeWidth="7"/>
          {i%3===0?
            <g fill="#8ebd83">
              <circle cx={x} cy={bottom-h*.6} r={h*.32}/>
              <circle cx={x-h*.24} cy={bottom-h*.42} r={h*.23}/>
              <circle cx={x+h*.26} cy={bottom-h*.38} r={h*.22}/>
            </g>:
            <path d={`M${x-h*.35} ${bottom-10}L${x-h*.16} ${bottom-h*.48}L${x-h*.29} ${bottom-h*.45}L${x} ${bottom-h}L${x+h*.3} ${bottom-h*.45}L${x+h*.14} ${bottom-h*.48}L${x+h*.36} ${bottom-10}Z`}
              fill={i%2?'#438e83':'#63a692'}/>}
        </g>;
      })}
    </g>
    <path d="M0 615Q315 547 587 616Q839 580 1125 614Q1340 569 1536 615V716H0Z"
      fill="#9bcb95" opacity=".7"/>
    <g fill="#83b97d" opacity=".85">
      {Array.from({length:34},(_,i)=>{
        const x=i*49-30,y=686+(i%4*5),r=43+(i*13%34);
        return <g key={i}>
          <circle cx={x} cy={y} r={r}/>
          <circle cx={x+36} cy={y+5} r={r*.8}/>
        </g>;
      })}
    </g>
    <path d="M0 700Q300 652 609 700Q900 648 1185 704Q1350 665 1536 702V716H0Z"
      fill="#7cb57e" opacity=".65"/>
  </svg>;
}
