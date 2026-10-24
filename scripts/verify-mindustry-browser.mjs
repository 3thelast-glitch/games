import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// A real-browser smoke test for the compiled original Mindustry/Arc engine.
// Passing confirms first gameplay frame + canvas input; it does NOT certify
// complete campaign progression, saves or on-device Android performance.
const base = process.argv[2] || 'http://127.0.0.1:8787';
const origin = new URL(base).origin;
const screenshots = resolve('artifacts/mindustry');
mkdirSync(screenshots, { recursive: true });
let browser;
const external = [];
const runtimeErrors = [];
const browserLogs = [];
const httpErrors = [];
let page = null;

// Read original Mindustry's real binary .msav bytes, not just a save filename.
// This runs inside the game iframe against its native IndexedDB-backed VFS.
async function readOriginalSavedWorld(frameLocator) {
  return frameLocator.locator('#mindustry-canvas').evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('mindustry-fs');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error('Mindustry VFS IndexedDB failed to open'));
    });
    try {
      if (!db.objectStoreNames.contains('files')) return null;
      const value = await new Promise((resolve, reject) => {
        const req = db.transaction('files','readonly').objectStore('files').get('mindustry/saves/0.msav');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(new Error('Mindustry world save unavailable'));
      });
      if (!value) return null;
      const bytes = value instanceof Uint8Array ? value
        : value instanceof ArrayBuffer ? new Uint8Array(value)
        : ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
        : null;
      if (!bytes) throw new Error('Mindustry VFS returned non-binary save content');
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      return {
        bytes: bytes.byteLength,
        sha256: [...digest].map(b => b.toString(16).padStart(2, '0')).join(''),
      };
    } finally {
      db.close();
    }
  });
}
try {
  browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--disable-features=Vulkan'],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    deviceScaleFactor: 1,
  });
  page = await context.newPage();
  page.on('console', msg => { if (msg.type() === 'error' || msg.type() === 'warning') browserLogs.push(msg.type() + ': ' + msg.text()); });
  page.on('requestfailed', request => browserLogs.push('FETCH FAILED ' + request.url() + ': ' + (request.failure()?.errorText || 'unknown')));
  page.on('response', response => { if (response.status() >= 400) httpErrors.push(response.status() + ' ' + response.url()); });
  page.on('crash', () => browserLogs.push('CHROMIUM PAGE CRASHED'));
  page.on('request', request => {
    const url = request.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    if (new URL(url).origin !== origin) external.push(url);
  });
  page.on('pageerror', e => runtimeErrors.push(e.message));
  const home = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (!home?.ok()) throw new Error('NAQLA library failed HTTP startup');
  await page.locator('.game-card.mindustry .play-button').click({ timeout: 30000 });
  await page.locator('.community-game-start').click({ timeout: 30000 });
  const frame = page.frameLocator('iframe.community-game-frame');
  await frame.locator('#mindustry-canvas').waitFor({ state: 'visible', timeout: 60000 });
  await page.screenshot({ path: resolve(screenshots, 'mindustry-loading.png'), fullPage: true });
  // The upstream WebAssets/TeaVM renderer itself removes #ms-boot on the first
  // successfully rendered frame via __msBootDone; JS bundle fetch alone isn't enough.
  await frame.locator('#ms-boot').waitFor({ state: 'detached', timeout: 75000 });
  const title = await frame.locator('html').evaluate(el => el.ownerDocument.title);
  if (title.includes('BOOT FAILED')) throw new Error('Mindustry TeaVM reported BOOT FAILED');
  const canvas = frame.locator('#mindustry-canvas');
  await canvas.evaluate(el => {
    el.dataset.naqlaPointerReceived = 'false';
    el.addEventListener('pointerdown', () => { el.dataset.naqlaPointerReceived = 'true'; }, { once: true });
  });
  // Avoid the touch-control toggle at the rotated viewport edge. Tap a free
  // part of the original canvas while checking that real pointer input lands.
  await canvas.tap({ timeout: 30000, position: { x: 195, y: 42 } });
  const pointerReceived = await canvas.evaluate(el => el.dataset.naqlaPointerReceived === 'true');
  if (!pointerReceived) throw new Error('Mindustry canvas did not receive touchscreen pointer input');
  if (external.length) throw new Error('Offline game requested external URLs: ' + external.join(', '));
  if (runtimeErrors.some(s => /boot failed|out of memory|webgl context lost|uncaught/i.test(s))) {
    throw new Error('Game emitted startup errors: ' + runtimeErrors.join('; '));
  }
  await page.screenshot({ path: resolve(screenshots, 'mindustry-first-frame.png'), fullPage: true });
  // Probe the original in-game Play menu, not just the loading screen. Game
  // menus render into canvas rather than accessible DOM, so save a real capture
  // for visual review rather than claiming this proves a level has started.
  // Use the canvas's untransformed coordinates: when a portrait WebView
  // denies orientation lock, CSS rotates the landscape iframe 90 degrees.
  // The bounding box is swapped but canvas clientWidth/clientHeight are not.
  const gameCanvasSize = await canvas.evaluate(el => ({
    width: el.clientWidth, height: el.clientHeight,
  }));
  const canvasRect = await canvas.boundingBox();
  if (!canvasRect) throw new Error('Original game canvas has no visible rectangle');
  // Playwright position values are relative to the *transformed bounding box*.
  // For the 90-degree portrait fallback, portrait (x, y) maps to upright
  // landscape (y, screenWidth - x). Pick the real Mindustry "Play" button.
  const cssRotated = gameCanvasSize.width > gameCanvasSize.height &&
    canvasRect.height > canvasRect.width;
  const landscapeMenu = gameCanvasSize.width > gameCanvasSize.height;
  await canvas.tap({ position: {
    x: Math.floor(canvasRect.width * (cssRotated ? .75 : landscapeMenu ? .15 : .45)),
    y: Math.floor(canvasRect.height * (cssRotated ? .15 : landscapeMenu ? .26 : .30)),
  } });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: resolve(screenshots, 'mindustry-after-play-tap.png'), fullPage: true });
  // Enter the original Custom Game option to validate deeper gameplay menus.
  // Coordinates are for the original canvas's Play submenu in landscape, or
  // the visually rotated bounding box when held portrait.
  await canvas.tap({ position: {
    x: Math.floor(canvasRect.width * (cssRotated ? .54 : landscapeMenu ? .29 : .80)),
    y: Math.floor(canvasRect.height * (cssRotated ? .29 : landscapeMenu ? .46 : .46)),
  } });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: resolve(screenshots, 'mindustry-custom-game-selection.png'), fullPage: true });
  // Select a real bundled original Mindustry map (Ancient Caldera) rather than
  // stopping at the map library. Coordinates account for the 90deg CSS fallback:
  // upright landscape (110,145) => portrait bounding box (245,110).
  const selectedMap = cssRotated
    ? {x: Math.floor(canvasRect.width * .63), y: Math.floor(canvasRect.height * .13)}
    : landscapeMenu
      ? {x: Math.floor(canvasRect.width * .13), y: Math.floor(canvasRect.height * .37)}
      : {x: Math.floor(canvasRect.width * .25), y: Math.floor(canvasRect.height * .3)};
  await canvas.tap({position: selectedMap});
  await page.waitForTimeout(2200);
  await page.screenshot({ path: resolve(screenshots, 'mindustry-custom-map-opened.png'), fullPage: true });
  // Press the *original* game "Play" on the Survival setup dialog. This starts
  // an offline world: the test must demonstrate a real map, not just menus.
  await canvas.tap({ position: cssRotated
    ? {x: Math.floor(canvasRect.width * .10), y: Math.floor(canvasRect.height * .57)}
    : landscapeMenu
      ? {x: Math.floor(canvasRect.width * .57), y: Math.floor(canvasRect.height * .90)}
      : {x: Math.floor(canvasRect.width * .50), y: Math.floor(canvasRect.height * .82)}
  });
  await page.waitForTimeout(12000);
  await page.screenshot({ path: resolve(screenshots, 'mindustry-survival-world-boot.png'), fullPage: true });
  // A real mobile web build must let the player move without a hardware WASD
  // keyboard. Verify the on-screen D-pad emits real KeyW keydown + keyup
  // events to the same iframe Window the original TeavmInput listens on.
  const controls = frame.locator('#naqla-touch-toggle');
  await controls.waitFor({ state: 'visible', timeout: 12000 });
  await controls.click();
  const up = frame.locator('#naqla-touch-up');
  await up.waitFor({ state: 'visible' });
  await canvas.evaluate(() => {
    window.__naqlaTouchEvents = [];
    window.addEventListener('keydown', event => window.__naqlaTouchEvents.push('down:' + event.code));
    window.addEventListener('keyup', event => window.__naqlaTouchEvents.push('up:' + event.code));
  });
  await up.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', bubbles: true, cancelable: true });
  await page.waitForTimeout(850);
  await up.dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', bubbles: true, cancelable: true });
  const touchKeys = await canvas.evaluate(() => window.__naqlaTouchEvents || []);
  if (!touchKeys.includes('down:KeyW') || !touchKeys.includes('up:KeyW')) {
    throw new Error('Original Mindustry iframe did not receive movement keydown/keyup from touch pad: ' + touchKeys);
  }
  await page.screenshot({ path: resolve(screenshots, 'mindustry-touch-movement.png'), fullPage: true });
  // Open the original pause/menu UI to inspect whether local offline progress
  // can be saved; do not claim persistence from a loading screen alone.
  await canvas.evaluate(() => {
    const keys = {code:'Escape', key:'Escape', bubbles:true, cancelable:true};
    window.dispatchEvent(new KeyboardEvent('keydown', keys));
    window.dispatchEvent(new KeyboardEvent('keyup', keys));
  });
  await page.waitForTimeout(1300);
  await page.screenshot({ path: resolve(screenshots, 'mindustry-in-game-pause-menu.png'), fullPage: true });
  // Save & Quit through the original Mindustry pause dialog to test the
  // offline save pipeline. This must not contact a remote account/server.
  await canvas.tap({ position: cssRotated
    ? {x: Math.floor(canvasRect.width * .325), y: Math.floor(canvasRect.height * .50)}
    : landscapeMenu
      ? {x: Math.floor(canvasRect.width * .50), y: Math.floor(canvasRect.height * .67)}
      : {x: Math.floor(canvasRect.width * .50), y: Math.floor(canvasRect.height * .67)}
  });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: resolve(screenshots, 'mindustry-save-and-quit-confirmation.png'), fullPage: true });
  // The original menu explicitly confirms quitting. Choose OK so the game
  // gets the opportunity to flush its IndexedDB-backed local save.
  await canvas.tap({ position: cssRotated
    ? {x: Math.floor(canvasRect.width * .44), y: Math.floor(canvasRect.height * .57)}
    : landscapeMenu
      ? {x: Math.floor(canvasRect.width * .57), y: Math.floor(canvasRect.height * .56)}
      : {x: Math.floor(canvasRect.width * .57), y: Math.floor(canvasRect.height * .56)}
  });
  await page.waitForTimeout(4300);
  await page.screenshot({ path: resolve(screenshots, 'mindustry-after-save-and-quit.png'), fullPage: true });
  const storedFiles = await canvas.evaluate(async () => {
    return await new Promise((resolve, reject) => {
      const open = indexedDB.open('mindustry-fs');
      open.onerror = () => reject(new Error('Original Mindustry local VFS could not open'));
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('files')) {
          db.close();
          resolve([]);
          return;
        }
        const tx = db.transaction('files','readonly');
        const query = tx.objectStore('files').getAllKeys();
        query.onsuccess = () => { resolve(query.result.map(k => String(k))); db.close(); };
        query.onerror = () => { db.close(); reject(new Error('Cannot inspect Mindustry local saves')); };
      };
    });
  });
  console.log('MINDUSTRY OFFLINE PERSISTENCE FILES:', JSON.stringify(storedFiles.filter(k => /saves|\.msav|settings/i.test(k)).slice(-40)));
  const beforeReload = await readOriginalSavedWorld(frame);
  if (!beforeReload || beforeReload.bytes < 1024) {
    throw new Error('Save & Quit did not store a full binary Mindustry world');
  }
  console.log('MINDUSTRY ORIGINAL SAVE HASH BEFORE RESTART:', JSON.stringify(beforeReload));
  if (external.length) throw new Error('A gameplay world requested a remote server: ' + external.join(', '));
  if (httpErrors.length) throw new Error('Game files failed while starting the world: ' + httpErrors.slice(-10).join(', '));
  // Destroy the first game iframe and reload from the embedded package.
  // Verify the exact same original save bytes persist across a fresh boot.
  await page.locator('.community-game-exit').click();
  await page.locator('.game-card.mindustry').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('.game-card.mindustry .play-button').click({ timeout: 30000 });
  await page.locator('.community-game-start').click({ timeout: 30000 });
  const reopenedFrame = page.frameLocator('iframe.community-game-frame');
  await reopenedFrame.locator('#ms-boot').waitFor({ state: 'detached', timeout: 75000 });
  const afterReload = await readOriginalSavedWorld(reopenedFrame);
  if (!afterReload || beforeReload.bytes !== afterReload.bytes ||
      beforeReload.sha256 !== afterReload.sha256) {
    throw new Error('Offline Mindustry save changed or disappeared after iframe restart: ' +
      JSON.stringify({beforeReload, afterReload}));
  }
  await page.screenshot({path:resolve(screenshots, 'mindustry-save-persists-after-reopen.png'),fullPage:true});
  await page.locator('.community-game-exit').click();
  await page.locator('.game-card.mindustry').waitFor({ state: 'visible', timeout: 10000 });
  if (external.length) throw new Error('Mindustry used an external game server: ' + external.join(', '));
  console.log('MINDUSTRY PERSISTED ORIGINAL SAVE VERIFIED AFTER RESTART:', JSON.stringify(afterReload));
  console.log(JSON.stringify({
    result: 'offline Mindustry original Survival world, touch movement and binary save persistence verified',
    canvasTouchReceived: pointerReceived,
    saveBytes: afterReload.bytes,
    sha256: afterReload.sha256,
    thirdPartyNetworkRequests: external.length,
    navigatedBackToNAQLA: true,
    note: 'Physical Android and in-game Load Game menu remain to verify.',
  }));
} catch (error) {
  console.error('Mindustry real-engine smoke failed:', error);
  try {
    const gameFrame = page?.frames().find(frame => frame.url().includes('/third-party/mindustry/index.html'));
    const state = gameFrame && await gameFrame.evaluate(() => ({
      title: document.title,
      bootText: document.querySelector('#ms-boot-label')?.textContent || '',
      gameEntryFunction: typeof window.main,
      assetCacheVersion: window.__msCacheVersion || null,
      webglAvailable: !!document.createElement('canvas').getContext('webgl'),
      pageScripts: [...document.querySelectorAll('script[src]')].map(s => s.src),
    }));
    console.error('MINDUSTRY DIAGNOSTIC STATE', JSON.stringify({state, browserLogs:browserLogs.slice(-100), httpErrors:httpErrors.slice(-50), pageErrors:runtimeErrors.slice(-40), externalRequests:external.slice(-50)}, null, 2));
    if (page) await page.screenshot({path:resolve(screenshots, 'mindustry-error-state.png'),fullPage:true});
  } catch (diagError) { console.error('Unable to inspect browser after failure:', diagError); }
  throw error;
} finally {
  if (browser) await browser.close();
}
