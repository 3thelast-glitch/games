/**
 * Screenshot-defined Apple Worm playable prototype for ALL 105 archived images.
 *
 * Uses exactly the terrain, apples, visible worm cells, gray objects and
 * candidate portal from the user's still image. No 40-stage legacy fallback,
 * no manufactured apple, no made-up exit or object geometry.
 *
 * Movement, gravity and gray-object collisions remain provisional. Some source
 * frames were captured mid-play, some portal/worm detections are incomplete:
 * these stages stay playable as exploration where possible but DO NOT qualify
 * as faithfully solved original-game levels.
 */
import { appleWormVisualSnapshot, APPLE_WORM_VISUAL_SNAPSHOT_COUNT } from './video-visual-snapshots-105.ts';
import { appleWormVideoTracedStage } from './video-traced-stages.ts';
import { APPLE_WORM_VIDEO_START_POSES } from './video-start-poses-selected-33.ts';
import { APPLE_WORM_VIDEO_BATCH_TWO_STARTS } from './video-start-poses-batch-2.ts';
import { APPLE_WORM_VIDEO_BATCH_THREE_STARTS } from './video-start-poses-batch-3.ts';
import { APPLE_WORM_FULL_VIDEO_EARLY_POSES } from './full-video-early-poses-105.ts';
import { APPLE_WORM_FULL_VIDEO_VISIBLE_APPLES } from './full-video-early-apples-105.ts';
import { supportsBatchTwoSideContact } from './wall-support-batch-2.ts';
import { isBatchOneMovableGray, pushGrayBox, settleGrayBoxes } from './gray-box-physics-batch-1.ts';
import { isBatchThreeMovableGray, fixedGrayForBatchThree, initialMovableGray } from './gray-box-physics-batch-3.ts';
import {sourceSawStarts,sourceStoneStarts,sourceSpikeStarts,STATIONARY_STONES} from './video-source-obstacles-105.ts';
import {userMarkedThornCells} from './user-marked-black-thorns-21-30.ts';

export type ScreenshotPoint = readonly [number, number];
export type ScreenshotDirection = 'up'|'right'|'down'|'left';
/** Historical fixture only: preserves selected-clip replays in regression tests. */
export type ScreenshotSourceMode='full-video'|'legacy';
export type ScreenshotPhase = 'playing'|'won'|'lost';
export interface ScreenshotLevel {
  readonly number:number;
  readonly sourceMode:ScreenshotSourceMode;
  readonly width:21;
  readonly height:9;
  readonly rows:readonly string[];
  readonly worm:readonly ScreenshotPoint[];
  readonly apples:readonly ScreenshotPoint[];
  readonly portal:ScreenshotPoint | null;
  /** In the complete source video L70/95/101 finish by leaving the TOP of the field. */
  readonly exitMode:'spiral'|'top-boundary'|'unknown';
  readonly grayObjects:readonly ScreenshotPoint[];
  /** Circular blades with visible serrated teeth: contact is lethal. */
  readonly saws:readonly ScreenshotPoint[];
  /** Separate triangle spikes where future source evidence verifies cells. */
  readonly spikes:readonly ScreenshotPoint[];
  readonly canMove:boolean;
  readonly issues:readonly string[];
  /** The PDF reference is approved; this is not a claim of visual parity. */
  readonly referenceFrameApproved:true;
  readonly sourceGeometry:'screenshot';
  readonly exactPhysicsVerified:false;
  readonly exactVisualComparisonPassed:false;
}
export interface ScreenshotState {
  readonly level:number;
  readonly body:readonly ScreenshotPoint[];
  readonly collected:readonly number[];
  /** Dynamic gray crates on the eight batch-1 stages and single crate on stage 104. */
  readonly grayPositions?:readonly ScreenshotPoint[];
  readonly phase:ScreenshotPhase;
  readonly moves:number;
}
export const APPLE_WORM_SCREENSHOT_LEVEL_COUNT=APPLE_WORM_VISUAL_SNAPSHOT_COUNT;
export const SCREENSHOT_DIRECTIONS:readonly ScreenshotDirection[]=['up','right','down','left'];
const DELTAS:Record<ScreenshotDirection,ScreenshotPoint>={
  up:[0,-1],right:[1,0],down:[0,1],left:[-1,0],
};
const eq=(a:ScreenshotPoint,b:ScreenshotPoint)=>a[0]===b[0]&&a[1]===b[1];
const key=(p:ScreenshotPoint)=>p[0]+','+p[1];
const hasMovableGray=(stage:number,mode:ScreenshotSourceMode='full-video')=>
  isBatchOneMovableGray(stage)||isBatchThreeMovableGray(stage)||
  mode==='full-video'&&sourceStoneStarts(stage).length>0;
