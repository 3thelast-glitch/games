import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve('scripts/package-mindustry-web.mjs');
test('Mindustry runtime packager rejects incomplete upstream builds', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'naqla-mindustry-'));
  try {
    const input = join(tmp, 'source'), output = join(tmp, 'output');
    mkdirSync(input);
    writeFileSync(join(input, 'index.html'), '<html><head></head><body><canvas id="mindustry-canvas"></canvas><script src="mindustry.js"></script></body></html>');
    const result = spawnSync(process.execPath, [script, input, output], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /incomplete|Missing/);
    assert.equal(existsSync(join(output, 'naqla-runtime.json')), false);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('Mindustry packager only exposes a runtime after original artifacts exist', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'naqla-mindustry-'));
  try {
    const input = join(tmp, 'source'), output = join(tmp, 'output');
    mkdirSync(input);
    writeFileSync(join(input, 'index.html'), '<html><head></head><body><canvas id="mindustry-canvas"></canvas><script src="mindustry.js"></script></body></html>');
    writeFileSync(join(input, 'mindustry.js'), Buffer.alloc(1000001, 65));
    writeFileSync(join(input, 'asset-manifest.txt'), 'assets/example-file\n'.repeat(100));
    for (const name of ['opentype.min.js', 'freetype-glue.js', 'net-glue.js']) {
      writeFileSync(join(input, name), '/* test */');
    }
    writeFileSync(join(input, 'mindustry-standalone.html'), 'very large build excluded');
    const result = spawnSync(process.execPath, [script, input, output], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(join(output, 'mindustry.js')), true);
    assert.equal(existsSync(join(output, 'mindustry-standalone.html')), false);
    const manifest = JSON.parse(readFileSync(join(output, 'naqla-runtime.json'), 'utf8'));
    assert.equal(manifest.id, 'mindustry');
    assert.equal(manifest.entry, 'index.html');
    assert.equal(manifest.runtime, 'teavm');
    assert.equal(manifest.offline, true);
    assert.equal(manifest.requiresRemoteServer, false);
    assert.match(readFileSync(join(output, 'index.html'), 'utf8'), /connect-src 'self'/);
    assert.match(readFileSync(join(output, 'index.html'), 'utf8'), /naqla-touch-controls\\.js/);
    assert.equal(existsSync(join(output, 'naqla-touch-controls.js')), true);
    assert.match(readFileSync(join(output, 'naqla-touch-controls.js'), 'utf8'), /KeyW/);
    assert.ok(manifest.sourceCommit);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
