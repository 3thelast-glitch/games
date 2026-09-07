import assert from 'node:assert/strict';
import test from 'node:test';
import { games } from '../packages/games/registry.ts';
import {
  LAN_PROTOCOL_VERSION,
  LAN_RULESET_VERSION,
  LanAuthority,
  parseLanEndpoint,
  type LanServerMessage,
} from '../packages/core/src/lan.ts';

function ids() {
  let value = 0;
  return () => `id-${String(++value).padStart(8, '0')}`;
}

function authority(now: () => number = () => 1_000) {
  return new LanAuthority({
    game: games.get('reversi'),
    hostName: 'Host',
    roomName: 'Board Arena LAN',
    roomId: 'room-00000001',
    hostSeat: 0,
    now,
    randomId: ids(),
  });
}

function joinGuest(host: LanAuthority, resumeToken?: string) {
  const reply = host.join({
    type: 'hello',
    protocolVersion: LAN_PROTOCOL_VERSION,
    rulesetVersion: LAN_RULESET_VERSION,
    roomId: host.roomId,
    name: 'Guest',
    ...(resumeToken ? { resumeToken } : {}),
  });
  assert.equal(reply.type, 'welcome');
  return reply as Extract<LanServerMessage, { type: 'welcome' }>;
}

function start(host: LanAuthority) {
  const guest = joinGuest(host);
  host.hostReady(true);
  const started = host.handle(guest.resumeToken, { type: 'ready', ready: true });
  assert.equal(started.type, 'snapshot');
  assert.equal(host.snapshot().status, 'playing');
  return guest;
}

test('LAN endpoint parser accepts IPv4/host/IPv6 and rejects unsafe input', () => {
  assert.deepEqual(parseLanEndpoint('192.168.1.20:9000'), { host: '192.168.1.20', port: 9000 });
  assert.deepEqual(parseLanEndpoint('board-arena.local'), { host: 'board-arena.local', port: 8765 });
  assert.deepEqual(parseLanEndpoint('[fe80::1]:8765'), { host: 'fe80::1', port: 8765 });
  for (const value of ['', 'https://example.com', 'host:0', 'host:70000', 'name/path', 'host port'])
    assert.throws(() => parseLanEndpoint(value), /invalid-lan-address/);
});

test('LAN authority authenticates a two-player lobby and starts only after both are ready', () => {
  const host = authority();
  assert.equal(host.advertisement(8765).occupancy, 1);
  const guest = joinGuest(host);
  assert.equal(guest.self, 1);
  assert.equal(host.snapshot().players.length, 2);
  assert.equal(host.snapshot().status, 'lobby');
  host.hostReady(true);
  assert.equal(host.snapshot().status, 'lobby');
  host.handle(guest.resumeToken, { type: 'ready', ready: true });
  const snapshot = host.snapshot();
  assert.equal(snapshot.status, 'playing');
  assert.ok(snapshot.matchId);
  assert.equal(snapshot.state?.turn, 0);
  assert.equal(snapshot.revision, 0);
});

test('LAN move authority binds the actor, validates Reversi, versions state and deduplicates retries', () => {
  const host = authority();
  start(host);
  const matchId = host.snapshot().matchId!;
  const command = {
    type: 'move' as const,
    matchId,
    actionId: 'action-00000001',
    expectedRevision: 0,
    move: { row: 2, col: 3 },
  };
  const first = host.handle(host.hostToken, command);
  assert.equal(first.type, 'snapshot');
  assert.equal((first as Extract<LanServerMessage, { type: 'snapshot' }>).ack, command.actionId);
  assert.equal(host.snapshot().revision, 1);
  assert.deepEqual((host.snapshot().state as unknown as { scores: [number, number] }).scores, [4, 1]);

  const retry = host.handle(host.hostToken, command);
  assert.deepEqual(retry, first);
  assert.equal(host.snapshot().revision, 1);

  const reused = host.handle(host.hostToken, { ...command, move: { row: 3, col: 2 } });
  assert.equal(reused.type, 'error');
  assert.equal((reused as Extract<LanServerMessage, { type: 'error' }>).code, 'action-id-reused');
  assert.equal(host.snapshot().revision, 1);

  const wrongTurn = host.handle(host.hostToken, {
    type: 'move',
    matchId,
    actionId: 'action-00000002',
    expectedRevision: 1,
    move: { row: 0, col: 0 },
  });
  assert.equal(wrongTurn.type, 'error');
  assert.equal((wrongTurn as Extract<LanServerMessage, { type: 'error' }>).code, 'not-your-turn');
});

test('LAN guest resumes the same seat and canonical state during grace; expiry is interruption, not a fabricated win', () => {
  let now = 10_000;
  const host = authority(() => now);
  const guest = start(host);
  host.hostMove({ row: 2, col: 3 });
  const before = host.snapshot();
  host.disconnect(guest.resumeToken);
  now += 5_000;
  const resumed = joinGuest(host, guest.resumeToken);
  assert.equal(resumed.self, guest.self);
  assert.equal(resumed.snapshot.matchId, before.matchId);
  assert.equal(resumed.snapshot.revision, before.revision);
  assert.deepEqual(resumed.snapshot.state, before.state);

  host.disconnect(guest.resumeToken);
  now += 61_000;
  const expired = host.tick();
  assert.equal(expired.status, 'interrupted');
  assert.deepEqual(expired.result, { winner: null, reason: 'connection-lost' });
});

test('LAN rematch uses a fresh epoch and swaps Black/White seats', () => {
  const host = authority();
  const guest = start(host);
  const firstMatch = host.snapshot().matchId!;
  for (let safety = 0; safety < 60 && host.snapshot().status === 'playing'; safety++) {
    const current = host.snapshot();
    const legal = games.get('reversi').legalMoves(current.state!);
    assert.ok(legal.length > 0, 'engine resolves forced pass without a client PASS command');
    const seat = current.state!.turn;
    const token = seat === host.hostSeat ? host.hostToken : guest.resumeToken;
    const reply = host.handle(token, {
      type: 'move',
      matchId: current.matchId!,
      actionId: `play-${String(safety).padStart(8, '0')}`,
      expectedRevision: current.revision,
      move: legal[0],
    });
    assert.equal(reply.type, 'snapshot');
  }
  assert.equal(host.snapshot().status, 'finished');
  const oldHostSeat = host.hostSeat;
  host.handle(host.hostToken, { type: 'rematch', matchId: firstMatch });
  const waiting = host.snapshot();
  assert.deepEqual(waiting.rematchVotes, [oldHostSeat]);
  host.handle(guest.resumeToken, { type: 'rematch', matchId: firstMatch });
  const rematch = host.snapshot();
  assert.equal(rematch.status, 'playing');
  assert.notEqual(rematch.matchId, firstMatch);
  assert.equal(host.hostSeat, oldHostSeat === 0 ? 1 : 0);
  assert.equal(rematch.revision, 0);
  assert.equal(rematch.state?.ply, 0);
});
