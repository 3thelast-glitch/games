import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../apps/server/src/store.ts';
import { createArenaServer } from '../apps/server/src/server.ts';

test('all-device logout and password change revoke sessions, rejecting old credentials', async () => {
  const store = new Store();
  const app = createArenaServer({ store, allowedOrigins: ['http://localhost'] });
  app.server.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => app.server.once('listening', resolve));
  const addr = app.server.address();
  if (!addr || typeof addr === 'string') throw new Error('Expected TCP listener');
  const origin = `http://127.0.0.1:${addr.port}`;
  async function post(path: string, data: Record<string, string>, token?: string) {
    const res = await fetch(origin + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(data),
    });
    return { status: res.status, data: await res.json() as Record<string, any> };
  }
  async function profile(token: string) {
    return fetch(origin + '/api/profile', { headers: { Authorization: `Bearer ${token}` } });
  }
  try {
    const register = await post('/api/auth/register', {
      name: 'Security Player', email: 'security@example.test', password: 'original-password-123',
    });
    assert.equal(register.status, 201);
    const tokenA = register.data.token as string;
    const sessionB = await post('/api/auth/login', {
      email: 'security@example.test', password: 'original-password-123',
    });
    assert.equal(sessionB.status, 200);
    const tokenB = sessionB.data.token as string;
    assert.equal((await profile(tokenB)).status, 200);

    const revoked = await post('/api/auth/logout-all', {}, tokenA);
    assert.equal(revoked.status, 200);
    assert.equal((await profile(tokenA)).status, 401);
    assert.equal((await profile(tokenB)).status, 401);

    const sessionC = await post('/api/auth/login', {
      email: 'security@example.test', password: 'original-password-123',
    });
    assert.equal(sessionC.status, 200);
    const tokenC = sessionC.data.token as string;
    const wrong = await post('/api/auth/password/change', {
      currentPassword: 'not-the-right-password', nextPassword: 'next-password-secure-456',
    }, tokenC);
    assert.equal(wrong.status, 400);
    assert.equal((await profile(tokenC)).status, 200);

    const changed = await post('/api/auth/password/change', {
      currentPassword: 'original-password-123', nextPassword: 'next-password-secure-456',
    }, tokenC);
    assert.equal(changed.status, 200);
    assert.equal(changed.data.sessionsRevoked, true);
    assert.equal((await profile(tokenC)).status, 401);
    assert.equal((await post('/api/auth/login', {
      email: 'security@example.test', password: 'original-password-123',
    })).status, 400);
    const fresh = await post('/api/auth/login', {
      email: 'security@example.test', password: 'next-password-secure-456',
    });
    assert.equal(fresh.status, 200);
    assert.equal((await profile(fresh.data.token as string)).status, 200);
  } finally {
    await app.close();
    store.close();
  }
});
