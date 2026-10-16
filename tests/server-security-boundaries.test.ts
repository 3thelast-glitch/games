import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { Store } from '../apps/server/src/store.ts';
import { createArenaServer } from '../apps/server/src/server.ts';
import type { ServerMessage } from '../packages/core/src/protocol.ts';

test('HTTP rejects untrusted origins and oversized JSON before creating guest accounts', async () => {
  const store = new Store();
  const app = createArenaServer({ store, env: {}, allowedOrigins: ['http://localhost'] });
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
  try {
    const denied = await fetch(base + '/api/auth/guest', {
      method: 'POST',
      headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Attacker' }),
    });
    assert.equal(denied.status, 403);
    assert.deepEqual(await denied.json(), { error: 'origin-not-allowed' });

    const large = await fetch(base + '/api/auth/guest', {
      method: 'POST',
      headers: { Origin: 'http://localhost', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Oversized', data: 'x'.repeat(17000) }),
    });
    assert.equal(large.status, 400);
    assert.deepEqual(await large.json(), { error: 'request-too-large' });

    const forged = await fetch(base + '/api/auth/guest', {
      method: 'POST',
      headers: { Origin: 'http://localhost', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Okay', rating: 9999 }),
    });
    assert.equal(forged.status, 400);
    assert.deepEqual(await forged.json(), { error: 'invalid-request' });
    const count = store.db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };
    assert.equal(count.count, 0, 'no failed request may persist a new account');
  } finally {
    await app.close();
    store.close();
  }
});

test('WebSocket does not process game commands without authenticating first', async () => {
  const store = new Store();
  const app = createArenaServer({ store, env: {}, allowedOrigins: ['http://localhost'] });
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const port = (app.server.address() as { port: number }).port;
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: 'http://localhost' });
  try {
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });
    const response = new Promise<ServerMessage>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Unauthenticated WS response timeout')), 3000);
      ws.once('message', (data) => {
        clearTimeout(timer);
        resolve(JSON.parse(data.toString()) as ServerMessage);
      });
    });
    ws.send(JSON.stringify({ type: 'create-room', gameId: 'connectFour' }));
    assert.deepEqual(await response, { type: 'error', code: 'unauthorized' });
    assert.equal(app.lobby.rooms.size, 0);
  } finally {
    ws.terminate();
    await app.close();
    store.close();
  }
});
