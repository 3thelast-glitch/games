import {test} from 'node:test';
import assert from 'node:assert/strict';
import type { ScreenshotDirection } from '../packages/games/apple-worm/screenshot-game.ts';
import { replayAppleWormRoute }
  from '../packages/games/apple-worm/solvability.ts';

/**
 * THESE ARE REAL GAME-ENGINE ROUTES after video-matched initial body and
 * apple-supported gray crate physics. Replayed from an empty save, never a
 * teleport or a forced completion. The user's source video remains the
 * visual/physics reference; these are verified NAQLA winning inputs.
 */
export const FIRST_BATCH_RECOVERED_ROUTES:Readonly<Record<number,readonly ScreenshotDirection[]>>={
  14:'right right up up right down left up right right up up up right right right down down left'.split(' ') as ScreenshotDirection[],
  18:'up up right right down left left left left up right right up up up right right right right right down down left'.split(' ') as ScreenshotDirection[],
  20:'up left left left left left up up right up up right right down left left left down down right up right down left left up right down right right right right right up right up up up left left down right right right down down left up left left down right right up up up left up right right up right right right'.split(' ') as ScreenshotDirection[],
};

test('all three formerly stuck batch-1 stages have deterministic replay-proven victories',()=>{
  for(const [stageStr,route] of Object.entries(FIRST_BATCH_RECOVERED_ROUTES)){
    const stage=Number(stageStr);
    const replay=replayAppleWormRoute(stage,route);
    assert.equal(replay.legalMoves,route.length,
      'stage '+stage+' contains an illegal attempt in its winning route');
    assert.equal(replay.won,true,
      'stage '+stage+' route must end in the REAL game win state');
    assert.equal(replay.state.phase,'won');
    assert.ok(route.length>=10);
  }
});
