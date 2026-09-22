import { test, expect, type Page } from '@playwright/test';
import { locales, type LocaleCase } from '../fixtures/matrix.ts';
import { disableMotion, openLocalGame } from '../helpers/game.ts';

async function deployCurrentFleet(page: Page) {
  const anchors = [0, 20, 40, 60, 80];
  for (let index = 0; index < anchors.length; index++) {
    await page.locator('.naval-fleet-item button').nth(index).click();
    await page
      .locator(`.naval-board-frame.placement .naval-cell[data-cell-index="${anchors[index]}"]`)
      .click();
    await page.locator('.naval-placement-actions .button.primary').click();
  }
  await page.locator('.naval-placement-actions .button.ghost').click();
}

async function reveal(page: Page) {
  await expect(page.locator('.naval-handoff')).toBeVisible();
  await page.locator('.naval-handoff .button').click();
}

async function chooseCurrentLoadout(page: Page, indices: number[]) {
  await expect(page.locator('.naval-loadout-card')).toHaveCount(6);
  for (const index of indices) await page.locator('.naval-loadout-card').nth(index).click();
  const confirm = page.locator('.naval-loadout-footer .button.primary');
  await expect(confirm).toBeEnabled();
  await confirm.click();
}

async function reachBattle(page: Page) {
  await deployCurrentFleet(page);
  await reveal(page);
  await deployCurrentFleet(page);
  await reveal(page);
  await expect(page.locator('.naval-game.phase-battle')).toBeVisible();
}

async function fireAt(page: Page, index: number) {
  await page
    .locator(`.naval-board-frame.target .naval-cell[data-cell-index="${index}"]`)
    .click();
  await page.locator('.naval-fire-button').click();
}

const shots = [
  { id: 'ar-320x568', locale: 'ar', width: 320, height: 568 },
  { id: 'ar-360x800', locale: 'ar', width: 360, height: 800 },
  { id: 'ar-390x844', locale: 'ar', width: 390, height: 844 },
  { id: 'ar-412x915', locale: 'ar', width: 412, height: 915 },
  { id: 'ar-800x360', locale: 'ar', width: 800, height: 360 },
  { id: 'ar-768x1024', locale: 'ar', width: 768, height: 1024 },
  { id: 'en-390x844', locale: 'en', width: 390, height: 844 },
  { id: 'en-1440x900', locale: 'en', width: 1440, height: 900 },
] as const;

for (const shot of shots) {
  test(`Naval visual evidence ${shot.id}`, async ({ browser, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium');
    const locale = locales.find((item) => item.id === shot.locale) as LocaleCase;
    const touch = shot.width < 1024;
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
      locale: locale.locale,
      hasTouch: touch,
      isMobile: touch && shot.width < 700,
      deviceScaleFactor: shot.width <= 430 ? 2 : 1,
    });
    const page = await context.newPage();
    try {
      await openLocalGame(page, 'navalBattle', locale);
      await disableMotion(page);
      await page.screenshot({
        path: testInfo.outputPath(`${shot.id}-placement.png`),
        fullPage: false,
      });

      await reachBattle(page);
      await page.screenshot({
        path: testInfo.outputPath(`${shot.id}-battle.png`),
        fullPage: false,
      });
    } finally {
      await context.close();
    }
  });
}

test('Naval library artwork and sunk-state evidence', async ({ browser, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium');
  const locale = locales.find((item) => item.id === 'en')!;
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: locale.locale,
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await disableMotion(page);
    const card = page.locator('.game-card.navalBattle');
    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeVisible();
    await card.screenshot({ path: testInfo.outputPath('naval-library-card.png') });

    await card.locator('.play-button').click();
    await page.locator('.button.primary.full').last().click();
    await reveal(page);
    await chooseCurrentLoadout(page, [0, 1, 3]);
    await reveal(page);
    await chooseCurrentLoadout(page, [3, 4, 5]);
    await reveal(page);
    await deployCurrentFleet(page);
    await reveal(page);
    await deployCurrentFleet(page);
    await reveal(page);

    // Sink the opponent's length-2 destroyer at A9/B9. Opponent replies with misses.
    await fireAt(page, 80);
    await reveal(page);
    await fireAt(page, 99);
    await reveal(page);
    await fireAt(page, 81);
    await reveal(page);
    await fireAt(page, 98);
    await reveal(page);

    await expect(page.locator('.naval-board-frame.target .naval-cell.sunk')).toHaveCount(2);
    await page.screenshot({
      path: testInfo.outputPath('naval-sunk-state.png'),
      fullPage: false,
    });
  } finally {
    await context.close();
  }
});
