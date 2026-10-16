import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../apps/server/src/store.ts';
import { AuthService } from '../apps/server/src/auth.ts';
import { createArenaServer } from '../apps/server/src/server.ts';

const configured = {
  APP_URL: 'https://naqla.example.test',
  RESEND_API_KEY: 'unit-test-only',
  NAQLA_EMAIL_FROM: 'NAQLA <security@naqla.example.test>',
} as NodeJS.ProcessEnv;

test('single-use verification and password reset: tokens hashed, expiring, and all sessions revoked', async () => {
  const store = new Store();
  const messages: { to: string; subject: string; text: string }[] = [];
  const auth = new AuthService(store, configured, async (to, subject, text) => {
    messages.push({ to, subject, text });
  });
  try {
    const user = await auth.register('verified@example.test', 'original-secret-123', 'Verified Player');
    assert.equal(store.user(user.id).email_verified_at, null);
    const oldSessionA = store.newSession(user.id);
    const oldSessionB = store.newSession(user.id);
    await auth.requestEmailVerification(user.id);
    assert.equal(messages.length, 1);
    const verifyLink = messages[0].text.match(/https:\/\/\S+/)?.[0];
    assert.ok(verifyLink);
    const verifyToken = new URL(verifyLink).searchParams.get('verifyEmail')!;
    assert.ok(verifyToken);
    const tokens = store.db.prepare('SELECT hash FROM account_tokens').all() as { hash: string }[];
    assert.equal(tokens.length, 1);
    assert.notEqual(tokens[0].hash, verifyToken, 'Token must never be stored in plaintext');
    auth.verifyEmail(verifyToken);
    assert.ok(store.user(user.id).email_verified_at);
    assert.throws(() => auth.verifyEmail(verifyToken), /invalid-account-token/);

    await auth.requestPasswordReset('unknown@example.test');
    assert.equal(messages.length, 1, 'Unknown account must not receive mail');
    await auth.requestPasswordReset('verified@example.test');
    assert.equal(messages.length, 2);
    const resetLink = messages[1].text.match(/https:\/\/\S+/)?.[0];
    assert.ok(resetLink);
    const resetToken = new URL(resetLink).searchParams.get('resetPassword')!;
    assert.ok(resetToken);
    const updatedId = await auth.resetPassword(resetToken, 'new-strong-secret-456');
    assert.equal(updatedId, user.id);
    assert.throws(() => store.authenticate(oldSessionA), /unauthorized/);
    assert.throws(() => store.authenticate(oldSessionB), /unauthorized/);
    await assert.rejects(() => auth.resetPassword(resetToken, 'another-strong-secret-789'), /invalid-account-token/);
    await assert.rejects(() => auth.login('verified@example.test', 'original-secret-123'), /invalid-credentials/);
    assert.equal((await auth.login('verified@example.test', 'new-strong-secret-456')).id, user.id);

    await auth.requestPasswordReset('verified@example.test');
    const expired = new URL(messages.at(-1)!.text.match(/https:\/\/\S+/)![0]).searchParams.get('resetPassword')!;
    store.db.prepare("UPDATE account_tokens SET expires_at=0 WHERE purpose='password-reset'").run();
    await assert.rejects(() => auth.resetPassword(expired, 'will-not-be-set-789'), /invalid-account-token/);
  } finally { store.close(); }
});

test('public reset endpoint fails closed without configured transactional email', async () => {
  const store = new Store();
  const app = createArenaServer({ store, env: { DATABASE_PATH: ':memory:' } });
  app.server.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => app.server.once('listening', resolve));
  const addr = app.server.address();
  if (!addr || typeof addr === 'string') throw new Error('Expected port');
  try {
    const response = await fetch(`http://127.0.0.1:${addr.port}/api/auth/password/reset/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unknown@example.test' }),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json() as { error: string }).error, 'email-not-configured');
  } finally {
    await app.close();
    store.close();
  }
});
