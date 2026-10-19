/**
 * IMAGE-ONLY Apple Worm evidence, 105 screenshots from user-provided archive.
 * This data was read from still images, never the MP4 during this pass.
 *
 * All 105 are *snapshots*, NOT all 105 untampered level starts. For example,
 * snapshot stage 2 shows the worm after the apple has been eaten, so that
 * stage's actual start fruit is absent. Some stages have hidden/offscreen
 * portals; some gray circles are saws, while other gray squares are blocks.
 *
 * Grid x = 33 + x*30, y = 73 + y*30 on original 640×360 screenshots.
 * Grid y may be -2/-1 above the terrain grid or +9 for partly visible exits\n * at the bottom of the original 640x360 source framing.
 * No level is marked as ready for live gameplay or source-solution verified.
 *
 * Encoded fields: visible apples, green worm segments, gray obstacle cells,
 * probable exit candidate (initial template detector plus additional high-resolution\n * PDF dark-circle geometry checks, still requiring individual review). Each field is base64 of
 * cell indices encoded as byte (y+2)*21+x. Blank means no visible detection
 * and must NEVER be assumed absent from the real unplayed stage.
 *
 * Pixel-based recognition is heuristic and must be manually corrected from
 * the screenshot before shipping; original sprites are NOT included.
 */
