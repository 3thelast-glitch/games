import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {wormLevel,startWorm} from '../packages/games/apple-worm/engine.ts';
import {AppleWormCover,cellContour,WormApple,WormCharacter,WormPortal,WormSky,WormTerrain} from '../apps/mobile/src/AppleWormArt.tsx';

test('continuous bright worm shape and rich grass-topped earth blocks',()=>{
 const board=wormLevel(1),body=startWorm().body;
 const outline=cellContour(body,48,.31);
 assert.ok(outline.startsWith('M'));
 assert.match(outline,/Q/);
 assert.doesNotMatch(outline,/NaN|Infinity/);
 assert.equal((outline.match(/M/g)??[]).length,1);
 const terrain=renderToStaticMarkup(<WormTerrain blocks={board.blocks} tile={48}/>);
 assert.match(terrain,/worm-terrain/);
 assert.match(terrain,/#8c6548/);
 assert.match(terrain,/#86d55a/);
 assert.match(terrain,/worm-grass-color/);
 assert.doesNotMatch(terrain,/NaN|Infinity/);
});
test('render live glowing apple, detailed friendly caterpillar and portal destination',()=>{
 const body=[{x:3,y:3},{x:2,y:3},{x:1,y:3}];
 const worm=renderToStaticMarkup(<WormCharacter body={body} tile={48} id="test"/>);
 assert.match(worm,/worm-character/);
 assert.match(worm,/#79e94a/);
 assert.match(worm,/#202d35/);
 assert.match(worm,/clipPath/);
 assert.doesNotMatch(worm,/NaN|Infinity/);
 const apple=renderToStaticMarkup(<WormApple x={2} y={3}/>);
 assert.match(apple,/worm-apple/);
 assert.match(apple,/worm-apple-glow/);
 assert.match(apple,/#fc5039/);
 const portal=renderToStaticMarkup(<WormPortal x={5} y={4} ready/>);
 assert.match(portal,/worm-portal-ready/);
 assert.match(portal,/#73f9df/);
 assert.doesNotMatch(portal,/NaN|Infinity/);
});
test('bright layered floating-island background with water, sunshine and distant cloudscapes',()=>{
 const sky=renderToStaticMarkup(<WormSky width={480} height={444} id="test"/>);
 assert.match(sky,/#59b7fa/);
 assert.match(sky,/#b18e79/);
 assert.match(sky,/#fffdf4/);
 assert.match(sky,/worm-clouds/);
 assert.doesNotMatch(sky,/NaN|Infinity/);
});
test('original library cover renders same dynamic meadow art',()=>{
 const cover=renderToStaticMarkup(<AppleWormCover/>);
 assert.match(cover,/viewBox="0 0 480 444"/);
 assert.match(cover,/preserveAspectRatio="xMidYMid slice"/);
 assert.match(cover,/worm-character/);
 assert.match(cover,/worm-apple/);
 assert.match(cover,/worm-terrain/);
 assert.doesNotMatch(cover,/NaN|Infinity/);
});
test('40 authored levels preserve collision geometry with a finite SVG contour',()=>{
 for(let level=1;level<=40;level++){
  const terrain=cellContour(wormLevel(level).blocks,48,.1);
  const body=cellContour(startWorm(level).body,48,.31);
  assert.ok(terrain.length>10&&body.length>10);
  assert.doesNotMatch(terrain+body,/NaN|Infinity/);
 }
});
