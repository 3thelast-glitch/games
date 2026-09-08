import assert from 'node:assert/strict';
import test from 'node:test';
import { games } from '../packages/games/registry.ts';
import { LAN_PROTOCOL_VERSION, LAN_RULESET_VERSION, LanAuthority } from '../packages/core/src/lan.ts';

function ids() {
  let n = 0;
  return () => `clock-${String(++n).padStart(8, '0')}`;
}

function setup(turnSeconds: 15 | null) {
  let now = 1_000;
  const host = new LanAuthority({
    game: games.get('reversi'),
    hostName: 'Host',
    roomId: 'clock-room-01',
    hostSeat: 0,
    turnSeconds,
    now: () => now,
    randomId: ids(),
  });
  const joined = host.join({
    type: 'hello',
    protocolVersion: LAN_PROTOCOL_VERSION,
    rulesetVersion: LAN_RULESET_VERSION,
    roomId: host.roomId,
    name: 'Guest',
  });
  assert.equal(joined.type, 'welcome');
  if (joined.type !== 'welcome') throw new Error('join failed');
  host.hostReady(true);
  host.handle(joined.resumeToken, { type: 'ready', ready: true });
  return { host, guest: joined, setNow: (value: number) => { now = value; } };
}

test('Reversi LAN Off preserves the normal ten-minute per-player bank', () => {
  const { host, setNow } = setup(null);
  const start = host.snapshot();
  assert.deepEqual(start.timeControl, { mode: 'bank', initialMs: 600_000 });
  assert.deepEqual(start.clockMs, [600_000, 600_000]);
  setNow(6_000);
  const accepted = host.hostMove({ row: 2, col: 3 }, 'bank-action-01');
  assert.equal(accepted.type, 'snapshot');
  const next = host.snapshot();
  assert.equal(next.clockMs[0], 595_000);
  assert.equal(next.clockMs[1], 600_000);
  assert.equal(next.result, null);
});

test('Reversi LAN turn clock resets each accepted turn and authority adjudicates expiry', () => {
  const { host, setNow } = setup(15);
  const start = host.snapshot();
  assert.deepEqual(start.timeControl, { mode: 'turn', turnMs: 15_000 });
  assert.deepEqual(start.clockMs, [15_000, 15_000]);
  setNow(10_000);
  host.hostMove({ row: 2, col: 3 }, 'turn-action-01');
  const afterMove = host.snapshot();
  assert.deepEqual(afterMove.clockMs, [15_000, 15_000]);
  assert.equal(afterMove.state?.turn, 1);
  setNow(25_000);
  const timedOut = host.tick();
  assert.equal(timedOut.status, 'finished');
  assert.deepEqual(timedOut.result, { winner: 0, reason: 'timeout' });
  assert.equal(timedOut.clockMs[1], 0);
});
