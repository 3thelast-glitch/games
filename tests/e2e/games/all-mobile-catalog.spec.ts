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
  ludo: { root: '.ludo-page', scene: '.ludo-variants' },
  appleWorm: { root: '[data-stage-origin="user-screenshot"]', scene: 'svg[data-source-level]' },
  basketballLine: { root: '.basketball-page', scene: '.basketball-canvas' },
  backroomBill: { root: '.backroom-page', scene: '.backroom-canvas' },
  arithmetica: { root: '.arithmetica-page', scene: '.arithmetica-blackboard' },
  survivalBuilder: { root: '.survival-builder-page', scene: '.survival-island-scene' },
  towerDestiny: { root: '.tower-destiny-page', scene: '.tower-destiny-canvas' },
  gasStation: { root: '.gas-page', scene: '.gas-station-scene' },
} as const;
type SoloId = keyof typeof solo;
const allIds = [...gameIds, ...Object.keys(solo)] as readonly string[];

async function exerciseSolo(page: Page, id: SoloId) {
  if (id === 'ludo') {
    await page.locator('.ludo-variants button').first().click();
    await page.locator('.ludo-options button').nth(1).click();
    await page.locator('.ludo-start').click();
    await expect(page.locator('.ludo-board')).toBeVisible();
    await expect(page.locator('.ludo-dice-line button')).toBeEnabled();
    await page.locator('.ludo-dice-line button').click();
    await expect(page.locator('.ludo-play')).toHaveAttribute('data-ludo-revision', '1');
  } else if (id === 'appleWorm') {
    const game=page.locator('[data-stage-origin="user-screenshot"]');
    const board=game.locator('svg[data-source-level="1"]');
    await expect(board).toBeVisible();
    await expect(game).toHaveAttribute('data-source-stage-count','105');
    await expect(board.locator('[data-source-worm]')).toHaveCount(3);
    await expect(board.locator('[data-source-apple]')).toHaveCount(0);
    await expect(board.locator('[data-source-portal]')).toHaveCount(1);
    await expect(board).toHaveCSS('touch-action','none');
    await game.locator('button[aria-label="right"]').click();
    await expect(board.locator('[data-source-worm]').first().locator('circle').first())
      .toHaveAttribute('cx','195');
    await game.getByRole('button',{name:/^Undo$|^تراجع$/}).click();
    await expect(board.locator('[data-source-worm]').first().locator('circle').first())
      .toHaveAttribute('cx','165');
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
    await expect(page.locator('.arithmetica-overlay')).toBeVisible();
    await page.locator('.arithmetica-overlay button').first().click();
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

test('NAQLA library registers 20 unique playable game cards', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const cards = page.locator('.game-grid > .game-card');
  await expect(cards).toHaveCount(20);
  expect(new Set(allIds).size).toBe(20);
  for (const id of allIds) {
    await expect(page.locator('.game-card.' + id + ' .play-button')).toBeVisible();
  }
  await expectNoGlobalOverflow(page);
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
            await expect(page.locator(config.scene)).toBeVisible();
            await exerciseSolo(page,id as SoloId);
            await expectNoGlobalOverflow(page);
            const back=id==='appleWorm'
              ? page.locator('[data-stage-origin="user-screenshot"] header button').first()
              : page.locator(config.root+' .button.secondary').first();
            await back.click();
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
