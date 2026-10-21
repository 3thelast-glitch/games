import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {
  USER_MARKED_BLACK_THORNS,USER_MARKED_BLACK_THORN_CELL_COUNT,
  USER_MARKED_BLACK_THORN_STAGE_COUNT,USER_MARKED_BLACK_THORN_SEGMENT_COUNT,
  userMarkedThornCells,userMarkedThornFaces,
} from '../packages/games/apple-worm/user-marked-black-thorns-21-30.ts';
import {
  screenshotWormLevel,startScreenshotWorm,moveScreenshotWorm,restoreScreenshotWorm,
} from '../packages/games/apple-worm/screenshot-game.ts';
import {AppleWormReferenceScene} from '../apps/mobile/src/AppleWormReferenceScene.tsx';

test('actual player-annotated PDF has 10 stage maps and 46 black thorn faces in 42 cells',()=>{
  assert.deepEqual(Object.keys(USER_MARKED_BLACK_THORNS).map(Number),
    [21,22,23,24,25,26,27,28,29,30]);
  assert.equal(USER_MARKED_BLACK_THORN_STAGE_COUNT,10);
  assert.equal(USER_MARKED_BLACK_THORN_CELL_COUNT,42);
  assert.equal(USER_MARKED_BLACK_THORN_SEGMENT_COUNT,46);
  const cellCounts=[1,3,3,3,1,3,2,2,6,18];
  for(let n=21;n<=30;n++){
    const map=screenshotWormLevel(n);
    const sourceCells=userMarkedThornCells(n);
    assert.equal(sourceCells.length,cellCounts[n-21],'marked PDF floor/wall cells L'+n);
    assert.deepEqual(map.spikes,sourceCells);
    assert.ok(map.issues.includes('user-annotated-lethal-black-thorns'));
    assert.equal(startScreenshotWorm(n).phase,'playing');
  }
});

test('the black markings preserve roof, underside and sideways cliff orientation',()=>{
  assert.deepEqual(userMarkedThornCells(21),[[9,4]]);
  assert.deepEqual(userMarkedThornFaces(21,[9,4]),['up']);
  assert.deepEqual(userMarkedThornFaces(22,[11,2]),['left']);
  assert.deepEqual(userMarkedThornFaces(23,[10,3]),['right']);
  assert.deepEqual(userMarkedThornFaces(24,[9,5]),['down']);
  assert.deepEqual(userMarkedThornFaces(29,[10,3]),['down']);
  assert.deepEqual(userMarkedThornFaces(30,[9,0]),['right']);
  assert.deepEqual(userMarkedThornFaces(30,[11,0]),['left']);
  assert.deepEqual(userMarkedThornFaces(30,[7,7]),['right','up']);
  assert.deepEqual(userMarkedThornFaces(30,[13,7]),['left','up']);
  assert.deepEqual(userMarkedThornFaces(30,[7,4]),['right','down']);
  assert.deepEqual(userMarkedThornFaces(30,[13,4]),['left','down']);
});

test('premium black spikes visually use EXACT PDF-marked cells and faces',()=>{
  for(let n=21;n<=30;n++){
    const map=screenshotWormLevel(n),state=startScreenshotWorm(n);
    const html=renderToStaticMarkup(createElement(AppleWormReferenceScene,{
      board:map,body:state.body,remaining:map.apples,grayPositions:state.grayPositions,
      showSky:false,phase:state.phase,
    }));
    assert.equal((html.match(/data-source-spike="/g)||[]).length,map.spikes.length);
    assert.equal((html.match(/data-user-marked="true"/g)||[]).length,map.spikes.length);
    const segments=html.match(/data-thorn-facing="/g)??[];
    assert.equal(segments.length,USER_MARKED_BLACK_THORNS[n]!.length,
      'L'+n+' must keep all hand-drawn surface orientations');
    for(const {cell,face} of USER_MARKED_BLACK_THORNS[n]!){
      const group=html.match(new RegExp('data-spike-face="[^"]*"[^>]*data-user-marked="true"'+
        '[^>]*data-grid-x="'+cell[0]+'" data-grid-y="'+cell[1]+'"'))??[];
      assert.ok(group.length,'spike missing from chosen logical cell L'+n+':'+cell);
      assert.ok(html.includes('data-thorn-facing="'+face+'"'),'thorn face '+face+' missing L'+n);
    }
    assert.ok(html.includes('#050608')||html.includes('#171a20'),
      'authored thorn art must stay black');
  }
});

test('a worm touching a black thorn loses immediately (even if the surface has terrain)',()=>{
  const map=screenshotWormLevel(21);
  const state={...startScreenshotWorm(21),body:[[8,4],[7,4],[6,4]] as const};
  const result=moveScreenshotWorm(state,'right',map);
  assert.equal(result.phase,'lost');
  assert.deepEqual(result.body[0],[9,4]);
  assert.equal(result.moves,state.moves+1);
  assert.equal(restoreScreenshotWorm(result)?.phase,'lost');
});

test('falling worm segments also die on the player-annotated thorns',()=>{
  const map=screenshotWormLevel(21);
  const empty={...map,rows:Array.from({length:9},()=>'.'.repeat(21)),saws:[]};
  const state={...startScreenshotWorm(21),body:[[8,1],[9,1],[10,1]] as const};
  const result=moveScreenshotWorm(state,'left',empty);
  assert.equal(result.phase,'lost');
  assert.ok(result.body.some(p=>p[0]===9&&p[1]===4));
});

test('legacy source video clips and other levels do not receive user-drawn thorns',()=>{
  for(let n=1;n<=105;n++){
    if(n<21||n>30)assert.deepEqual(userMarkedThornCells(n),[]);
  }
  for(let n=21;n<=30;n++){
    assert.deepEqual(screenshotWormLevel(n,'legacy').spikes,[]);
  }
});
