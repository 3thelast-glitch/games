import { test } from 'node:test';
import { assertDrawOfferRevisionRace } from './digital-timeout-race-helper.ts';

test('four Digital clients racing the same revision accept one action and reject three as stale', async () => {
  await assertDrawOfferRevisionRace(4, 'QuadRace4');
});
