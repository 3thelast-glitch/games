import { test } from 'node:test';
import { assertEmptyPoolTimeoutBroadcast } from './digital-timeout-race-helper.ts';

test('Digital empty-pool timeout broadcasts the same revision, turn and shared state to every client', async () => {
  await assertEmptyPoolTimeoutBroadcast(3, 'Timeout3');
});
