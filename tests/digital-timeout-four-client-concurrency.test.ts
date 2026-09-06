import { test } from 'node:test';
import { assertDrawOfferRevisionRace } from './digital-timeout-race-helper.ts';

test('four Digital clients accept only one concurrent action after an empty-pool timeout and stay synchronized', async () => {
  await assertDrawOfferRevisionRace(2, 'Race4');
});
