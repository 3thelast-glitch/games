import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppleWormSourceGallery } from '../apps/mobile/src/AppleWormSourceGallery.tsx';
import { AppleWormVideoPlaytest, APPLE_WORM_VIDEO_PLAYTEST_LEVEL_COUNT }
  from '../apps/mobile/src/AppleWormVideoPlaytest.tsx';

test('the live UI exposes 105 source snapshots but does not falsely call them completed gameplay',()=>{
  const html=renderToStaticMarkup(createElement(AppleWormSourceGallery,{
    lang:'en',onClose:()=>{},
  }));
  assert.match(html,/105 stages from the original video/);
  assert.match(html,/Reference snapshots/);
  assert.match(html,/not playable or fully verified/);
  assert.match(html,/40 older generated puzzles are not video-verified/);
  assert.match(html,/Try this video-traced map \(experimental\)/);
  assert.match(html,/1–15/);
  assert.match(html,/91–105/);
  assert.match(html,/stage 1/i);
  assert.doesNotMatch(html,/150 stages/);
});

test('Arabic source gallery labels the old 40 levels as legacy unapproved',()=>{
  const html=renderToStaticMarkup(createElement(AppleWormSourceGallery,{
    lang:'ar',onClose:()=>{},
  }));
  assert.match(html,/105 مراحل من الفيديو الأصلي/);
  assert.match(html,/المراحل الأربعون القديمة ليست مطابقة للفيديو/);
  assert.match(html,/ليست قابلة للعب/);
});

test('ten source-traced boards support an isolated experimental playtest',()=>{
  assert.equal(APPLE_WORM_VIDEO_PLAYTEST_LEVEL_COUNT,10);
  const html=renderToStaticMarkup(createElement(AppleWormVideoPlaytest,{
    level:1,lang:'en',
  }));
  assert.match(html,/EXPERIMENTAL: actual video map/);
  assert.match(html,/provisional physics/);
  assert.match(html,/Swipe to test source map/);
  assert.match(html,/Restart/);
  assert.match(html,/Undo/);
  assert.match(html,/Test provisional solver/);
  assert.doesNotMatch(html,/100%/);
});
