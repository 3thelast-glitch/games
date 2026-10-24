import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const origin=new URL(process.argv[2] ?? 'http://127.0.0.1:8787').origin;
const screenshots=resolve('artifacts/supertux');
mkdirSync(screenshots,{recursive:true});
const errors=[],external=[],httpErrors=[],consoleLines=[];
const browser=await chromium.launch({
  headless:true,
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-features=Vulkan']
});
let page;
try {
  const ctx=await browser.newContext({
    viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true
  });
  page=await ctx.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{
    if(m.type()==='error'||m.type()==='warning')consoleLines.push(m.text());
  });
  page.on('request',r=>{
    const u=r.url();
    if(u.startsWith('blob:')||u.startsWith('data:'))return;
    if(new URL(u).origin!==origin)external.push(u);
  });
  page.on('response',r=>{
    if(r.status()>=400)httpErrors.push(r.status()+' '+r.url());
  });
  let r=await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:60000});
  if(!r?.ok())throw Error('NAQLA library failed to load');
  await page.locator('.game-card.supertux .play-button').click();
  await page.locator('.community-game-start').waitFor({state:'visible',timeout:15000});
  await page.locator('.community-game-start').click();
  const frame=page.frameLocator('iframe.community-game-frame');
  await frame.locator('#canvas').waitFor({state:'visible',timeout:150000});
  const frameObj=await page.waitForEvent('framenavigated',{
    predicate:f=>f.url().includes('/third-party/supertux/supertux2.html'),
    timeout:5000
  }).catch(()=>page.frames().find(f=>f.url().includes('third-party/supertux/supertux2.html')));
  if(!frameObj)throw Error('Original SuperTux game frame not found');
  await page.screenshot({path:resolve(screenshots,'supertux-upstream-loader.png'),fullPage:true});
  // The ORIGINAL SuperTux template hides overlay only after its real C++ WASM
  // runtime and game resources finished loading. A mere JS fetch is not success.
  await frameObj.waitForFunction(()=>{
    const o=document.getElementById('overlay');
    return o && getComputedStyle(o).display==='none' &&
      document.getElementById('canvas')?.width>0 &&
      document.getElementById('canvas')?.height>0;
  },null,{timeout:180000});
  await page.screenshot({path:resolve(screenshots,'supertux-original-first-frame.png'),fullPage:true});
  const canvas=frame.locator('#canvas');
  await canvas.evaluate(el=>{
    window.__naqlaSuperTuxKeys=[];
    el.addEventListener('keydown',e=>window.__naqlaSuperTuxKeys.push('down:'+e.code));
    el.addEventListener('keyup',e=>window.__naqlaSuperTuxKeys.push('up:'+e.code));
  });
  const left=frame.locator('#naqla-supertux-left');
  await left.waitFor({state:'visible',timeout:10000});
  await left.dispatchEvent('pointerdown',{pointerId:7,pointerType:'touch',bubbles:true,cancelable:true});
  await page.waitForTimeout(850);
  await left.dispatchEvent('pointerup',{pointerId:7,pointerType:'touch',bubbles:true,cancelable:true});
  const keys=await canvas.evaluate(()=>window.__naqlaSuperTuxKeys);
  if(!keys.includes('down:ArrowLeft')||!keys.includes('up:ArrowLeft'))
    throw Error('Original SuperTux did not receive mobile movement key events: '+keys);
  await page.screenshot({path:resolve(screenshots,'supertux-touch-movement.png'),fullPage:true});
  const serious=errors.filter(x=>/abort|uncaught|out of memory|webgl context lost|runtimeerror/i.test(x));
  if(serious.length)throw Error('Original SuperTux threw fatal browser errors: '+serious.join('; '));
  if(external.length)throw Error('SuperTux requested external network: '+external.join(', '));
  const runtimeFailures=httpErrors.filter(x=>/supertux2\.(wasm|data|js)|naqla-supertux-touch\.js/i.test(x));
  if(runtimeFailures.length)throw Error('Original engine assets not available: '+runtimeFailures.join(', '));
  await page.locator('.community-game-exit').click();
  await page.locator('.game-card.supertux').waitFor({state:'visible'});
  console.log(JSON.stringify({
    verified:'original SuperTux WebAssembly runtime first frame and mobile key controls',
    touchKeys:keys,externalRequests:external.length,
    pageErrors:errors.length,possibleMissingOptionalResources:httpErrors,
    returnedToNAQLALibrary:true,
    note:'Level start, saves, Android device and audio still require independent tests.'
  }));
} catch(err) {
  console.error('SUPERTUX REAL ENGINE SMOKE FAILED',err);
  try {
    const gameFrame=page?.frames().find(f=>f.url().includes('third-party/supertux/supertux2.html'));
    const state=await gameFrame?.evaluate(()=>({
      status:document.querySelector('#status')?.textContent,
      overlay:document.querySelector('#overlay')?.getAttribute('style'),
      canvasWidth:document.querySelector('#canvas')?.width,
      canvasHeight:document.querySelector('#canvas')?.height,
      moduleCalledRun:typeof Module==='object'?Module.calledRun:'not exposed',
      output:document.querySelector('#output')?.textContent?.slice(-3000)
    }));
    console.error('SUPERTUX BOOT DIAGNOSTICS',JSON.stringify({state,errors,external,httpErrors,consoleLines:consoleLines.slice(-70)},null,2));
    await page?.screenshot({path:resolve(screenshots,'supertux-boot-failed.png'),fullPage:true});
  }catch(e){console.error('Cannot collect SuperTux browser diagnostics',e)}
  throw err;
}finally { await browser.close(); }
