import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../apps/server/src/store.ts';
import { createArenaServer } from '../apps/server/src/server.ts';

test('original game assets are framed by NAQLA only, and strict global CSP remains', async () => {
  const root = mkdtempSync(join(tmpdir(), 'naqla-community-static-'));
  const store = new Store();
  mkdirSync(join(root, 'third-party', 'mindustry'), { recursive: true });
  mkdirSync(join(root, 'third-party', 'supertux'), { recursive: true });
  writeFileSync(join(root, 'index.html'), '<html>NAQLA</html>');
  writeFileSync(join(root, 'third-party/mindustry/index.html'), '<html>mindustry</html>');
  writeFileSync(join(root, 'third-party/supertux/supertux2.html'), '<html>supertux</html>');
  writeFileSync(join(root, 'third-party/supertux/supertux2.wasm'), Buffer.from([0, 97, 115, 109]));
  const app = createArenaServer({
    store, env: { FREECIV_WEB_ORIGIN: 'https://freeciv.example' }, staticDir: root,
    allowedOrigins: ['http://localhost'],
  });
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
  try {
    const home = await fetch(base + '/');
    assert.equal(home.headers.get('x-frame-options'), 'DENY');
    assert.match(home.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
    assert.match(home.headers.get('content-security-policy') ?? '', /frame-src 'self' https:\/\/freeciv\.example/);
    assert.doesNotMatch(home.headers.get('content-security-policy') ?? '', /unsafe-eval|wasm-unsafe-eval/);
    for (const route of ['/third-party/mindustry/index.html', '/third-party/supertux/supertux2.html']) {
      const game = await fetch(base + route);
      assert.equal(game.status, 200);
      assert.equal(game.headers.get('x-frame-options'), 'SAMEORIGIN');
      const csp = game.headers.get('content-security-policy') ?? '';
      assert.match(csp, /frame-ancestors 'self'/);
      assert.match(csp, /script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'/);
      assert.doesNotMatch(csp, /frame-ancestors 'none'/);
    }
    const wasm = await fetch(base + '/third-party/supertux/supertux2.wasm');
    assert.equal(wasm.status, 200);
    assert.equal(wasm.headers.get('content-type'), 'application/wasm');
    const missing = await fetch(base + '/third-party/mindustry/game.wasm');
    assert.equal(missing.status, 404);
  } finally {
    await app.close();
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('Freeciv frame origins cannot be set to insecure HTTP', () => {
  const store = new Store();
  try {
    assert.throws(
      () => createArenaServer({ store, env: { FREECIV_WEB_ORIGIN: 'http://example.com' } }),
      /HTTPS/,
    );
  } finally {
    store.close();
  }
});

test('Mindustry original resource prefetch cannot exhaust NAQLA account/API request limits', async () => {
  const root = mkdtempSync(join(tmpdir(), 'naqla-asset-burst-'));
  const store = new Store();
  mkdirSync(join(root, 'third-party', 'mindustry'), { recursive: true });
  writeFileSync(join(root, 'index.html'), '<html>NAQLA</html>');
  writeFileSync(join(root, 'third-party/mindustry/terrain.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const app = createArenaServer({ store, env: {}, staticDir: root });
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
  try {
    // The real upstream Mindustry manifest lists hundreds of locally bundled
    // fonts, maps, sprites and shaders, exceeding the standard 600 req/min API
    // throttle when first loading a game. These are safe same-origin GETs.
    for (let i = 0; i < 720; i++) {
      const asset = await fetch(base + '/third-party/mindustry/terrain.png');
      assert.equal(asset.status, 200, 'original local game assets must not return HTTP 429');
      await asset.arrayBuffer();
    }
    // Safe static file downloads use a DIFFERENT bounded rate-limit bucket;
    // they must not consume the existing 600/minute API budget.
    const health = await fetch(base + '/api/health');
    assert.equal(health.status, 200);
    for (let i = 0; i < 599; i++) {
      const r = await fetch(base + '/api/health');
      assert.equal(r.status, 200);
    }
    const limitedApi = await fetch(base + '/api/health');
    assert.equal(limitedApi.status, 429, 'API rate limiting must remain active');
  } finally {
    await app.close();
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});
