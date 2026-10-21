import {test} from 'node:test';
import assert from 'node:assert/strict';
import { replayAppleWormRoute } from '../packages/games/apple-worm/solvability.ts';
import { BATCH_TWO_WALL_CONTACT_STAGES }
  from '../packages/games/apple-worm/wall-support-batch-2.ts';
import {
  BATCH_TWO_15,
} from '../packages/games/apple-worm/video-start-poses-batch-2.ts';
import {screenshotWormLevel,startScreenshotWorm,moveScreenshotWorm}
  from '../packages/games/apple-worm/screenshot-game.ts';
import type { ScreenshotDirection } from '../packages/games/apple-worm/screenshot-game.ts';

/** Replayable routes computed under actual engine transition rules.
 * These are not teleports and do NOT skip movement, wall or fruit collision.
 * The other eight batch-two levels have shorter BFS-produced route proofs.
 */
const CODED_ROUTES={
  "49": "ULLLLLLLULLLUL",
  "51": "RRDDLDDRDLLURUURRUURRRR",
  "58": "URRDDLLULLDRRRRUUUULLLUUUURRURRRRRDDDLLDRRUUUULLLULLLULLLLLLL",
  "59": "RDDDDDRDLULURUUULLLLLL",
  "71": "URRRRUURRRRDDDLL",
  "73": "ULLLLLDDDDDDL",
  "97": "ULDLLLUUURRRRRRRRRRRRRRRDDLLULLLULLDRRRRUUULULLLLULLLLLLLDLDLDDRRDRRRRRRU"
} as const;
const key:Record<string,ScreenshotDirection>={
  U:'up',R:'right',D:'down',L:'left',
};
export const BATCH_TWO_EXTENDED_WIN_ROUTES:
  Readonly<Record<number,readonly ScreenshotDirection[]>>=
    Object.fromEntries(Object.entries(CODED_ROUTES).map(([n,encoded])=>
      [Number(n),[...encoded].map(char=>key[char]!)]));

test('only five source-video batch-two stages gain side-wall support',()=>{
  assert.deepEqual([...BATCH_TWO_WALL_CONTACT_STAGES].sort((a,b)=>a-b),
    [49,59,71,73,97]);
  assert.ok([...BATCH_TWO_WALL_CONTACT_STAGES].every(n=>
    BATCH_TWO_15.includes(n as typeof BATCH_TWO_15[number])));
});

test('replay seven formerly unplayable second-batch stages to real in-engine victory',()=>{
  for(const [n,directions] of Object.entries(BATCH_TWO_EXTENDED_WIN_ROUTES)){
    const level=Number(n);
    const game=replayAppleWormRoute(level,directions,{source:'legacy'});
    assert.equal(game.legalMoves,directions.length,
      'all moves must be accepted by actual engine, stage '+level);
    assert.equal(game.won,true,'real portal victory needed on stage '+level);
    assert.equal(game.state.phase,'won');
    assert.deepEqual(game.state.body[0],screenshotWormLevel(level,'legacy').portal);
    assert.ok(directions.length>=10);
  }
});

test('video start fruit and gray blockers are present before gameplay, not invented during play',()=>{
  assert.deepEqual(screenshotWormLevel(51,'legacy').apples.at(-1),[9,-1]);
  assert.deepEqual(screenshotWormLevel(58,'legacy').apples.at(-1),[9,-2]);
  assert.deepEqual(screenshotWormLevel(97,'legacy').apples.slice(-2),[[9,-1],[17,5]]);
  assert.deepEqual(screenshotWormLevel(97,'legacy').grayObjects,
    [[9,-2],[9,0],[2,4],[17,4]]);
  const original=startScreenshotWorm(49,'legacy');
  assert.equal(original.body.length,4);
  assert.ok(moveScreenshotWorm(original,'up',screenshotWormLevel(49,'legacy'))!==original);
});
