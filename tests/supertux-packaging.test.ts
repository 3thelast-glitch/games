import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const packager = resolve('scripts/package-supertux-web.mjs');
function workspace(run: (input: string, output: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'naqla-supertux-'));
  try {
    const input = join(root, 'original'), output = join(root, 'bundle');
    mkdirSync(input);
    run(input, output);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
test('offline SuperTux packager rejects missing original engine and its data', () => {
  workspace((input, output) => {
    writeFileSync(join(input, 'supertux2.html'), '<html><head></head><body><script src="supertux2.js"></script></body></html>');
    const result = spawnSync(process.execPath, [packager, input, output], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /output missing/);
    assert.equal(existsSync(join(output, 'naqla-runtime.json')), false);
  });
});
test('offline SuperTux package contains executable engine, maps and GPL notices', () => {
  workspace((input, output) => {
    writeFileSync(join(input, 'supertux2.js'), Buffer.alloc(4096, 65));
    writeFileSync(join(input, 'supertux2.wasm'), Buffer.alloc(1001000, 65));
    writeFileSync(join(input, 'supertux2.data'), Buffer.alloc(1001000, 65));
    writeFileSync(join(input, 'supertux2.html'), '<html><head></head><body><script src="supertux2.js"></script></body></html>');
    writeFileSync(join(input, 'LICENSE.txt'), 'GPL-3.0-or-later');
    const result = spawnSync(process.execPath, [packager, input, output], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    for(const file of ['supertux2.html','supertux2.js','supertux2.wasm','supertux2.data','LICENSE.txt','SOURCE.md'])
      assert.ok(existsSync(join(output,file)), `Missing ${file}`);
    const manifest = JSON.parse(readFileSync(join(output, 'naqla-runtime.json'), 'utf8'));
    assert.equal(manifest.id, 'supertux');
    assert.equal(manifest.entry, 'supertux2.html');
    assert.equal(manifest.offline, true);
    assert.equal(manifest.requiresRemoteServer, false);
    assert.match(readFileSync(join(output, 'supertux2.html'), 'utf8'), /connect-src 'self'/);
    assert.equal(manifest.runtime, 'emscripten');
  });
});
