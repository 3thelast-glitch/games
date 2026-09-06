import { test } from 'node:test';
import { assertDrawOfferRevisionRace } from './digital-timeout-race-helper.ts';

test('three of four Digital clients racing the same revision accept exactly one action after timeout', async () => {
  await assertDrawOfferRevisionRace(3, 'TripleRace4');
});
