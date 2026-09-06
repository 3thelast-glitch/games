import { test } from 'node:test';
import { assertEmptyPoolTimeoutBroadcast } from './digital-timeout-race-helper.ts';

test('four Digital clients stay synchronized after an empty-pool timeout pass', async () => {
  await assertEmptyPoolTimeoutBroadcast(4, 'Timeout4');
});
