import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { appleWormMouthCue } from '../apps/mobile/src/apple-worm-animation-cues.ts';
import { AppleWormReferenceScene } from '../apps/mobile/src/AppleWormReferenceScene.tsx';
import { screenshotWormLevel } from '../packages/games/apple-worm/screenshot-game.ts';

test('worm opens mouth when an uncollected apple approaches within two cells',()=>{
  assert.deepEqual(appleWormMouthCue([5,5],[[7,5]],'playing'),
    {hungry:true,faceAngle:0,distance:2});
  assert.deepEqual(appleWormMouthCue([5,5],[[4,5]],'playing'),
    {hungry:true,faceAngle:180,distance:1});
  assert.deepEqual(appleWormMouthCue([5,5],[[5,3]],'playing'),
    {hungry:true,faceAngle:-90,distance:2});
  assert.deepEqual(appleWormMouthCue([5,5],[[5,6]],'playing'),
    {hungry:true,faceAngle:90,distance:1});
  assert.deepEqual(appleWormMouthCue([5,5],[[7,6],[6,5]],'playing'),
    {hungry:true,faceAngle:0,distance:1});
});

test('worm closes mouth again when there is no close remaining apple',()=>{
  assert.deepEqual(appleWormMouthCue([5,5],[[8,5]],'playing'),
    {hungry:false,faceAngle:undefined,distance:null});
  assert.deepEqual(appleWormMouthCue([5,5],[],'playing'),
    {hungry:false,faceAngle:undefined,distance:null});
  assert.deepEqual(appleWormMouthCue([5,5],[[6,5]],'won'),
    {hungry:false,faceAngle:undefined,distance:null});
  assert.deepEqual(appleWormMouthCue(undefined,[[6,5]],'playing'),
    {hungry:false,faceAngle:undefined,distance:null});
});

test('premium worm mouth poses and apple bite particles follow visual cues, not gameplay changes',()=>{
  const board=screenshotWormLevel(15);
  assert.ok(board.apples.length>0);
  const apple=board.apples[0]!;
  const near:readonly (readonly [number,number])[]=[
    [apple[0]-1,apple[1]],[apple[0]-2,apple[1]],
  ];
  const closeHtml=renderToStaticMarkup(createElement(AppleWormReferenceScene,{
    board,body:near,remaining:[apple],phase:'playing',
  }));
  assert.match(closeHtml,/data-mouth-pose="anticipating"/);
  assert.match(closeHtml,/worm-character-hungry/);
  assert.match(closeHtml,/worm-fruit-aura/);
  assert.match(closeHtml,/worm-fruit-float/);
  const farHtml=renderToStaticMarkup(createElement(AppleWormReferenceScene,{
    board,body:near,remaining:[],phase:'playing',
  }));
  assert.match(farHtml,/data-mouth-pose="idle"/);
  assert.doesNotMatch(farHtml,/data-source-apple=/);
  const biteHtml=renderToStaticMarkup(createElement(AppleWormReferenceScene,{
    board,body:near,remaining:[],phase:'playing',
    biteFx:{key:1,apple},
  }));
  assert.match(biteHtml,/data-mouth-pose="chewing"/);
  assert.match(biteHtml,/data-apple-bite-fx=/);
  assert.doesNotMatch(biteHtml,/data-source-apple=/);
  const crumbAnchor='transform="translate('+((apple[0]+.5)*30)+' '+((apple[1]+.5)*30)+')"';
  assert.ok(biteHtml.includes(crumbAnchor));
});

test('every known exit renders as an open animated portal even with optional apples present',()=>{
  for(let level=1;level<=105;level++){
    const board=screenshotWormLevel(level);
    const html=renderToStaticMarkup(createElement(AppleWormReferenceScene,{
      board,body:board.worm,remaining:board.apples,phase:'playing',
    }));
    if(board.portal){
      assert.match(html,/worm-portal-ready/,'Stage '+level+' exit must always be active');
      assert.match(html,/worm-portal-orbit/,'Stage '+level+' exit should have continuous energy');
      assert.match(html,/worm-portal-spark/);
    }
  }
});

test('winning adds victory rings without relocating the known stage exit',()=>{
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
