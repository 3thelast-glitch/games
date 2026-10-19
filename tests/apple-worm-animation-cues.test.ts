import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { appleWormFacingAngle, appleWormMouthCue }
  from '../apps/mobile/src/apple-worm-animation-cues.ts';
import { AppleWormReferenceScene } from '../apps/mobile/src/AppleWormReferenceScene.tsx';
import { screenshotWormLevel } from '../packages/games/apple-worm/screenshot-game.ts';

const closed={hungry:false,distance:null};

test('eyes and face follow the head/neck, NEVER the nearest apple',()=>{
  assert.equal(appleWormFacingAngle([[5,5],[4,5]]),0);
  assert.equal(appleWormFacingAngle([[5,5],[6,5]]),180);
  assert.equal(appleWormFacingAngle([[5,5],[5,6]]),-90);
  assert.equal(appleWormFacingAngle([[5,5],[5,4]]),90);
  assert.equal(appleWormFacingAngle([[5,5],[5,6]],true),0,
    'the approved stage 2 frame keeps its fixed right-facing mouth');
});

test('mouth opens only for apples on the forward axis of the CURRENT fixed face',()=>{
  assert.deepEqual(appleWormMouthCue([5,5],[[7,5]],'playing',0),
    {hungry:true,distance:2});
  assert.deepEqual(appleWormMouthCue([5,5],[[6,5]],'playing',0),
    {hungry:true,distance:1});
  assert.deepEqual(appleWormMouthCue([5,5],[[3,5]],'playing',180),
    {hungry:true,distance:2});
  assert.deepEqual(appleWormMouthCue([5,5],[[5,3]],'playing',-90),
    {hungry:true,distance:2});
  assert.deepEqual(appleWormMouthCue([5,5],[[5,7]],'playing',90),
    {hungry:true,distance:2});
});

test('uploaded vertical-worm example: apple BELOW an upward-facing head never opens or turns the face',()=>{
  const body=[[5,3],[5,4],[5,5]] as const;
  const facing=appleWormFacingAngle(body);
  assert.equal(facing,-90,'face stays looking forward/up');
  assert.deepEqual(appleWormMouthCue(body[0],[[5,4],[5,5]],'playing',facing),closed);
  assert.deepEqual(appleWormMouthCue(body[0],[[5,6]],'playing',facing),closed);
  assert.deepEqual(appleWormMouthCue(body[0],[[5,1]],'playing',facing),
    {hungry:true,distance:2},'only an apple ABOVE that face causes opening');
});

test('uploaded horizontal-worm example: apple behind, below or diagonal never opens the mouth',()=>{
  const body=[[5,5],[4,5],[3,5]] as const;
  const facing=appleWormFacingAngle(body);
  assert.equal(facing,0);
  for(const apple of [[5,6],[5,4],[4,5],[4,6],[6,6],[7,4],[3,5]] as const){
    assert.deepEqual(appleWormMouthCue(body[0],[apple],'playing',facing),closed,
      'Face must not swivel at fruit '+apple.join(','));
  }
  assert.deepEqual(appleWormMouthCue(body[0],[[7,5]],'playing',facing),
    {hungry:true,distance:2});
});

test('obstacle, wall or own body BETWEEN mouth and fruit prevents anticipation',()=>{
  const head=[5,5] as const, fruit=[[7,5]] as const;
  assert.deepEqual(appleWormMouthCue(head,fruit,'playing',0,[[6,5]]),closed);
  assert.deepEqual(appleWormMouthCue(head,fruit,'playing',0,[[7,5]]),closed);
  assert.deepEqual(appleWormMouthCue(head,[[8,5]],'playing',0),closed);
  assert.deepEqual(appleWormMouthCue(head,[[7,5],[6,5]],'playing',0,[[7,5]]),
    {hungry:true,distance:1},'nearest reachable fruit is still visible');
});

test('the mouth returns to resting pose when the apple is gone or game ended',()=>{
  assert.deepEqual(appleWormMouthCue([5,5],[[8,5]],'playing',0),closed);
  assert.deepEqual(appleWormMouthCue([5,5],[],'playing',0),closed);
  assert.deepEqual(appleWormMouthCue([5,5],[[6,5]],'won',0),closed);
  assert.deepEqual(appleWormMouthCue([5,5],[[6,5]],'lost',0),closed);
  assert.deepEqual(appleWormMouthCue(undefined,[[6,5]],'playing',0),closed);
});

