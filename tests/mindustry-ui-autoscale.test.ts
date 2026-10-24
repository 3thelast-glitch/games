import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const patcher = resolve('scripts/patch-mindustry-teavm-ui.mjs');
const anchor = 'Scl.setProduct(Math.max(settings.getInt("uiscale", 100), 25) / 100f);';

test('original offline Mindustry UI auto-scale patch preserves player preferences', () => {
  const folder = mkdtempSync(join(tmpdir(), 'naqla-mindustry-uiscale-'));
  try {
    const source = join(folder, 'Vars.java');
    writeFileSync(source, 'class Vars { void load(){ ' + anchor + ' } }');
    const patched = spawnSync(process.execPath, [patcher, source], {encoding:'utf8'});
    assert.equal(patched.status, 0, patched.stderr);
    const java = readFileSync(source, 'utf8');
    assert.ok(java.includes('settings.getInt("uiscale", mobileWebUiScale)'));
    assert.ok(java.includes('graphics.getDensity()'));
    assert.ok(java.includes('graphics.getHeight()'));
    assert.ok(java.includes('680f'));
    assert.ok(!java.includes(anchor));
    const rerun = spawnSync(process.execPath, [patcher, source], {encoding:'utf8'});
    assert.equal(rerun.status, 0, rerun.stderr);
    assert.equal(readFileSync(source, 'utf8'), java);
  } finally { rmSync(folder,{recursive:true,force:true}); }
});

test('original upstream drift causes UI scale patch to fail closed', () => {
  const folder = mkdtempSync(join(tmpdir(), 'naqla-mindustry-upstream-'));
  try {
    const file = join(folder,'Vars.java');
    writeFileSync(file,'class Vars{}');
    const result = spawnSync(process.execPath,[patcher,file],{encoding:'utf8'});
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/differs from reviewed source/);
  } finally {rmSync(folder,{recursive:true,force:true});}
});

test('small landscape phones use compact defaults and large viewports retain original scale', () => {
  const scale = (cssHeight: number) => Math.trunc(Math.min(100,Math.max(50, 100*cssHeight/680)));
  assert.equal(scale(390),57);
  assert.equal(scale(360),52);
  assert.equal(scale(720),100);
  assert.equal(scale(844),100);
});
