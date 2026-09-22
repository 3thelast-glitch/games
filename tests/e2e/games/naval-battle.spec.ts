import { test, expect, type Page } from '@playwright/test';
import { locales, type LocaleCase } from '../fixtures/matrix.ts';
import { openLocalGame, captureRuntimeErrors, disableMotion } from '../helpers/game.ts';
import {
  expectCenterHitTarget,
  expectNoGlobalOverflow,
  expectSquare,
} from '../helpers/layout.ts';

async function deployCurrentFleet(page: Page) {
  const anchors = [0, 20, 40, 60, 80];
  for (let index = 0; index < anchors.length; index++) {
    const fleetButton = page.locator('.naval-fleet-item button').nth(index);
    await fleetButton.click();
    const cell = page.locator(
      `.naval-board-frame.placement .naval-cell[data-cell-index="${anchors[index]}"]`,
    );
    await cell.click();
    const place = page.locator('.naval-placement-actions .button.primary');
    await expect(place).toBeEnabled();
    await place.click();
    await expect(page.locator('.naval-placement-check.placed')).toHaveCount(index + 1);
  }
  const confirm = page.locator('.naval-placement-actions .button.ghost');
  await expect(confirm).toBeEnabled();
  await confirm.click();
}

async function reachBattle(page: Page) {
  await deployCurrentFleet(page);
  await expect(page.locator('.naval-handoff')).toBeVisible();
  await page.locator('.naval-handoff .button').click();
  await deployCurrentFleet(page);
  await expect(page.locator('.naval-handoff')).toBeVisible();
  await page.locator('.naval-handoff .button').click();
  await expect(page.locator('.naval-game.phase-battle')).toBeVisible();
  await expect(page.locator('.naval-board-frame.target .naval-grid')).toBeVisible();
  await expect(page.locator('.naval-board-frame.own .naval-grid')).toBeVisible();
}

const battleCases = [
  { id: 'ar-320x568', locale: 'ar', width: 320, height: 568, touch: true },
  { id: 'ar-390x844', locale: 'ar', width: 390, height: 844, touch: true },
  { id: 'en-390x844', locale: 'en', width: 390, height: 844, touch: true },
  { id: 'ar-800x360', locale: 'ar', width: 800, height: 360, touch: true },
  { id: 'ar-768x1024', locale: 'ar', width: 768, height: 1024, touch: true },
  { id: 'en-1440x900', locale: 'en', width: 1440, height: 900, touch: false },
] as const;

for (const fixture of battleCases) {
  test(`Naval battle phase ${fixture.id}`, async ({ browser, browserName }) => {
    const locale = locales.find((item) => item.id === fixture.locale) as LocaleCase;
    const canTouch = fixture.touch && browserName !== 'firefox';
    const context = await browser.newContext({
      viewport: { width: fixture.width, height: fixture.height },
      locale: locale.locale,
      hasTouch: canTouch,
      isMobile: canTouch,
      deviceScaleFactor: fixture.width <= 430 ? 2 : 1,
    });
    const page = await context.newPage();
    const runtimeErrors = captureRuntimeErrors(page);
    try {
      await openLocalGame(page, 'navalBattle', locale);
      await disableMotion(page);
      await reachBattle(page);
      await expectNoGlobalOverflow(page);

      const target = page.locator('.naval-board-frame.target .naval-grid');
      const own = page.locator('.naval-board-frame.own .naval-grid');
      await expectSquare(target, 'Naval target board', 3);
      await expectSquare(own, 'Naval own board', 3);
      await expect(target.locator('.naval-cell')).toHaveCount(100);
      await expect(own.locator('.naval-cell')).toHaveCount(100);
      await expect(target.locator('xpath=..')).toHaveAttribute('dir', 'ltr');
      await expect(own.locator('xpath=..')).toHaveAttribute('dir', 'ltr');

      const targetBox = await target.boundingBox();
      const ownBox = await own.boundingBox();
      expect(targetBox).not.toBeNull();
      expect(ownBox).not.toBeNull();
      if (targetBox && ownBox)
        expect(targetBox.width + 1, 'target grid should not be smaller than own fleet grid').toBeGreaterThanOrEqual(
          ownBox.width,
        );

      const firstTarget = target.locator('.naval-cell[data-cell-index="0"]');
      await expectCenterHitTarget(firstTarget, 'Naval target A1');
      await firstTarget.click();
      const fire = page.locator('.naval-fire-button');
      await expect(fire).toBeEnabled();
      await fire.click();

      // A hit still passes the turn. Local mode must return to the privacy handoff.
      await expect(page.locator('.naval-handoff')).toBeVisible();
      await page.locator('.naval-handoff .button').click();
      const secondTarget = page.locator(
        '.naval-board-frame.target .naval-cell[data-cell-index="0"]',
      );
      await secondTarget.click();
      await page.locator('.naval-fire-button').click();

      await expect(page.locator('.naval-handoff')).toBeVisible();
      await page.locator('.naval-handoff .button').click();
      await expect(page.locator('.naval-board-frame.target .naval-cell.hit')).toHaveCount(1);
      await expect(page.locator('.naval-board-frame.own .naval-cell.hit')).toHaveCount(1);
      await expectNoGlobalOverflow(page);
      expect(runtimeErrors, 'Naval Battle runtime errors').toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test('Naval placement invalid preview communicates out-of-bounds without dispatching', async ({
  browser,
  browserName,
}) => {
  const locale = locales.find((item) => item.id === 'en')!;
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: locale.locale,
    hasTouch: browserName !== 'firefox',
    isMobile: browserName !== 'firefox',
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  try {
    await openLocalGame(page, 'navalBattle', locale);
    await disableMotion(page);
    const last = page.locator('.naval-board-frame.placement .naval-cell[data-cell-index="9"]');
    await last.click();
    await expect(page.locator('.naval-preview-status.invalid')).toBeVisible();
    await expect(page.locator('.naval-placement-actions .button.primary')).toBeDisabled();
    await expect(page.locator('.naval-placement-actions .button.ghost')).toBeDisabled();
  } finally {
    await context.close();
  }
});
