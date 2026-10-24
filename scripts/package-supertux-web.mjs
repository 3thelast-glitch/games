import { existsSync, mkdirSync, copyFileSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Compile the ORIGINAL upstream C++/Emscripten game first. This script does not
// substitute simplified gameplay, web links or placeholder binary assets.
const input = resolve(process.argv[2] || '.cache/supertux/build');
const output = resolve(process.argv[3] || 'apps/mobile/public/third-party/supertux');
const files = ['supertux2.js', 'supertux2.wasm', 'supertux2.data'];
const html = existsSync(join(input, 'supertux2.html')) ? 'supertux2.html' : 'template.html';
const missing = [...files, html].filter(name => !existsSync(join(input, name)) || !statSync(join(input, name)).isFile());
if (missing.length) throw new Error(`SuperTux WebAssembly output missing: ${missing.join(', ')}`);
const minimumSizes = { 'supertux2.js': 1024, 'supertux2.wasm': 1000000, 'supertux2.data': 1000000 };
for (const [file, bytes] of Object.entries(minimumSizes)) {
  if (statSync(join(input, file)).size < bytes) throw new Error(`SuperTux compiled ${file} is incomplete`);
}
if (!readFileSync(join(input, html), 'utf8').includes('supertux2')) {
  throw new Error('SuperTux HTML entrypoint does not load the compiled original runtime');
}
const license = join(input, 'LICENSE.txt');
if (!existsSync(license)) throw new Error('SuperTux GPL license notice missing from build artifacts');
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const name of files) copyFileSync(join(input, name), join(output, name));
copyFileSync(join(input, html), join(output, 'supertux2.html'));
copyFileSync(license, join(output, 'LICENSE.txt'));
writeFileSync(join(output, 'naqla-runtime.json'), JSON.stringify({
  id: 'supertux',
  entry: 'supertux2.html',
  runtime: 'emscripten',
  offline: true,
  requiresRemoteServer: false,
  source: 'https://github.com/SuperTux/supertux',
  sourceCommit: 'c837f4f5d8b5945e22df1e36ab8f05801cf08f9c',
}, null, 2) + '\n');
writeFileSync(join(output, 'SOURCE.md'), [
  '# SuperTux - original offline Emscripten build',
  'Source: https://github.com/SuperTux/supertux',
  'Pinned commit: c837f4f5d8b5945e22df1e36ab8f05801cf08f9c',
  'Original game code and assets are GPL-3.0-or-later and asset-specific licenses.',
  'Inspect and provide full corresponding source and asset notices before distribution.',
  'Never describe this build as mobile-verified until actual device gameplay tests pass.',
  '',
].join('\n'));
console.log('Packaged original SuperTux offline runtime:', output);
