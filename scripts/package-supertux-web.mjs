import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Run AFTER compiling upstream SuperTux via its Emscripten workflow.
// Output stays untracked until licenses/credits and release checks are complete.
const input = resolve(process.argv[2] || 'native/community/supertux/build');
const output = resolve('apps/mobile/public/third-party/supertux');
const files = ['supertux2.js', 'supertux2.wasm', 'supertux2.data'];
const html = existsSync(resolve(input, 'supertux2.html')) ? 'supertux2.html' : 'template.html';
const missing = [...files, html].filter(name => !existsSync(resolve(input, name)));
if (missing.length) throw new Error(`Missing actual upstream Emscripten outputs: ${missing.join(', ')}`);
mkdirSync(output, { recursive: true });
for (const name of files) copyFileSync(resolve(input, name), resolve(output, name));
copyFileSync(resolve(input, html), resolve(output, 'supertux2.html'));
writeFileSync(resolve(output, 'naqla-runtime.json'), JSON.stringify({ id: 'supertux', entry: 'supertux2.html' }, null, 2) + '\n');
console.log('Packaged original SuperTux WebAssembly runtime for NAQLA:', output);