/** Observed in the player's complete 105-level video, NOT invented spirals.
 * L70 ~1779s, L95 ~2570s, L101 ~2707s finish above visible playfield. */
const TOP_BOUNDARY_EXIT_STAGES=new Set([70,95,101]);
const touching=(a:ScreenshotPoint,b:ScreenshotPoint)=>
  Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])===1;

/** A screenshot supplies visible green cells, not a head-to-tail ordering.
 * Only an unambiguous non-branching chain is eligible for moving.
 * The choice of head is an unverified heuristic, never a source-fidelity claim.
 */
function traceVisibleWorm(points:readonly ScreenshotPoint[], preferredHead?:ScreenshotPoint):ScreenshotPoint[]|null {
  if(!points.length)return null;
  const unique=new Map(points.map(p=>[key(p),p]));
  if(unique.size!==points.length)return null;
  if(points.length===1)return [points[0]!];
  const endpoints=points.filter(p=>points.filter(q=>touching(p,q)).length===1);
  if(endpoints.length!==2 ||
    points.some(p=>points.filter(q=>touching(p,q)).length>2))return null;
  // Stage 2's PDF frame visibly faces right from the top of the green bend;
  // the old rightmost-endpoint heuristic wrongly put the head at its lower tail.
  const candidates=endpoints.sort((a,b)=>
    (preferredHead&&eq(a,preferredHead)?-1:preferredHead&&eq(b,preferredHead)?1:0)||
    b[0]-a[0]||a[1]-b[1]);
  const chain:ScreenshotPoint[]=[candidates[0]!];
  const visited=new Set([key(chain[0]!)]);
  while(chain.length<points.length){
    const last=chain.at(-1)!;
    const next=points.find(p=>!visited.has(key(p))&&touching(last,p));
    if(!next)return null;
    chain.push(next);
    visited.add(key(next));
  }
  return chain;
}
export function screenshotWormLevel(level:number,sourceMode:ScreenshotSourceMode='full-video'):ScreenshotLevel {
  const source=appleWormVisualSnapshot(level);
  // Some screenshots have a uniquely visible forward-facing mouth which
  // the generic rightmost-endpoint guess cannot infer (stages 2 and 59).
  // Four green cells may mutually touch in a 2x2 area even when the
  // actual body follows a U bend. In those two screenshots the mouth is
  // visible, so preserve the pictured head-to-tail path instead of
  // rejecting the worm as a loop.
  const picturedOrder:readonly ScreenshotPoint[]|null=level===80
    ?[[9,5],[10,5],[11,5],[11,6],[10,6]]
    :level===99?[[3,2],[3,3],[3,4],[4,4],[4,3]]:null;
  const manualMatches=picturedOrder!==null&&picturedOrder.length===source.wormVisible.length&&
    picturedOrder.every(p=>source.wormVisible.some(q=>eq(p,q)))&&
    picturedOrder.every((p,i)=>i===0||touching(p,picturedOrder[i-1]!));
  const fullVideoStart=sourceMode==='full-video'?APPLE_WORM_FULL_VIDEO_EARLY_POSES[level]:undefined;
  const videoStart=APPLE_WORM_VIDEO_START_POSES[level]??
    APPLE_WORM_VIDEO_BATCH_TWO_STARTS[level]??APPLE_WORM_VIDEO_BATCH_THREE_STARTS[level];
  // The user-supplied COMPLETE 105-stage recording has priority over older
  // cropped problem clips and mid-solution stills for mouth-confirmed poses.
  const worm=fullVideoStart?[...fullVideoStart.headToTail]:videoStart?[...videoStart.headToTail]:manualMatches?[...picturedOrder!]:traceVisibleWorm(source.wormVisible,
    level===2?[6,3]:level===59?[8,-2]:undefined);
  // The first 10 exits were manually traced from the walkthrough, and are
  // more reliable than the still-image portal detector when it misses a swirl.
  const portal=source.probablePortal??(level<=10?appleWormVideoTracedStage(level).exit:null);
  const exitMode=portal?'spiral':sourceMode==='full-video'&&TOP_BOUNDARY_EXIT_STAGES.has(level)
    ?'top-boundary':'unknown';
  const issues:string[]=[];
  if(!worm)issues.push('worm-shape-unresolved');
  else if(worm.length===1)issues.push('single-segment-snapshot');
  if(exitMode==='unknown')issues.push('portal-unresolved');
  if(portal && portal[1]<0)issues.push('portal-above-terrain-grid');
  if(portal && portal[1]>=9)issues.push('portal-below-terrain-grid');
  if(source.grayObjectsVisible.length)issues.push('gray-object-mechanics-unresolved');
  // Positive detections from the UNTOUCHED full-video opening take precedence
  // over later gallery frames (which may show the fruit already consumed).
  // Empty detections are not proof of absence; retain older source evidence.
  const earlyApples=sourceMode==='full-video'?APPLE_WORM_FULL_VIDEO_VISIBLE_APPLES[level]:undefined;
  const apples=earlyApples?[...earlyApples]:videoStart?.extraInitialApples
    ?[...source.applesVisible,...videoStart.extraInitialApples]:source.applesVisible;
  // The original image-only detector grouped *saw wheels* with gray stones.
  // Use the user's early VIDEO as the primary object-type evidence. Never
  // turn a serrated wheel into a static solid/question-mark block.
  const saws=sourceMode==='full-video'?sourceSawStarts(level):[];
  // The user annotated BLACK THORN locations directly on screenshots of
  // OUR GAME (pages 13-17, levels 21-30). Treat those drawings as authoring
  // instructions, separate from the original-video automatic detector.
  const spikes=sourceMode==='full-video'
    ?[...sourceSpikeStarts(level),...userMarkedThornCells(level)]:[];
  const filmedStones=sourceMode==='full-video'?sourceStoneStarts(level):[];
  const grayObjects=sourceMode==='full-video'&&(saws.length||filmedStones.length)
    ?filmedStones:videoStart?.grayStartOverride??source.grayObjectsVisible;
  if(saws.length)issues.push('filmed-serrated-saw-hazards');
  if(userMarkedThornCells(level).length&&sourceMode==='full-video')
    issues.push('user-annotated-lethal-black-thorns');
  if(filmedStones.length)issues.push('filmed-typed-stones');
  if(sourceMode==='full-video'){
    if(fullVideoStart)issues.push('full-video-early-pose-mouth-confirmed');
    else issues.push('full-video-opening-pose-needs-manual-review');
  }
  if(videoStart)issues.push('video-clip-start-reconstructed');
  if(earlyApples)issues.push('full-video-early-apples-visible');
  if(!apples.length)issues.push('no-apples-visible-in-frame');
  issues.push('starting-head-and-physics-unverified');
  return {
    number:level,sourceMode,width:21,height:9,
    rows:source.terrain,
    worm:worm??source.wormVisible,
    apples,
    portal,exitMode,
    grayObjects,saws,spikes,
    canMove:worm!==null,
    issues,
    sourceGeometry:'screenshot',referenceFrameApproved:true,
    exactPhysicsVerified:false,exactVisualComparisonPassed:false,
  };
}
export function startScreenshotWorm(level=1,sourceMode:ScreenshotSourceMode='full-video'):ScreenshotState {
  const map=screenshotWormLevel(level,sourceMode);
  return {
    level,body:map.worm.map(([x,y]):ScreenshotPoint=>[x,y]),
    collected:[],phase:'playing',moves:0,
    ...(hasMovableGray(level,sourceMode)?{grayPositions:initialMovableGray(level,map.grayObjects).map(
      ([x,y]):ScreenshotPoint=>[x,y])}:{})
  };
}
// Original 640x360 contact frames can show a spiral above the ground
// rows (y=-2) or at the lower visible edge (y=9). Keep 9 terrain rows.
const onBoard=([x,y]:ScreenshotPoint)=>x>=0&&x<21&&y>=-2&&y<=9;
// Solver audit can reuse an unchanged stage object and its exact collision mask.
// This is an internal performance optimization, NOT a different movement rule.
const solidCellsByStage=new WeakMap<ScreenshotLevel,Set<string>>();
export function moveScreenshotWorm(state:ScreenshotState,direction:ScreenshotDirection,stageOverride?:ScreenshotLevel):ScreenshotState {
  if(state.phase!=='playing'||!Object.prototype.hasOwnProperty.call(DELTAS,direction))return state;
  const stage=stageOverride??screenshotWormLevel(state.level);
  if(stage.number!==state.level)throw new RangeError('stage override does not match active level');
  if(!stage.canMove||!state.body.length)return state;
  let solid=solidCellsByStage.get(stage);
  if(!solid){
    solid=new Set<string>();
    stage.rows.forEach((row,y)=>[...row].forEach((t,x)=>{if(t==='#')solid!.add(key([x,y]));}));
    // Stage 104 has seven fixed pillar cells and exactly one movable crate;
    // the original eight batch-1 movable-box levels remain unchanged.
    if(isBatchThreeMovableGray(stage.number))
      fixedGrayForBatchThree(stage.number,stage.grayObjects).forEach(p=>solid!.add(key(p)));
    else if(!isBatchOneMovableGray(stage.number))
      stage.grayObjects.forEach(p=>solid!.add(key(p)));
    solidCellsByStage.set(stage,solid);
  }
  const [dx,dy]=DELTAS[direction], [hx,hy]=state.body[0]!;
  const head:ScreenshotPoint=[hx+dx,hy+dy];
  // In the original video L70/95/101 the worm exits above the top of
  // the visible grid with apples remaining. This is the recorded win trigger,
  // NOT a replacement or imaginary spiral portal.
  if(stage.exitMode==='top-boundary'&&head[1]===-3&&
    head[0]>=0&&head[0]<21&&direction==='up'){
    const body:ScreenshotPoint[]=[head,...state.body.slice(0,-1)];
    return {level:state.level,body,collected:[...state.collected],
      phase:'won',moves:state.moves+1,
      ...(state.grayPositions?{grayPositions:state.grayPositions.map(p=>[...p] as ScreenshotPoint)}:{})};
  }
  // The source saw wheel is lethal even when embedded in a brick platform.
  // Check contact BEFORE solid-wall rejection; otherwise a saw sharing a
  // terrain cell behaves like a harmless immovable wall (e.g. Level 32).
  if(stage.saws.some(p=>eq(p,head))||stage.spikes.some(p=>eq(p,head))){
    const body:ScreenshotPoint[]=[head,...state.body.slice(0,-1)];
    return {
      level:state.level,body,collected:[...state.collected],
      phase:'lost',moves:state.moves+1,
      ...(state.grayPositions?{grayPositions:state.grayPositions.map(p=>[...p] as ScreenshotPoint)}:{})
    };
  }
  if(!onBoard(head)||solid.has(key(head))||state.body[1]&&eq(head,state.body[1]))return state;
  const dynamic=hasMovableGray(stage.number,stage.sourceMode);
  let boxes:readonly ScreenshotPoint[]|undefined=dynamic
    ?(state.grayPositions??initialMovableGray(stage.number,stage.grayObjects)):undefined;
  if(dynamic){
    const afterPush=pushGrayBox({boxes:boxes!,headTarget:head,direction,
      terrain:solid,body:state.body,
      apples:stage.apples.filter((_,i)=>!state.collected.includes(i))});
    if(!afterPush)return state;
    boxes=afterPush;
  }
  const fruitIndex=stage.apples.findIndex((p,i)=>!state.collected.includes(i)&&eq(p,head));
  const grow=fruitIndex>=0;
  const occupied=grow?state.body:state.body.slice(0,-1);
  if(occupied.some(p=>eq(p,head)))return state;
  const collected=grow?[...state.collected,fruitIndex].sort((a,b)=>a-b):[...state.collected];
  let body:ScreenshotPoint[]=[head,...(grow?state.body:state.body.slice(0,-1))]
    .map(([x,y]):ScreenshotPoint=>[x,y]);
  // Source-video serrated saws / spikes are DANGEROUS, not solid gray crates.
  // Test every body segment after a step and during each falling gravity step.
  // Rendering may rotate saws smoothly; collision stays deterministic.
  const lethal=new Set([...stage.saws,...stage.spikes].map(key));
  const hitLethal=()=>body.some(p=>lethal.has(key(p)));
  // The black exit is always active. Fruit is optional growth, not a gate.
  const win=()=>stage.portal!==null&&eq(body[0]!,stage.portal);
  let phase:ScreenshotPhase=hitLethal()?'lost':win()?'won':'playing';
  const remaining=stage.apples.filter((_,i)=>!collected.includes(i));
  // Simulate source-video gray box gravity only on explicitly verified stages.
  if(dynamic)boxes=settleGrayBoxes(boxes!,solid,body,remaining);
  const supported=()=>body.some(([x,y])=>solid.has(key([x,y+1]))||
    (boxes?.some(p=>eq(p,[x,y+1]))??false)||
    remaining.some(p=>eq(p,[x,y+1]))||
    // The source video shows side-hanging contact in just five Batch 2
    // stages. The existing down-support rule is UNCHANGED elsewhere.
    ((supportsBatchTwoSideContact(stage.number)||
      stage.sourceMode==='full-video'&&stage.number===58)&&(
      solid.has(key([x-1,y]))||solid.has(key([x+1,y])))));
  // Gravity starts only after a legal move; the untouched screenshot is never changed.
  if(phase==='playing'){
    while(!supported()){
      const falling:ScreenshotPoint[]=body.map(([x,y]):ScreenshotPoint=>[x,y+1]);
      if(remaining.some(p=>falling.some(b=>eq(b,p))))break;
      if(falling.some(p=>p[1]>9||p[0]<0||p[0]>=21)){
        // Keep the last in-bounds pose so losing states still restore safely.
        phase='lost';break;
      }
      body=falling;
      if(hitLethal()){phase='lost';break;}
      if(win()){phase='won';break;}
    }
  }
  return {level:state.level,body,collected,phase,moves:state.moves+1,
    ...(dynamic?{grayPositions:boxes!.map(([x,y]):ScreenshotPoint=>[x,y])}:{})};
}
/** Strict restoring: never accept arbitrary saved worm pixels or completed flags. */
export function restoreScreenshotWorm(value:unknown):ScreenshotState|null {
  if(!value||typeof value!=='object')return null;
  const s=value as Partial<ScreenshotState>;
  if(!Number.isInteger(s.level)||s.level!<1||s.level!>105||
    !Number.isSafeInteger(s.moves)||s.moves!<0||
    !Array.isArray(s.body)||!s.body.length||s.body.length>30||
    !Array.isArray(s.collected)||!['playing','won','lost'].includes(s.phase??''))return null;
  const board=screenshotWormLevel(s.level!);
  if(!board.canMove||s.body.some((p,i)=>!Array.isArray(p)||p.length!==2||
     !Number.isInteger(p[0])||!Number.isInteger(p[1])||
     !(onBoard([p[0],p[1]])||(i===0&&s.phase==='won'&&
       board.exitMode==='top-boundary'&&p[1]===-3&&p[0]>=0&&p[0]<21))))return null;
  if(new Set(s.body.map(key)).size!==s.body.length)return null;
  if(s.body.some((p,i)=>i>0&&!touching(p,s.body![i-1]!)))return null;
  if(s.collected.some(i=>!Number.isInteger(i)||i<0||i>=board.apples.length)||
    new Set(s.collected).size!==s.collected.length)return null;
  if(s.phase==='won'&&!(board.exitMode==='spiral'&&!!board.portal&&eq(s.body[0]!,board.portal)||
    board.exitMode==='top-boundary'&&s.body[0]![1]===-3))return null;
  const boxes=hasMovableGray(s.level!,board.sourceMode)?s.grayPositions:undefined;
  if(boxes!==undefined&&(!Array.isArray(boxes)||
    boxes.length!==initialMovableGray(s.level!,board.grayObjects).length||
    boxes.some(p=>!Array.isArray(p)||p.length!==2||!onBoard([p[0],p[1]])||
      !Number.isInteger(p[0])||!Number.isInteger(p[1]))||
    new Set(boxes.map(key)).size!==boxes.length||
    boxes.some(p=>s.body!.some(b=>eq(p,b)))))return null;
  return {level:s.level!,body:s.body.map(([x,y]):ScreenshotPoint=>[x,y]),
    collected:[...s.collected],moves:s.moves!,phase:s.phase!,
    ...(hasMovableGray(s.level!,board.sourceMode)?{grayPositions:(boxes??initialMovableGray(s.level!,board.grayObjects))
      .map(([x,y]):ScreenshotPoint=>[x,y])}:{})};
}
