/**
 * Mobile release gate for EVERY title surfaced in NAQLA's library.
 * This suite deliberately covers the newer 8 standalone games, which are not
 * part of the 12-board-game responsive matrix.
 */
import { test, expect, type Page } from '@playwright/test';
import { gameIds, locales, type GameId } from '../fixtures/matrix.ts';
import {
  boardSelectors, captureRuntimeErrors, openLocalGame,
} from '../helpers/game.ts';
import { expectNoGlobalOverflow } from '../helpers/layout.ts';

const solo = {
  ludo: { root: '.ludo-page', scene: '.ludo-home' },
  appleWorm: { root: '[data-stage-origin="user-screenshot"]', scene: 'svg[data-source-level]' },
  basketballLine: { root: '.basketball-page', scene: '.basketball-canvas' },
  backroomBill: { root: '.backroom-page', scene: '.backroom-canvas' },
  arithmetica: { root: '.arithmetica-immersive', scene: '.arithmetica-start-screen' },
  survivalBuilder: { root: '.survival-builder-page', scene: '.survival-island-scene' },
  towerDestiny: { root: '.tower-destiny-page', scene: '.tower-destiny-canvas' },
  gasStation: { root: '.gas-page', scene: '.gas-station-scene' },
} as const;
type SoloId = keyof typeof solo;
const allIds = [...gameIds, ...Object.keys(solo)] as readonly string[];

async function exerciseSolo(page: Page, id: SoloId) {
  if (id === 'ludo') {
    await page.locator('.ludo-home-play').click();
    await page.locator('.ludo-mode-card').nth(1).click();
    await page.locator('.ludo-count-card').first().click();
    await page.locator('.ludo-flow-next').click();
    await page.locator('.ludo-start').click();
    await expect(page.locator('.ludo-board')).toBeVisible();
    await expect(page.locator('.ludo-dice-line button')).toBeEnabled();
    await page.locator('.ludo-dice-line button').click();
    await expect(page.locator('.ludo-play')).toHaveAttribute('data-ludo-revision', '1');
  } else if (id === 'appleWorm') {
    const game=page.locator('body > [data-stage-origin="user-screenshot"]');
    await expect(game).toHaveAttribute('data-worm-screen','home');
    await expect(game.locator('.worm3-title-logo')).toBeVisible();
    await game.locator('.worm3-play-button').click();
    await expect(game).toHaveAttribute('data-worm-screen','levels');
    await expect(game.locator('.worm3-level-grid button')).toHaveCount(15);
    await game.locator('.worm3-level-grid button').first().click();
    await expect(game).toHaveAttribute('data-worm-screen','game');
    const board=game.locator('svg[data-source-level="1"]');
    await expect(board).toBeVisible();
    await expect(game).toHaveAttribute('data-source-stage-count','105');
    await expect(board.locator('[data-source-worm]')).toHaveCount(1);
    await expect(board.locator('[data-source-terrain="premium-art"]')).toHaveCount(1);
    await expect(board.locator('[data-source-worm]')).toHaveAttribute('data-body-length','3');
    await expect(board).toHaveAttribute('viewBox','0 0 630 270');
    await expect(board.locator('[data-source-apple]')).toHaveCount(0);
    await expect(board.locator('[data-source-portal]')).toHaveCount(1);
    await expect(board).toHaveCSS('touch-action','none');
    await game.getByRole('button',{name:/^Move right$|^يمين$/}).click();
    await game.getByRole('button',{name:/^Game menu$|^قائمة اللعبة$/}).click();
    await game.getByRole('button',{name:/^Undo$|^تراجع$/}).click();
    await game.getByRole('button',{name:/^Close$|^إغلاق$/}).click();
  } else if (id === 'basketballLine') {
    await expect(page.locator('.basketball-canvas')).toBeVisible();
    const c = page.locator('.basketball-canvas');
    const box = await c.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.move(box.x + box.width * .3, box.y + box.height * .3);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * .55, box.y + box.height * .45, {steps: 6});
      await page.mouse.up();
    }
    await expect(page.locator('.basketball-ink-meter')).toBeVisible();
  } else if (id === 'backroomBill') {
    await expect(page.locator('.backroom-controls')).toBeVisible();
    await page.locator('.backroom-panel-buttons button').first().click();
    await expect(page.locator('.backroom-floor-grid')).toBeVisible();
  } else if (id === 'arithmetica') {
    await expect(page.locator('[data-arithmetica-screen="home"]')).toBeVisible();
    await page.locator('.arithmetica-start-button').click();
    await expect(page.locator('.arithmetica-blackboard')).toBeVisible();
    await expect(page.locator('.arithmetica-answer')).toHaveCount(2);
    await page.locator('.arithmetica-answer').first().click();
    await expect(page.locator('.arithmetica-time-fill')).toBeVisible();
  } else if (id === 'survivalBuilder') {
    const collect = page.locator('.survival-builder-collect button').first();
    await expect(collect).toBeEnabled();
    await collect.click();
    await expect.poll(async () => Number(await collect.locator('strong').innerText())).toBeGreaterThan(0);
    await expect(page.locator('.survival-builder-workers select')).toHaveCount(4);
  } else if (id === 'towerDestiny') {
    await expect(page.locator('.tower-destiny-overlay button')).toBeVisible();
    await page.locator('.tower-destiny-overlay button').first().click();
    await expect(page.locator('.tower-destiny-stage-progress')).toBeVisible();
    await expect(page.locator('.tower-destiny-vitals [role="progressbar"]')).toBeVisible();
    const c = page.locator('.tower-destiny-canvas');
    const box = await c.boundingBox();
    if (box) await c.click({ position: { x: box.width * .72, y: box.height * .73 } });
  } else if (id === 'gasStation') {
    await expect(page.locator('.gas-station-scene [aria-label^="Clear junk"]')).not.toHaveCount(0);
    await page.locator('.gas-station-scene [aria-label^="Clear junk"]').first().click();
    await expect(page.locator('.gas-dpad button')).toHaveCount(9);
    await expect(page.locator('.gas-supplies progress')).toHaveCount(2);
  }
}