test('actual premium SVG keeps face direction locked while apple beneath the head is present',()=>{
  const board=screenshotWormLevel(15);
  const body=[[5,3],[5,4],[5,5]] as const;
  const fruit=[5,6] as const;
  // A purpose-built cosmetic test image: never overrides the real stage data.
  const clearBoard={...board,rows:Array.from({length:9},()=>'.'.repeat(21)),
    grayObjects:[]};
  const html=renderToStaticMarkup(createElement(AppleWormReferenceScene,{
    board:clearBoard,body,remaining:[fruit],phase:'playing',
  }));
  assert.match(html,/data-face-angle="-90"/);
  assert.match(html,/data-mouth-pose="idle"/);
  assert.doesNotMatch(html,/worm-character-hungry/);
  const above=renderToStaticMarkup(createElement(AppleWormReferenceScene,{
    board:clearBoard,body,remaining:[[5,1]],phase:'playing',
  }));
  assert.match(above,/data-face-angle="-90"/);
  assert.match(above,/data-mouth-pose="anticipating"/);
  assert.match(above,/data-mouth-target-distance="2"/);
  const blocked=renderToStaticMarkup(createElement(AppleWormReferenceScene,{
    board:{...clearBoard,rows:[...clearBoard.rows.slice(0,2),
      '.....#'+'.'.repeat(15),...clearBoard.rows.slice(3)]},
    body,remaining:[[5,1]],phase:'playing',
  }));
  assert.match(blocked,/data-face-angle="-90"/);
  assert.match(blocked,/data-mouth-pose="idle"/);
});

test('eating triggers chewing particles at original apple anchor without inserting any fruit',()=>{
  const board=screenshotWormLevel(15),apple=board.apples[0]!;
  const near=[[apple[0]-1,apple[1]],[apple[0]-2,apple[1]]] as const;
  const clearBoard={...board,rows:Array.from({length:9},()=>'.'.repeat(21)),
    grayObjects:[]};
  const waiting=renderToStaticMarkup(createElement(AppleWormReferenceScene,{
    board:clearBoard,body:near,remaining:[apple],phase:'playing',
  }));
  assert.match(waiting,/data-face-angle="0"/);
  assert.match(waiting,/data-mouth-pose="anticipating"/);
  assert.match(waiting,/worm-fruit-aura/);
  const after=renderToStaticMarkup(createElement(AppleWormReferenceScene,{
    board:clearBoard,body:near,remaining:[],phase:'playing',
  }));
  assert.match(after,/data-mouth-pose="idle"/);
  assert.doesNotMatch(after,/data-source-apple=/);
  const bite=renderToStaticMarkup(createElement(AppleWormReferenceScene,{
    board:clearBoard,body:near,remaining:[],phase:'playing',
    biteFx:{key:1,apple},
  }));
  assert.match(bite,/data-mouth-pose="chewing"/);
  assert.match(bite,/data-apple-bite-fx=/);
  assert.doesNotMatch(bite,/data-source-apple=/);
  assert.ok(bite.includes('transform="translate('+((apple[0]+.5)*30)+' '+((apple[1]+.5)*30)+')"'));
});

test('all known portal exits remain visually ready with or without apples',()=>{
  for(let level=1;level<=105;level++){
    const board=screenshotWormLevel(level);
    const html=renderToStaticMarkup(createElement(AppleWormReferenceScene,{
      board,body:board.worm,remaining:board.apples,phase:'playing',
    }));
    if(board.portal){
      assert.match(html,/worm-portal-ready/,'Stage '+level+' portal remains active');
      assert.match(html,/worm-portal-orbit/);
      assert.match(html,/worm-portal-spark/);
    }
  }
});

test('winning still displays visual portal rings without shifting its source coordinates',()=>{
  const board=screenshotWormLevel(2);
  assert.ok(board.portal);
  const html=renderToStaticMarkup(createElement(AppleWormReferenceScene,{
    board,body:board.worm,remaining:board.apples,phase:'won',
  }));
  assert.match(html,/worm-portal-victory/);
  assert.match(html,/worm-portal-ready/);
  const [x,y]=board.portal!;
  assert.ok(html.includes('transform="translate('+((x+.5)*30)+' '+((y+.5)*30)+')"'));
});
