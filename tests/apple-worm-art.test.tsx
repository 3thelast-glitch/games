import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { wormLevel, startWorm } from '../packages/games/apple-worm/engine.ts';
import {
  AppleWormCover, cellContour, WormApple, WormCharacter,
  WormPortal, WormSky, WormTerrain,
} from '../apps/mobile/src/AppleWormArt.tsx';

test('Visual art keeps separate earthy terrain and one joined worm silhouette', () => {
  const board = wormLevel(1);
  const body = startWorm().body;
  const outline = cellContour(body, 48, .31);
  assert.ok(outline.startsWith('M'));
  assert.match(outline, /Q/);
  assert.doesNotMatch(outline, /NaN|Infinity/);
  assert.equal((outline.match(/M/g) ?? []).length, 1, 'a connected worm should have one outline');
  const terrain = renderToStaticMarkup(<WormTerrain blocks={board.blocks} tile={48}/>);
  assert.match(terrain, /#57321f/);
  assert.doesNotMatch(terrain, /#4c9b3c|#69c15c/, 'terrain must not get green grass caps');
});

test('Shared graphics use an outlined green worm, a red apple and a black spiral portal', () => {
  const body = [{ x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }];
  const worm = renderToStaticMarkup(<WormCharacter body={body} tile={48} id="test"/>);
  assert.match(worm, /#064109/);
  assert.match(worm, /#b727a4/);
  assert.match(worm, /clipPath/);
  assert.doesNotMatch(worm, /NaN|Infinity/);
  const apple = renderToStaticMarkup(<WormApple x={2} y={3}/>);
  assert.match(apple, /#e32c18/);
  const portal = renderToStaticMarkup(<WormPortal x={5} y={4}/>);
  assert.match(portal, /#090b0d/);
  assert.doesNotMatch(portal, /#5673e7|#85f2f8/);
});

test('Sky remains bright blue with rays, clouds and soft distant hills', () => {
  const sky = renderToStaticMarkup(<WormSky width={480} height={444} id="test"/>);
  assert.match(sky, /#6e9df1/);
  assert.match(sky, /#96be82/);
  assert.match(sky, /#dcecf9/);
  assert.doesNotMatch(sky, /NaN|Infinity/);
});

test('Illustrated library cover renders the same vector language', () => {
  const cover = renderToStaticMarkup(<AppleWormCover/>);
  assert.match(cover, /viewBox="0 0 480 444"/);
  assert.match(cover, /preserveAspectRatio="xMidYMid slice"/);
  assert.match(cover, /worm-character/);
  assert.match(cover, /#e32c18/);
  assert.doesNotMatch(cover, /NaN|Infinity/);
});

test('All authored level ground and state shapes generate finite contours', () => {
  for (let level = 1; level <= 30; level++) {
    const terrain = cellContour(wormLevel(level).blocks, 48, .1);
    const body = cellContour(startWorm(level).body, 48, .31);
    assert.ok(terrain.length > 10 && body.length > 10);
    assert.doesNotMatch(terrain + body, /NaN|Infinity/);
  }
});