test('NAQLA library keeps 20 playable titles and clearly stages 3 upstream games', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const cards = page.locator('.game-grid > .game-card');
  const communityIds = ['supertux', 'freecivWeb', 'mindustry'];
  await expect(cards).toHaveCount(23);
  expect(new Set(allIds).size).toBe(20);
  for (const id of allIds) {
    await expect(page.locator('.game-card.' + id + ' .play-button')).toBeVisible();
  }
  for (const id of communityIds) {
    const card = page.locator('.game-card.' + id);
    await expect(card).toBeVisible();
    await expect(card.locator('.naqla-community-state')).toBeVisible();
    await expect(card.locator('.play-button')).toHaveAttribute('aria-label', /Open game details|فتح تفاصيل اللعبة/);
  }
  await expectNoGlobalOverflow(page);
});

test('upstream game details never pretend a missing original runtime is playable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (const id of ['supertux', 'freecivWeb', 'mindustry']) {
    await page.locator('.game-card.' + id + ' .play-button').click();
    const screen = page.locator('.community-game');
    await expect(screen).toBeVisible();
    await expect(screen.locator('.community-game-help')).toBeVisible();
    await expect(screen.locator('.community-game-start')).toHaveCount(0);
    await screen.locator('.community-game-back').click();
    await expect(page.locator('.game-card.' + id)).toBeVisible();
  }
});


