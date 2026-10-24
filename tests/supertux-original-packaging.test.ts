import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const packageScript=resolve('scripts/package-supertux-web.mjs');
const rootFiles=[
  'supertux2.js','supertux2.wasm','supertux2.data',
  'supertux2.html','LICENSE.txt'
];
function withDir(fn: (original: string, target: string) => void) {
  const temp=mkdtempSync(join(tmpdir(),'naqla-original-supertux-'));
  const original=join(temp,'original'),target=join(temp,'bundled');
  mkdirSync(original);
  try { return fn(original,target); }
  finally { rmSync(temp,{recursive:true,force:true}); }
}
function originalTestFixture(original: string) {
  writeFileSync(join(original,'supertux2.js'),'/* original compiled Emscripten test placeholder */'.repeat(300));
  writeFileSync(join(original,'supertux2.wasm'),Buffer.concat([
    Buffer.from([0,97,115,109]),Buffer.alloc(1000000)
  ]));
  writeFileSync(join(original,'supertux2.data'),Buffer.alloc(1000000,73));
  writeFileSync(join(original,'supertux2.html'),
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>'+
    '<canvas id="canvas" tabindex="0"></canvas><script async src="supertux2.js"></script>'+
    '</body></html>');
  writeFileSync(join(original,'LICENSE.txt'),'GPL-3.0-or-later');
}
test('rejects missing actual SuperTux C++ WASM and data before creating a Play manifest',()=>{
  withDir((original,target)=>{
    writeFileSync(join(original,'supertux2.html'),'<html><head></head><body></body></html>');
    const run=spawnSync(process.execPath,[packageScript,original,target],{encoding:'utf8'});
    assert.notEqual(run.status,0);
    assert.match(run.stderr,/missing|WASM/i);
    assert.equal(existsSync(join(target,'naqla-runtime.json')),false);
  });
});
test('rejects simulated WASM files even with a plausible name and large size',()=>{
  withDir((original,target)=>{
    originalTestFixture(original);
    writeFileSync(join(original,'supertux2.wasm'),Buffer.alloc(1000004));
    const run=spawnSync(process.execPath,[packageScript,original,target],{encoding:'utf8'});
    assert.notEqual(run.status,0);
    assert.match(run.stderr,/magic header/);
  });
});
test('packages all original engine components, license, runtime gate and phone controls',()=>{
  withDir((original,target)=>{
    originalTestFixture(original);
    const result=spawnSync(process.execPath,[packageScript,original,target],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    for(const file of [...rootFiles,'naqla-runtime.json','naqla-supertux-touch.js','SOURCE.md'])
      assert.ok(existsSync(join(target,file)),file);
    const manifest=JSON.parse(readFileSync(join(target,'naqla-runtime.json'),'utf8'));
    assert.deepEqual(
      [manifest.id,manifest.runtime,manifest.offline,manifest.requiresRemoteServer,manifest.entry],
      ['supertux','emscripten',true,false,'supertux2.html']
    );
    const html=readFileSync(join(target,'supertux2.html'),'utf8');
    assert.match(html,/naqla-supertux-touch\.js/);
    assert.match(html,/connect-src 'self'/);
    assert.match(html,/supertux2\.js/);
    const controls=readFileSync(join(target,'naqla-supertux-touch.js'),'utf8');
    for(const code of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','ControlLeft','ShiftLeft','Enter','Escape'])
      assert.ok(controls.includes(code),code);
  });
});
