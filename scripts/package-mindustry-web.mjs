import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { embedOfflineCsp } from './offline-game-csp.mjs';

const source = resolve(process.argv[2] ?? '.cache/mindustry-web/offlinemode/backend-teavm/build/web');
const destination = resolve(process.argv[3] ?? 'apps/mobile/public/third-party/mindustry');
const required = ['index.html', 'mindustry.js', 'asset-manifest.txt', 'opentype.min.js', 'freetype-glue.js', 'net-glue.js'];
const missing = required.filter(file => !existsSync(join(source, file)) || !statSync(join(source, file)).isFile());
if (missing.length) throw new Error(`Mindustry TeaVM web build incomplete. Missing: ${missing.join(', ')}`);
const html = readFileSync(join(source, 'index.html'), 'utf8');
if (!html.includes('mindustry.js') || !html.includes('mindustry-canvas')) {
  throw new Error('Mindustry entrypoint is not the expected TeaVM game canvas.');
}
if (statSync(join(source, 'mindustry.js')).size < 1000000) {
  throw new Error('Mindustry JS bundle is suspiciously small; real engine was not compiled.');
}
if (statSync(join(source, 'asset-manifest.txt')).size < 1000) {
  throw new Error('Mindustry asset manifest is empty or incomplete.');
}
mkdirSync(destination, { recursive: true });
rmSync(destination, { recursive: true, force: true });
cpSync(source, destination, {
  recursive: true,
  filter: name => !name.endsWith('mindustry-standalone.html'),
});
// The upstream game must never load external scripts, fonts or game services.
const touchFile = 'naqla-touch-controls.js';
copyFileSync(new URL('./mindustry-touch-controls.js', import.meta.url), join(destination, touchFile));
if (!/<\/body>/i.test(html)) throw new Error('Upstream Mindustry HTML has no closing body for touch bridge');
writeFileSync(join(destination, 'index.html'), embedOfflineCsp(
  html.replace(/<\/body>/i, `<script defer src="./${touchFile}"></script>\n</body>`)
));
const manifest = {
  id: 'mindustry',
  entry: 'index.html',
  runtime: 'teavm',
  offline: true,
  requiresRemoteServer: false,
  source: 'https://github.com/khoichon/mindustry-web',
  sourceCommit: '33652d79b21498d2cbd0d7f38cab46aa3a8fe183',
  originalGame: 'https://github.com/Anuken/Mindustry',
  originalGameVersion: 'v159.7',
  note: 'Experimental GPL-3.0 web port; gameplay must be validated per device.',
};
writeFileSync(join(destination, 'naqla-runtime.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(join(destination, 'SOURCE.md'), [
  '# Mindustry web runtime - preview',
  '',
  'Original game: https://github.com/Anuken/Mindustry (GPL-3.0).',
  'Browser port: https://github.com/khoichon/mindustry-web (GPL-3.0).',
  'Pinned port commit: '+manifest.sourceCommit,
  'Original assets from official Mindustry v159.7 release.',
  'Full corresponding source and relevant license notices must accompany redistribution.',
  'Not an official Mindustry release. This is a test build and is not approved for release.',
  '',
].join('\n'));
console.log('Packaged experimental Mindustry browser engine:', destination);