export type ImageEvidencePoint = readonly [number,number];
export interface AppleWormImageEvidence {
  level:number;
  sourceImage:string;
  visibleApples:readonly ImageEvidencePoint[];
  visibleWormCells:readonly ImageEvidencePoint[];
  grayObstacleCandidates:readonly ImageEvidencePoint[];
  probablePortal:ImageEvidencePoint | null;
  sourceInitialStateVerified:false;
  sourceSolutionVerified:false;
  readyForLiveGame:false;
}
const FRAME_OBJECTS = `,goOX,,jA==
,b4SFmg==,,YQ==
cw==,cIWG,,jA==
cw==,h4iJ,,TQ==
nA==,XXI=,,iw==
iA==,ip+0,,OQ==
nQ==,c4g=,,Yg==
hw==,b4Q=,,zA==
cw==,nZ4=,,TA==
sQ==,nJ2e,,YQ==
,cYaH,nA==,YA==
XQ==,cXKG,ig==,OA==
hw==,cnOI,Rw==,dw==
nQ==,NDVJ,iA==,dg==
cg==,h4iJ,XQ==,sQ==
Qw==,R0hc,XYY=,OQ==
Xg==,cHFy,Sm8=,tg==
nA==,iImK,h54=,dw==
XA==,S2B1,dIk=,eA==
gw==,mJk=,Wl4=,Yw==
XQ==,cYWG,,iw==
iA==,SV5z,,dg==
dA==,SEld,,dw==
iA==,MjM0,,oA==
Xg==,R1xx,,dQ==
cA==,Wltv,cQ==,oA==
sQ==,Rkdb,,eA==
cQ==,g4SY,XA==,TA==
hw==,mJma,Rw==,oQ==
iZ2x,tA==,nLM=,Cg==
hYk=,sbKz,hIebxcY=,Hw==
WQ==,bm9w,OURhgoaH,eQ==
WQ==,MkdI,sbKztbY=,OA==
ip4=,m5yx,SUqEhqw=,CQ==
doGV,gpaX,XJ8=,tQ==
WltziIo=,YHR1,cLCxsg==,tA==
,SktM,XYebng==,Qw==
sQ==,nZ6z,RldylQ==,og==
Qps=,LzA=,bA==,eA==
hIw=,hoc=,mw==,Mg==
cHaB,n6Ch,,NA==
WoI=,i6A=,cJo=,OA==
cA==,MTJG,,Yg==
SUw=,ODk=,,bw==
cg==,g4SFhg==,,OQ==
S4Y=,XHBx,,Tg==
dg==,RUZH,WYQ=,nA==
hoqdsg==,cXJziA==,h4mcnrGz,Cg==
mQ==,eI2i,,Lw==
,S0xN,XbM=,gg==
cXM=,Mkc=,,JA==
RXiL,W1xd,dw==,mw==
SXA=,S19g,m54=,OQ==
hw==,r7Cxsg==,m8Y=,Gg==
XXSf,hoeb,WltcXl9gsg==,Hg==
RYib,cHFy,b4c=,CQ==
iZw=,cHFyhQ==,m50=,HQ==
eLHI,SF1y,,LQ==
Xg==,,,Gg==
b7I=,R0hd,,Gw==
W3CF,RkdI,cQ==,TQ==
iJo=,iZ4=,cg==,Ig==
iKA=,coaH,SErHyA==,GQ==
d5mi,coeI,dA==,yg==
WbE=,XV5f,MnWd,Ig==
THI=,doqL,SEpxmg==,CQ==
couY,rq+w,,Iw==
hIaxsw==,W1xd,RkhKc5o=,DA==
iYuexg==,m5yw,SA==,Mw==
R7A=,Xl90iQ==,,
XoQ=,iIme,r7K2,yg==
SYk=,c3Q=,iJmam5yd,Hg==
mpucna+zxMg=,cnN0,nrHG,7Q==
M2Kctg==,orc=,RltwhZqxsrM=,Qg==
WQ==,b3Bx,MTI=,dw==
daA=,ios=,n7S1,UA==
m5yf,dYmKnZ4=,sLGys7Q=,Cg==
bYY=,XHBx,,TA==
cw==,iImd,,SA==
hoiKsLTGyA==,nJ2esrM=,,Ag==
gpaYmqyuwg==,WVpvhA==,,ZA==
hoeI,W3Bx,,HQ==
MTVHSVtfcXOFh4k=,M0hd,XF6am5ydng==,xg==
WG+uwQ==,Li8w,gw==,Iw==
cQ==,XV5ziA==,dHc=,jQ==
bnU=,goM=,,ww==
MV2K,YGFi,cXM=,sQ==
W151oA==,SElK,hYeImq8=,mQ==
XmCInrS2,d4ygoQ==,bnWChIuY,lg==
RUue,goOE,,rg==
cYs=,,NVyuxA==,Mw==
RJ+uxg==,YXV2ig==,NA==,hw==
MTM4nrC2yQ==,d4w=,Rltw,nA==
b3GDh5mbrw==,WltwhQ==,WV1tc4GJl52tsQ==,Ow==
,,nMA=,
hw==,MUZb,hpvG,Bw==
ipU=,bm9wgw==,M4A=,nA==
mcE=,Tg==,L0RH,QQ==
,bG2Bgg==,MEaJn7A=,ZA==
hoeImp6vs8XGxw==,W1xwhQ==,iZyxxMg=,7Q==
bW5vcHFyrK2ur7Cx,XF1e,,
XXJ1,MzQ1Ng==,YIeK,sQ==
dA==,RllaWw==,MQ==,TQ==
,rQ==,Q1htgpeswcQ=,cw==
Lmtsbm9wcQ==,XV4=,Q1g=,Jg==`.trim().split(/\s+/);
export const APPLE_WORM_IMAGE_ONLY_SNAPSHOT_COUNT = FRAME_OBJECTS.length;

const decode = (encoded:string):ImageEvidencePoint[] => {
  if(!encoded)return [];
  const bytes=atob(encoded);
  return Array.from(bytes, b => {
    const v=b.charCodeAt(0);
    return [v%21,Math.floor(v/21)-2] as ImageEvidencePoint;
  });
};

export function appleWormImageEvidence(level:number):AppleWormImageEvidence {
  if(!Number.isInteger(level)||level<1||level>FRAME_OBJECTS.length)
    throw new RangeError('Image evidence available for stages 1 through 105');
  const parts=FRAME_OBJECTS[level-1]!.split(',');
  if(parts.length!==4)throw new Error('Corrupted still-image record');
  const portals=decode(parts[3]!);
  return {
    level,
    sourceImage:`stage_${String(level).padStart(3,'0')}.jpg`,
    visibleApples:decode(parts[0]!),
    visibleWormCells:decode(parts[1]!),
    grayObstacleCandidates:decode(parts[2]!),
    probablePortal:portals[0]||null,
    sourceInitialStateVerified:false,
    sourceSolutionVerified:false,
    readyForLiveGame:false,
  };
}
