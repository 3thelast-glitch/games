import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Minimal documented GPL source adaptation to the original Mindustry web port.
// Source is preserved; this default is used only when the player has not
// chosen their own UI scaling value, which remains saved locally as before.
const path = resolve(process.argv[2] ??
  '.cache/mindustry-web/offlinemode/backend-teavm/src/mindustry/Vars.java');
if (!existsSync(path)) throw new Error('Cannot find original Mindustry Vars.java: ' + path);
const source = readFileSync(path, 'utf8');
const original = 'Scl.setProduct(Math.max(settings.getInt("uiscale", 100), 25) / 100f);';
const replacement = `// NAQLA offline mobile: the original desktop main menu is taller than
        // a 390px landscape WebView. Only auto-scale when the player has not
        // configured their own UI size; devicePixelRatio is accounted for.
        int mobileWebUiScale = (int)Math.min(100f, Math.max(50f,
            100f * graphics.getHeight() / Math.max(1f, graphics.getDensity()) / 680f));
        Scl.setProduct(Math.max(settings.getInt("uiscale", mobileWebUiScale), 25) / 100f);`;
if (!source.includes(original)) {
  if (source.includes(replacement)) {
    console.log('Mindustry local UI default already patched: ' + path);
    process.exit(0);
  }
  throw new Error('Upstream Mindustry UI scale code differs from reviewed source. Refusing unsafe patch.');
}
writeFileSync(path, source.replace(original, replacement));
console.log('Patched Mindustry web default UI scale for short landscape screens:', path);
