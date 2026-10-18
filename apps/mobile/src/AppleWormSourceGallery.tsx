import { useMemo, useState, type CSSProperties } from 'react';
import { AppleWormVideoPlaytest } from './AppleWormVideoPlaytest.tsx';
import {
  APPLE_WORM_VISUAL_SNAPSHOT_COUNT,
  appleWormVisualSnapshot,
  type AppleWormVisualSnapshot,
} from '../../../packages/games/apple-worm/video-visual-snapshots-105.ts';

type Props = { lang:'ar'|'en'; onClose:()=>void };

/**
 * Reference-only 105 screenshot stage gallery. This is NOT a playable puzzle,
 * and it must never quietly fall back to the 40 independently authored maps.
 * Individual stills can show mid-solution positions and missed objects.
 */
export function AppleWormSourceGallery({lang,onClose}:Props) {
  const [level,setLevel]=useState(1);
  const [playtestOpen,setPlaytestOpen]=useState(false);
  const chooseLevel=(number:number)=>{setLevel(number);setPlaytestOpen(false);};
  const ar=lang==='ar';
  const item=useMemo(()=>appleWormVisualSnapshot(level),[level]);
  const first=Math.floor((level-1)/15)*15+1;
  const last=Math.min(first+14,APPLE_WORM_VISUAL_SNAPSHOT_COUNT);
  const label=(english:string,arabic:string)=>ar?arabic:english;

  return <div className="worm-video-gallery" role="dialog" aria-modal="true"
      aria-label={label('Original video reference stages','مراجع مراحل الفيديو الأصلية')}
      dir={ar?'rtl':'ltr'} style={{
        position:'absolute',inset:0,zIndex:15,display:'flex',flexDirection:'column',
        alignItems:'center',gap:10,overflowY:'auto',padding:'clamp(10px, 2vw, 22px)',
        background:'linear-gradient(180deg,rgba(8,27,40,.97),rgba(14,39,54,.98))',
        color:'#fff',boxSizing:'border-box',
      }}>
    <div style={{width:'min(100%,930px)',display:'flex',justifyContent:'space-between',
        alignItems:'center',gap:12,flexWrap:'wrap'}}>
      <div>
        <h2 style={{margin:0,fontSize:'clamp(16px,2.1vw,24px)'}}>
          {label('105 stages from the original video','105 مراحل من الفيديو الأصلي')}
        </h2>
        <p style={{margin:'4px 0',fontSize:13,color:'#d2e9ec'}}>
          {label('Reference snapshots • not playable or fully verified',
            'صور مرجعية • ليست قابلة للعب أو معتمدة نهائيًا بعد')}
        </p>
      </div>
      <button type="button" onClick={onClose} style={{border:'1px solid #8fb3bf',
        background:'#204457',color:'white',borderRadius:10,padding:'9px 14px',fontSize:15}}>
        {label('Close ×','إغلاق ×')}
      </button>
    </div>
    <div style={{width:'min(100%,930px)',background:'#96dff2',borderRadius:14,
      border:'3px solid #426574',overflow:'hidden',flexShrink:0}}>
      <SourceSnapshotBoard stage={item}/>
    </div>
    {level<=10 && <div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap'}}>
      <button type="button" onClick={()=>setPlaytestOpen(open=>!open)} style={buttonStyle}
        aria-expanded={playtestOpen}>
        {label(playtestOpen?'Hide experimental playtest':'Try this video-traced map (experimental)',
          playtestOpen?'إخفاء التجربة':'تجربة الخريطة المأخوذة من الفيديو (تجريبي)')}
      </button>
    </div>}
    {level<=10 && playtestOpen && <AppleWormVideoPlaytest key={level} level={level} lang={lang}/>}
    <div role="status" style={{maxWidth:930,width:'100%',fontSize:13,color:'#e3f0f0',
      display:'flex',flexWrap:'wrap',gap:'8px 20px',alignItems:'center'}}>
      <strong>{label('Stage','المرحلة')} {level}/{APPLE_WORM_VISUAL_SNAPSHOT_COUNT}</strong>
      <span>{label('Visible apples','التفاح الظاهر')}: {item.applesVisible.length}</span>
      <span>{label('Visible worm sections','أجزاء الدودة الظاهرة')}: {item.wormVisible.length}</span>
      <span>{label('Unknown gray objects','العوائق الرمادية غير المحددة')}: {item.grayObjectsVisible.length}</span>
      <span>{label('Portal candidate','مخرج محتمل')}: {item.probablePortal?'✓':'?'}</span>
    </div>
    <p style={{width:'min(100%,930px)',margin:'0',fontSize:12,lineHeight:1.5,
      color:'#f9d7a1'}}>
      {label(
        'The still may show a move in progress: absent apples or portals are NOT proof that the original level lacks them. The 40 older generated puzzles are not video-verified.',
        'قد تكون الصورة من منتصف اللعب: غياب التفاحة أو المخرج لا يعني غيابهما في بداية المرحلة. المراحل الأربعون القديمة ليست مطابقة للفيديو.',
      )}
    </p>
    <nav aria-label={label('Video stages','المراحل الأصلية')} style={{display:'flex',
      alignItems:'center',justifyContent:'center',gap:10,flexWrap:'wrap'}}>
      <button type="button" disabled={level===1} onClick={()=>chooseLevel(Math.max(1,level-1))}
        style={buttonStyle}>{label('Previous','السابق')}</button>
      <span style={{fontVariantNumeric:'tabular-nums'}}>{level}</span>
      <button type="button" disabled={level===105} onClick={()=>chooseLevel(Math.min(105,level+1))}
        style={buttonStyle}>{label('Next','التالي')}</button>
    </nav>
    <nav aria-label={label('Stage batches','دفعات المراحل')} style={{display:'flex',
      justifyContent:'center',flexWrap:'wrap',gap:5}}>
      {Array.from({length:7},(_,i)=>({from:i*15+1,to:Math.min((i+1)*15,105)})).map(pack=>
        <button type="button" key={pack.from} onClick={()=>chooseLevel(pack.from)}
          aria-current={level>=pack.from&&level<=pack.to?'page':undefined}
          style={{...buttonStyle,background:level>=pack.from&&level<=pack.to?'#1a806e':'#28546c',
            fontSize:12,padding:'6px 10px'}}>
          {pack.from}–{pack.to}
        </button>)}
    </nav>
    <nav aria-label={label('Choose original frame','اختر رقم المرحلة')} style={{
      display:'grid',gridTemplateColumns:'repeat(15, minmax(28px,1fr))',
      width:'min(100%,650px)',gap:4,flexShrink:0}}>
      {Array.from({length:last-first+1},(_,i)=>first+i).map(n=>
        <button type="button" key={n} onClick={()=>chooseLevel(n)}
          aria-current={n===level?'step':undefined}
          aria-label={label('Preview reference stage','معاينة مرجع المرحلة')+' '+n}
          style={{...buttonStyle,fontSize:12,
            padding:'8px 2px',background:n===level?'#168f77':'#255168'}}>
          {n}
        </button>)}
    </nav>
  </div>;
}

