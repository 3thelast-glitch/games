import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const gate = resolve('scripts/release-gate.mjs');
const gradleSetup = resolve('scripts/configure-android-release.mjs');

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'naqla-release-gate-'));
  mkdirSync(join(dir, 'android/app'), { recursive: true });
  writeFileSync(join(dir, 'capacitor.config.ts'), readFileSync('capacitor.config.ts'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '0.1.0' }));
  writeFileSync(join(dir, 'android/app/build.gradle'), "android { buildTypes { release { signingConfig signingConfigs.debug } } }\n");
  writeFileSync(join(dir, 'upload.jks'), 'fake-for-preflight-test-only');
  const env = {
    ...process.env,
    VITE_SERVER_URL: 'https://staging.naqla.sa',
    NAQLA_RELEASE_APP_ID: 'com.boardarena.app',
    NAQLA_ANDROID_VERSION_CODE: '42',
    NAQLA_RELEASE_TRACK: 'internal',
    NAQLA_RELEASE_KEYSTORE_PATH: join(dir, 'upload.jks'),
    NAQLA_RELEASE_KEY_ALIAS: 'upload',
    NAQLA_RELEASE_STORE_PASSWORD: 'private-demo-store',
    NAQLA_RELEASE_KEY_PASSWORD: 'private-demo-key',
  };
  return { dir, env, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
function run(script: string, dir: string, env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [script], { cwd: dir, env, encoding: 'utf8' });
}

test('signed Android internal build rejects insecure and placeholder endpoints', () => {
  const f = fixture();
  try {
    const good = run(gate, f.dir, f.env);
    assert.equal(good.status, 0, good.stderr);
    for (const bad of [
      'http://arena.naqla.sa',
      'https://localhost',
      'https://127.0.0.1',
      'https://example.com',
      'https://staging.naqla.sa/api',
      'https://someuser:password@staging.naqla.sa',
      'https://staging.naqla.sa:444',
    ]) {
      const result = run(gate, f.dir, { ...f.env, VITE_SERVER_URL: bad });
      assert.equal(result.status, 1, 'invalid origin accepted: ' + bad);
      assert.match(result.stderr, /HTTPS/);
    }
  } finally { f.cleanup(); }
});

test('release preflight requires explicit app ID, signing secrets, version and internal channel', () => {
  const f = fixture();
  try {
    for (const changes of [
      { NAQLA_RELEASE_APP_ID: 'com.example.naqla' },
      { NAQLA_ANDROID_VERSION_CODE: '0' },
      { NAQLA_ANDROID_VERSION_CODE: '1.2' },
      { NAQLA_RELEASE_TRACK: 'production' },
      { NAQLA_RELEASE_KEY_ALIAS: '' },
      { NAQLA_RELEASE_KEYSTORE_PATH: join(f.dir, 'missing.jks') },
    ]) {
      const result = run(gate, f.dir, { ...f.env, ...changes });
      assert.equal(result.status, 1, 'invalid release settings accepted: ' + Object.keys(changes)[0]);
    }
  } finally { f.cleanup(); }
});

test('temporary Gradle patch never writes signing secrets and sets verified release version', () => {
  const f = fixture();
  try {
    const result = run(gradleSetup, f.dir, f.env);
    assert.equal(result.status, 0, result.stderr);
    const build = readFileSync(join(f.dir, 'android/app/build.gradle'), 'utf8');
    assert.match(build, /NAQLA_INTERNAL_RELEASE_SIGNING_V1/);
    assert.match(build, /versionCode 42/);
    assert.match(build, /versionName "0.1.0"/);
    assert.match(build, /System.getenv\('NAQLA_RELEASE_STORE_PASSWORD'\)/);
    assert.match(build, /signingConfig signingConfigs.naqlaUpload/);
    assert.doesNotMatch(build, /private-demo-(?:store|key)/);
    const repeated = run(gradleSetup, f.dir, f.env);
    assert.equal(repeated.status, 1, 'repeated patch must fail, not stack signing blocks');
  } finally { f.cleanup(); }
});
