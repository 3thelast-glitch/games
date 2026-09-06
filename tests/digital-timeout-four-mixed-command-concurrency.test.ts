import { test } from 'node:test';
import { assertMixedRevisionRace } from './digital-timeout-race-helper.ts';

test('four Digital clients racing different commands on one revision accept exactly one and stay synchronized', async () => {
  await assertMixedRevisionRace('MixedRace4');
});
