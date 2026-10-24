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
  await canvas.tap({ timeout: 30000, position: { x: 45, y: 50 } });
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
  const landscapeMenu = gameCanvasSize.width > gameCanvasSize.height;
  await canvas.tap({ position: {
    x: Math.floor(gameCanvasSize.width * (landscapeMenu ? .24 : .45)),
    y: Math.floor(gameCanvasSize.height * (landscapeMenu ? .28 : .30)),
  } });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: resolve(screenshots, 'mindustry-after-play-tap.png'), fullPage: true });
  await page.locator('.community-game-exit').click();
  await page.locator('.game-card.mindustry').waitFor({ state: 'visible', timeout: 10000 });
  console.log(JSON.stringify({
    result: 'original Mindustry/Arc first frame rendered in Chromium',
    canvasTouchReceived: pointerReceived,
    thirdPartyNetworkRequests: external.length,
    navigatedBackToNAQLA: true,
    note: 'Gameplay, saves and hardware remain unverified.',
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