const buttonStyle:CSSProperties={
  background:'#28546c',color:'white',padding:'8px 12px',borderRadius:8,
  border:'1px solid #86aab8',cursor:'pointer',fontWeight:600,
};

function SourceSnapshotBoard({stage}:{stage:AppleWormVisualSnapshot}) {
  const CELL=30;
  const point=(p:readonly [number,number])=>({x:p[0]*CELL+15,y:p[1]*CELL+15});
  return <svg viewBox="0 0 630 270" xmlns="http://www.w3.org/2000/svg"
    role="img" aria-label={`Video image reconstruction, stage ${stage.level}`}
    preserveAspectRatio="xMidYMid meet"
    style={{display:'block',width:'100%',height:'auto',maxHeight:'min(48dvh,420px)'}}>
    <rect width="630" height="270" fill="#a4eaff"/>
    <path d="M0 224 Q70 175 135 219 T270 220 T405 218 T540 220 T675 219V270H0Z" fill="#e9faff"/>
    {stage.terrain.map((line,y)=>[...line].map((tile,x)=>tile==='#'?
      <g key={y*21+x}>
        <rect x={x*CELL} y={y*CELL} width={CELL} height={CELL}
          fill="#7b4d31" stroke="#523727" strokeWidth="1.5"/>
        <path d={`M${x*CELL+2} ${y*CELL+3}h26`} stroke="#ac7651" strokeWidth="2"/>
      </g>:null))}
    {stage.grayObjectsVisible.map((p,i)=>{const {x,y}=point(p);return <g key={'g'+i}
      transform={`translate(${x} ${y})`}>
      <rect x="-13" y="-13" width="26" height="26" rx="5"
        fill="#95a1ad" stroke="#5f6c78" strokeWidth="2"/>
      <text textAnchor="middle" y="6" fontSize="18" fill="#253442">?</text>
    </g>;})}
    {stage.applesVisible.map((p,i)=>{const {x,y}=point(p);return <g key={'a'+i}>
      <circle cx={x} cy={y+2} r="12" fill="#e13930" stroke="#a81825" strokeWidth="1.5"/>
      <path d={`M${x} ${y-8}l2 -8m-2 6q8 -9 11 -1`}
        fill="none" stroke="#227b43" strokeWidth="3" strokeLinecap="round"/>
    </g>;})}
    {stage.wormVisible.map((p,i)=>{const {x,y}=point(p);return <circle key={'w'+i}
      cx={x} cy={y} r="14" fill="#55c733" stroke="#289331" strokeWidth="2"/>;})}
    {stage.probablePortal&&(()=>{const {x,y}=point(stage.probablePortal);return <g
      transform={`translate(${x} ${y})`}>
      <circle r="16" fill="#17253c" stroke="#505975" strokeWidth="3"/>
      <path d="M-10 -3C3 -19 16 -4 6 6S-6 8 1 1" stroke="#c0c2ea"
        strokeWidth="2" fill="none"/>
    </g>;})()}
    <rect x="1" y="1" width="628" height="268" fill="none"
      stroke="#e9fbff" strokeOpacity=".55" strokeWidth="2"/>
  </svg>;
}
