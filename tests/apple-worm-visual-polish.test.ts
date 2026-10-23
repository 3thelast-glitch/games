import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(
  new URL('../apps/mobile/src/apple-worm-three.css', import.meta.url),
  'utf8',
);
const game = readFileSync(
  new URL('../apps/mobile/src/AppleWormScreenshotGame.tsx', import.meta.url),
  'utf8',
);

/**
 * The professional polish layer is chrome-only. These assertions pin both
 * halves of that contract: the polish exists, and the approved stage
 * rendering/geometry it must never touch is still intact.
 */
test('polish layer defines scoped design tokens and chrome upgrades', () => {
  for (const token of ['--w3-accent:', '--w3-shadow-lg:', '--w3-ease:', '--w3-glass:'])
    assert.ok(css.includes(token), `missing polish token ${token}`);
  for (const selector of [
    '.worm3-home-progress',
    '.worm3-confetti span',
    '.worm3-result-primary',
    '.worm3-level-tile[data-completed="true"]',
    '.worm3-level-tile[aria-current="step"]',
    '@keyframes w3p-confetti-fall',
    '@keyframes w3p-logo-float',
    '@keyframes w3p-play-breathe',
  ])
    assert.ok(css.includes(selector), `missing polish rule ${selector}`);
});

test('game component wires the polish hooks without changing gameplay structure', () => {
  assert.match(game, /data-completed=\{completed\.includes\(n\)\?'true':'false'\}/);
  assert.match(game, /className="worm3-home-progress"/);
  assert.match(game, /className="worm3-confetti"/);
  assert.match(game, /className="worm3-result-primary"/);
  // The approved 105-stage structure and selectors stay exactly as they were.
  assert.match(game, /data-source-stage-count=\{APPLE_WORM_SCREENSHOT_LEVEL_COUNT\}/);
  assert.match(game, /className="worm3-level-tile"/);
  assert.match(game, /className="worm3-play-button"/);
});

test('polish respects reduced motion and leaves approved scene geometry untouched', () => {
  assert.match(css, /:root\[data-reduce-motion='true'\] \.worm3 \.worm3-confetti span/);
  // Board zone geometry from the approved immersive layout is unchanged.
  assert.match(
    css,
    /\.worm3 \.worm3-board-zone \{\s*position:absolute;left:15%;top:23%;width:60%;height:64%;/,
  );
  // Saw anchoring rules from R15 remain in force.
  assert.match(css, /\.worm3 \.worm-source-saw-spinning\s*\{[^}]*transform-box:view-box/s);
  // Chrome polish does not bump the source visual revision marker.
  assert.match(game, /APPLE_WORM_VISUAL_REVISION='PDF105-R15'/);
});
