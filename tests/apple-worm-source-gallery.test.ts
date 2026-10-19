import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppleWormSourceGallery } from '../apps/mobile/src/AppleWormSourceGallery.tsx';
import { AppleWormVideoPlaytest, APPLE_WORM_VIDEO_PLAYTEST_LEVEL_COUNT }
  from '../apps/mobile/src/AppleWormVideoPlaytest.tsx';

test('the retired 105-stage preview route redirects to the ONE approved interactive Apple Worm game',()=>{
  const html=renderToStaticMarkup(createElement(AppleWormSourceGallery,{
    lang:'en',onClose:()=>{},
  }));
  assert.match(html,/approved 105-stage Apple Worm game/);
  assert.doesNotMatch(html,/Legacy practice|Reference snapshots|not playable|40, not video/i);
  assert.doesNotMatch(html,/150 stages/);
});

test('the former Arabic gallery no longer calls user-approved source stages unplayable',()=>{
  const html=renderToStaticMarkup(createElement(AppleWormSourceGallery,{
    lang:'ar',onClose:()=>{},
  }));
  assert.match(html,/المراحل الـ105 المعتمدة/);
  assert.doesNotMatch(html,/40 غير معتمدة|ليست قابلة للعب|صور مرجعية/);
});

test('previous video playtest helper remains isolated from the public game',()=>{
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
  assert.doesNotMatch(html,/100% (?:source-matched|video-accurate|verified)/i);
});
