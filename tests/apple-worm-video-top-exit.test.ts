import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  screenshotWormLevel,startScreenshotWorm,moveScreenshotWorm,restoreScreenshotWorm,
} from '../packages/games/apple-worm/screenshot-game.ts';

/**
 * This is grounded in the user's COMPLETE video, NOT invented portal coords:
 * L70 finishes with the worm ascending beyond the top ~1779s,
 * L95 ~2570s, and L101 ~2707s. Source video shows apples still present.
 */
test('filmed portal-free stages 70,95,101 have an explicit upper-boundary victory',()=>{
  for(const n of [70,95,101]){
    const stage=screenshotWormLevel(n);
    assert.equal(stage.portal,null,'do not fabricate source spiral L'+n);
    assert.equal(stage.exitMode,'top-boundary');
    assert.ok(!stage.issues.includes('portal-unresolved'));
    // This is a STRICT transition test, not a proof that untouched stage can
    // reach this pre-exit pose using the current provisional physics.
    const before={...startScreenshotWorm(n),body:[[7,-2],[7,-1],[7,0]] as const};
    const win=moveScreenshotWorm(before,'up',stage);
    assert.equal(win.phase,'won');
    assert.equal(win.moves,before.moves+1);
    assert.deepEqual(win.body[0],[7,-3]);
    assert.deepEqual(win.collected,before.collected);
    assert.deepEqual(restoreScreenshotWorm(win),win,
      'saved game must retain the valid video ending L'+n);
  }
});
test('no other stage receives a top-screen escape or fabricated spiral',()=>{
  for(const n of [1,2,3,60,69,71,94,96,99,100,102,103,105]){
    const stage=screenshotWormLevel(n);
    assert.equal(stage.exitMode,'spiral');
    const before={...startScreenshotWorm(n),body:[[7,-2],[7,-1],[7,0]] as const};
    const outside=moveScreenshotWorm(before,'up',stage);
    assert.equal(outside,before,'do not allow new exit outside the filmed exceptions L'+n);
  }
});
test('old cropped-clip replay fixtures cannot silently inherit new video top-exit rules',()=>{
  for(const n of [70,95,101]){
    const legacy=screenshotWormLevel(n,'legacy');
    assert.equal(legacy.portal,null);
    assert.equal(legacy.exitMode,'unknown');
  }
});
