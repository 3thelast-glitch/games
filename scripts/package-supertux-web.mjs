import {
  copyFileSync, existsSync, mkdirSync, readFileSync,
  rmSync, statSync, writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { embedOfflineCsp } from './offline-game-csp.mjs';

// Takes the complete ORIGINAL upstream C++/Emscripten build, never a toy clone.
// Build artifacts can be provided from pinned reproducible CI, or produced
// from the source checkout using SuperTux's official .github/workflows/wasm.yml.
const source = resolve(process.argv[2] || 'native/community/supertux/build');
const target = resolve(process.argv[3] || 'apps/mobile/public/third-party/supertux');
const required = ['supertux2.js', 'supertux2.wasm', 'supertux2.data', 'LICENSE.txt'];
const entry = existsSync(join(source, 'supertux2.html')) ? 'supertux2.html' : 'template.html';
const missing = [...required,entry].filter(file =>
  !existsSync(join(source, file)) || !statSync(join(source,file)).isFile());
if (missing.length) throw new Error('Original SuperTux build is missing ' + missing.join(', '));
const minimum = {'supertux2.js': 10000, 'supertux2.wasm': 1000000, 'supertux2.data': 1000000};
for (const [file,size] of Object.entries(minimum)) {
  if (statSync(join(source,file)).size < size)
    throw new Error('Original SuperTux engine/data artifact incomplete: ' + file);
}
const wasm = readFileSync(join(source,'supertux2.wasm'));
if (!wasm.subarray(0,4).equals(Buffer.from([0,97,115,109])))
  throw new Error('Original SuperTux WASM magic header invalid');

let html = readFileSync(join(source,entry), 'utf8');
if (!/<head\b/i.test(html) || !/<body\b/i.test(html) ||
    !/src=["']supertux2\.js["']/.test(html) ||
    !/id=["']canvas["']/.test(html)) {
  throw new Error('Original SuperTux Emscripten HTML does not contain its real game bootstrap');
}
// The original template includes a paragraph linking to a public download
// site; offline NAQLA should not send the player to outside pages.
html = html.replace(/<p>If the game is unplayably slow,[\s\S]*?<\/p>/i, '');
if (!/<\/body>/i.test(html)) throw new Error('Upstream game HTML has no closing body');
const touchScript = 'naqla-supertux-touch.js';
html = embedOfflineCsp(
  html.replace(/<\/body>/i, '<script defer src="./' + touchScript + '"></script>\n</body>')
);
rmSync(target,{recursive:true,force:true});
mkdirSync(target,{recursive:true});
for(const file of required.slice(0,3)) copyFileSync(join(source,file),join(target,file));
copyFileSync(join(source,'LICENSE.txt'),join(target,'LICENSE.txt'));
for(const opt of ['supertux2.png','supertux2_bkg.png','supertux2.ico']) {
  if (existsSync(join(source,opt))) copyFileSync(join(source,opt),join(target,opt));
}
const bridge = fileURLToPath(new URL('./supertux-touch-controls.js',import.meta.url));
if (!existsSync(bridge)) throw new Error('NAQLA SuperTux mobile touch bridge is missing');
copyFileSync(bridge,join(target,touchScript));
writeFileSync(join(target,'supertux2.html'),html);
const manifest = {
  id:'supertux',
  entry:'supertux2.html',
  runtime:'emscripten',
  offline:true,
  requiresRemoteServer:false,
  originalSource:'https://github.com/SuperTux/supertux',
  sourceCommit:'c837f4f5d8b5945e22df1e36ab8f05801cf08f9c',
  note:'Experimental original GPL SuperTux offline game; physical Android verification pending.',
};
writeFileSync(join(target,'naqla-runtime.json'),JSON.stringify(manifest,null,2)+'\n');
writeFileSync(join(target,'SOURCE.md'),[
  '# SuperTux original Emscripten runtime in NAQLA',
  '',
  'Original source: '+manifest.originalSource,
  'Pinned source commit: '+manifest.sourceCommit,
  'License: see included LICENSE.txt and upstream per-asset notices.',
  'Modifications: NAQLA offline CSP, optional touch bridge and application host integration.',
  'Corresponding original source and build scripts must be provided before redistribution.',
  '',
].join('\n'));
console.log('Packaged REAL offline SuperTux game and mobile controls into: '+target);
