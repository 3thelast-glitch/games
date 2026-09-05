import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { MatchCommand } from '../packages/core/src/protocol.ts';
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost:5173',
});
Object.assign(globalThis, {
  window: dom.window,
  location: dom.window.location,
  localStorage: dom.window.localStorage,
  matchMedia: () => ({ matches: false }),
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  constructor(public url: URL) {
    Socket.instances.push(this);
  }
  send(message: string) {
    this.sent.push(message);
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}
Object.defineProperty(globalThis, 'WebSocket', { value: Socket, configurable: true });
const { ArenaConnection } = await import('../apps/mobile/src/network.ts');
const { storage } = await import('../apps/mobile/src/platform.ts');
const latest = () => Socket.instances.at(-1)!;
test('switching identities ignores close and message events from the old socket', async () => {
  const client = new ArenaConnection();
  try {
    await client.start('first-token-'.repeat(4));
    const old = latest();
    old.open();
    old.receive({ type: 'ready', userId: 'a', serverNow: Date.now() });
    assert.ok(client.isReady);
    await client.start('second-token-'.repeat(4));
    const current = latest();
    current.open();
    current.receive({ type: 'ready', userId: 'b', serverNow: Date.now() });
    old.onclose?.();
    old.receive({ type: 'error', code: 'unauthorized' });
    assert.ok(client.isReady);
    assert.equal(new URL(current.url).search, '');
    assert.equal(JSON.parse(current.sent[0]).token, 'second-token-'.repeat(4));
  } finally {
    client.stop();
  }
});
test('pending commands survive reload, replay after authentication and clear on acknowledgement', async () => {
  const token = 'pending-test-'.repeat(4),
    command: MatchCommand = {
      type: 'move',
      matchId: 'match-a',
      commandId: 'command-12345678',
      expectedRevision: 2,
      move: { kind: 'pawn', to: [7, 4] },
    };
  await storage.set(`pending:${token.slice(0, 12)}`, [command]);
  await storage.set(`last-match:${token.slice(0, 12)}`, 'match-a');
  const client = new ArenaConnection();
  try {
    await client.start(token);
    const socket = latest();
    socket.open();
    socket.receive({ type: 'ready', userId: 'a', serverNow: Date.now() });
    assert.deepEqual(
      socket.sent.slice(1).map((s) => JSON.parse(s)),
      [{ type: 'resume', matchId: 'match-a' }, command],
    );
    assert.ok(client.hasPending);
    assert.throws(() => client.submit({ ...command, commandId: 'second-command' }), /pendingMove/);
    socket.receive({ type: 'match', match: { id: 'match-a' }, ack: command.commandId });
    assert.ok(!client.hasPending);
  } finally {
    client.stop();
  }
});
test('stopping during async storage restoration does not create a new connection', async () => {
  const client = new ArenaConnection(),
    before = Socket.instances.length;
  const start = client.start('cancel-start-'.repeat(4));
  client.stop();
  await start;
  assert.equal(Socket.instances.length, before);
  assert.ok(!client.isReady);
});
