import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayAppleWormRoute } from '../packages/games/apple-worm/solvability.ts';
import type { ScreenshotDirection } from '../packages/games/apple-worm/screenshot-game.ts';

/**
 * Guardrail for every physics/geometry change in the Apple Worm engine.
 *
 * The fixture is generated ONLY by scripts/apple-worm-audit.ts (never by
 * hand). Every route in it was produced by the solver and replay-verified
 * at generation time; this test replays each one again through the real
 * engine. If a future engine change breaks a previously proven stage, this
 * test — not a stale document — is what fails.
 */
interface ProvenRoutesFixture {
  generatedBy: string;
  source: string;
  totalStages: number;
  provenCount: number;
  provenStages: number[];
  exhaustedStages: number[];
  budgetStages: number[];
  missingExitStages: number[];
  routes: Record<string, string>;
}

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/apple-worm-proven-routes.json', import.meta.url), 'utf8'),
) as ProvenRoutesFixture;

const DIRECTIONS: Record<string, ScreenshotDirection> = {
  U: 'up',
  R: 'right',
  D: 'down',
  L: 'left',
};

test('proven-routes fixture is internally consistent', () => {
  assert.equal(fixture.generatedBy, 'scripts/apple-worm-audit.ts');
  assert.equal(fixture.totalStages, 105);
  const routed = Object.keys(fixture.routes).map(Number).sort((a, b) => a - b);
  assert.deepEqual(routed, [...fixture.provenStages].sort((a, b) => a - b));
  assert.equal(fixture.provenCount, fixture.provenStages.length);
  const classified =
    fixture.provenStages.length +
    fixture.exhaustedStages.length +
    fixture.budgetStages.length +
    fixture.missingExitStages.length;
  assert.equal(classified, 105, 'every stage must be in exactly one status class');
  for (const route of Object.values(fixture.routes))
    assert.match(route, /^[URDL]+$/, 'routes use U/R/D/L letters only');
});

test('every proven route still replays to a real engine win', { timeout: 120_000 }, () => {
  for (const [stageText, letters] of Object.entries(fixture.routes)) {
    const stage = Number(stageText);
    const route = [...letters].map((ch) => DIRECTIONS[ch]!);
    const replay = replayAppleWormRoute(stage, route, { source: 'full-video' });
    assert.equal(replay.legalMoves, route.length, `route for stage ${stage} was blocked mid-way`);
    assert.equal(replay.won, true, `route for stage ${stage} no longer wins`);
    assert.equal(replay.state.phase, 'won', `stage ${stage} did not end in phase "won"`);
  }
});
