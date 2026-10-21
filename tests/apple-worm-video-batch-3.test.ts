import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  BATCH_THREE_3,APPLE_WORM_VIDEO_BATCH_THREE_STARTS,
} from '../packages/games/apple-worm/video-start-poses-batch-3.ts';
import {APPLE_WORM_VIDEO_START_POSES} from '../packages/games/apple-worm/video-start-poses-selected-33.ts';
import {APPLE_WORM_VIDEO_BATCH_TWO_STARTS} from '../packages/games/apple-worm/video-start-poses-batch-2.ts';
import {
  displayGrayPositions,fixedGrayForBatchThree,initialMovableGray,
} from '../packages/games/apple-worm/gray-box-physics-batch-3.ts';
import {
  screenshotWormLevel,startScreenshotWorm,moveScreenshotWorm,
  restoreScreenshotWorm,type ScreenshotDirection,
} from '../packages/games/apple-worm/screenshot-game.ts';
import {replayAppleWormRoute,solveAppleWormLevel}
  from '../packages/games/apple-worm/solvability.ts';

// Exact in-engine replay certificates found from VIDEO start frames.
// Do not approve a level with a forced win, teleported head, or relocated exit.
export const BATCH_THREE_CODED_WIN_ROUTES={
  98:'UURRRUULLLLLLLLLUULLLLDLLD',
  104:'RRRURUUU',
  105:'RULULLLLLLLUULLLDRDRRRRRRRURUUURRRRRR',
} as const;
const decoder:Record<string,ScreenshotDirection>={
  U:'up',R:'right',D:'down',L:'left',
};
const key=(p:readonly[number,number])=>p.join(',');

test('final batch is precisely the three requested stages and does not overwrite first 30',()=>{
  assert.deepEqual([...BATCH_THREE_3],[98,104,105]);
  assert.equal(Object.keys(APPLE_WORM_VIDEO_BATCH_THREE_STARTS).length,3);
  for(const n of BATCH_THREE_3){
    assert.ok(APPLE_WORM_VIDEO_BATCH_THREE_STARTS[n]);
    assert.equal(APPLE_WORM_VIDEO_START_POSES[n],undefined);
    assert.equal(APPLE_WORM_VIDEO_BATCH_TWO_STARTS[n],undefined);
  }
});

test('all three video opening poses are connected, unambiguous and clear of original ground',()=>{
  const expectedSizes={98:4,104:3,105:3};
  for(const n of BATCH_THREE_3){
    const board=screenshotWormLevel(n,'legacy'),state=startScreenshotWorm(n,'legacy');
    assert.deepEqual(state.body,APPLE_WORM_VIDEO_BATCH_THREE_STARTS[n]!.headToTail);
    assert.equal(state.body.length,expectedSizes[n]);
    assert.ok(board.canMove&&board.portal);
    assert.equal(new Set(state.body.map(key)).size,state.body.length);
    for(let i=0;i<state.body.length;i++){
      const [x,y]=state.body[i]!;
      assert.ok(x>=0&&x<=20&&y>=-2&&y<=9);
      if(y>=0&&y<=8)assert.equal(board.rows[y]![x],'.',
        'video start overlaps terrain on '+n);
      if(i)assert.equal(
        Math.abs(x-state.body[i-1]![0])+Math.abs(y-state.body[i-1]![1]),1);
    }
    assert.ok(board.issues.includes('video-clip-start-reconstructed'));
  }
});

test('stage 98 restores the video-opening top apple and missing upper saw',()=>{
  const board=screenshotWormLevel(98,'legacy');
  assert.deepEqual(board.apples.at(-1),[15,1]);
  assert.deepEqual(board.grayObjects,[[5,-1],[5,0],[5,1],[8,1]]);
  assert.deepEqual(board.portal,[2,1]);
});

test('stage 104 has seven IMMOBILE pillar blocks and exactly one PUSHABLE crate',()=>{
  const board=screenshotWormLevel(104,'legacy'),start=startScreenshotWorm(104,'legacy');
  assert.deepEqual(fixedGrayForBatchThree(104,board.grayObjects),
    Array.from({length:7},(_,i)=>[4,i+1]));
  assert.deepEqual(initialMovableGray(104,board.grayObjects),[[7,7]]);
  assert.deepEqual(start.grayPositions,[[7,7]]);
  assert.equal(displayGrayPositions(104,board.grayObjects,start.grayPositions).length,8);
  const first=moveScreenshotWorm(start,'right',board);
  assert.notEqual(first,start);
  assert.deepEqual(first.body[0],[7,7]);
  assert.deepEqual(first.grayPositions,[[8,7]],
    'crate moves one cell, pillar stays immovable');
  const restored=restoreScreenshotWorm(JSON.parse(JSON.stringify(first)));
  assert.deepEqual(restored,first,'saved dynamic crate survives resume');
  assert.deepEqual(displayGrayPositions(104,board.grayObjects,first.grayPositions).at(-1),
    [8,7],'rendered crate follows actual gameplay position');
});

test('three historical selected-clip routes replay faithfully in their isolated source fixture',()=>{
  const results=[] as {level:number;route:string;moves:number;won:boolean}[];
  for(const n of BATCH_THREE_3){
    const coded=BATCH_THREE_CODED_WIN_ROUTES[n];
    const moves=[...coded].map(ch=>decoder[ch]!);
    assert.ok(moves.every(Boolean));
    const result=replayAppleWormRoute(n,moves,{source:'legacy'});
    assert.equal(result.legalMoves,moves.length,
      'illegal or blocked move in Level '+n+' at step '+(result.legalMoves+1));
    assert.equal(result.won,true,'actual in-engine portal win needed for '+n);
    assert.equal(result.state.phase,'won');
    assert.deepEqual(result.state.body[0],screenshotWormLevel(n,'legacy').portal);
    results.push({level:n,route:coded,moves:moves.length,won:true});
  }
  console.log('APPLE_WORM_VIDEO_BATCH_3_JSON='+JSON.stringify({
    batch:3,proven:BATCH_THREE_3,results,
  }));
  assert.deepEqual(results.map(r=>r.level),[98,104,105]);
});

test('short level 98 and 104 solutions are discoverable without any forced-win data',()=>{
  for(const n of [98,104]){
    const r=solveAppleWormLevel(n,{maxStates:8000,maxMillis:1200,source:'legacy'});
    assert.equal(r.status,'won','BFS cannot find Stage '+n);
    assert.ok(r.route);
    assert.equal(replayAppleWormRoute(n,r.route,{source:'legacy'}).won,true);
  }
});