test('an installed original Mindustry game exits straight to the NAQLA library', async ({ page }) => {
  // Navigation regression only: the actual TeaVM first-frame and touch
  // gameplay are tested with the real upstream bundle by the dedicated CI.
  await page.route('**/third-party/mindustry/naqla-runtime.json', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      id: 'mindustry', entry: 'index.html', runtime: 'teavm',
      offline: true, requiresRemoteServer: false,
    }),
  }));
  await page.route('**/third-party/mindustry/index.html', route => route.fulfill({
    status: 200, contentType: 'text/html',
    body: '<!doctype html><html><body><canvas id="mindustry-canvas" width="390" height="650"></canvas></body></html>',
  }));
  await page.goto('/');
  await page.locator('.game-card.mindustry .play-button').click();
  await expect(page.locator('.community-game-start')).toBeVisible();
  await page.locator('.community-game-start').click();
  await expect(page.frameLocator('.community-game-frame').locator('#mindustry-canvas')).toBeVisible();
  const immersive = page.locator('.community-game-playing');
  await expect(immersive).toHaveCSS('position', 'fixed');
  const viewport = page.viewportSize();
  const fullscreenBounds = await immersive.boundingBox();
  expect(fullscreenBounds).not.toBeNull();
  expect(Math.round(fullscreenBounds!.width)).toBe(viewport!.width);
  expect(Math.round(fullscreenBounds!.height)).toBe(viewport!.height);
  const gameFrameBounds = await page.locator('iframe.community-game-frame').boundingBox();
  expect(gameFrameBounds).not.toBeNull();
  expect(Math.round(gameFrameBounds!.width)).toBe(viewport!.width);
  expect(Math.round(gameFrameBounds!.height)).toBe(viewport!.height);
  await page.locator('.community-game-exit').click();
  await expect(page.locator('.game-grid .game-card.mindustry')).toBeVisible();
  await expect(page.locator('.community-game')).toHaveCount(0);
});

for (const locale of locales) {
  for (const width of [320, 390] as const) {
    const height = width === 320 ? 568 : 844;
    for (const id of allIds) {
      test(id + ' mobile ' + width + 'px ' + locale.id + ' opens and interacts', async ({browser, browserName}) => {
        const touch=browserName!=='firefox';
        const context=await browser.newContext({
          locale:locale.locale,viewport:{width,height},deviceScaleFactor:2,
          isMobile:touch,hasTouch:touch,
        });
        const page=await context.newPage();
        const errors=captureRuntimeErrors(page);
        try {
          if (id in solo) {
            await page.goto('/');
            await expect(page.locator('html')).toHaveAttribute('dir',locale.dir);
            const card=page.locator('.game-card.'+id);
            await expect(card).toBeVisible();
            await card.locator('.play-button').click();
            const config=solo[id as SoloId];
            await expect(page.locator(config.root)).toBeVisible();
            if(id!=='appleWorm')await expect(page.locator(config.scene)).toBeVisible();
            await exerciseSolo(page,id as SoloId);
            await expectNoGlobalOverflow(page);
            if(id==='appleWorm'){
              await page.locator('.worm3-game .worm3-top-left button').first().click();
              await page.locator('.worm3-levels .worm3-top-left button').first().click();
              await page.locator('.worm3-home .worm3-top-left button').first().click();
            }else if(id==='arithmetica'){
              await page.locator('.arithmetica-heading .button.secondary').click();
              await page.locator('.arithmetica-exit').click();
            }else if(id==='ludo'){
              await page.locator('.ludo-icon-btn').first().click();
              await page.locator('.ludo-exit-btn').click();
            }else{
              await page.locator(config.root+' .button.secondary').first().click();
            }
            await expect(page.locator('.game-grid .game-card.'+id)).toBeVisible();
          } else {
            await openLocalGame(page,id as GameId,locale);
            await expect(page.locator(boardSelectors[id as GameId])).toBeVisible();
            await expect(page.locator('.match-page')).toHaveAttribute('data-game',id);
            await expectNoGlobalOverflow(page);
          }
          expect(errors,id+' JavaScript errors on '+width+' '+locale.id).toEqual([]);
        } finally {
          await context.close();
        }
      });
    }
  }
}
