import { test, expect, type Page } from '@playwright/test';
import { fullViewports, locales } from '../fixtures/matrix.ts';
import { captureRuntimeErrors, disableMotion, openLocalGame } from '../helpers/game.ts';
import { expectNoGlobalOverflow, expectSquare } from '../helpers/layout.ts';

async function deployCurrentFleet(page: Page) {
  const anchors = [0, 20, 40, 60, 80];
  for (let index = 0; index < anchors.length; index++) {
    await page.locator('.naval-fleet-item button').nth(index).click();
    await page
      .locator(`.naval-board-frame.placement .naval-cell[data-cell-index="${anchors[index]}"]`)
      .click();
    const place = page.locator('.naval-placement-actions .button.primary');
    await expect(place).toBeEnabled();
    await place.click();
  }
  const confirm = page.locator('.naval-placement-actions .button.ghost');
  await expect(confirm).toBeEnabled();
  await confirm.click();
}

async function reveal(page: Page) {
  await expect(page.locator('.naval-handoff')).toBeVisible();
  await page.locator('.naval-handoff .button').click();
}

for (const locale of locales) {
  for (const viewport of fullViewports) {
    test(`Naval full matrix ${locale.id} ${viewport.id} ${viewport.width}x${viewport.height}`, async ({
      browser,
      browserName,
    }) => {
      test.skip(browserName !== 'chromium');
      const touch = viewport.touch;
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        locale: locale.locale,
        hasTouch: touch,
        isMobile: touch && viewport.group === 'mobile',
        deviceScaleFactor: viewport.group === 'mobile' ? 2 : 1,
      });
      const page = await context.newPage();
      const runtimeErrors = captureRuntimeErrors(page);
      try {
        await openLocalGame(page, 'navalBattle', locale);
        await disableMotion(page);

        const placement = page.locator('.naval-board-frame.placement .naval-grid');
        await expect(placement).toBeVisible();
        await expect(placement.locator('.naval-cell')).toHaveCount(100);
        await expect(placement.locator('xpath=..')).toHaveAttribute('dir', 'ltr');
        await expectSquare(placement, 'Naval placement board', 3);
        await expectNoGlobalOverflow(page);

        await deployCurrentFleet(page);
        await reveal(page);
        await deployCurrentFleet(page);
        await reveal(page);

        const target = page.locator('.naval-board-frame.target .naval-grid');
        const own = page.locator('.naval-board-frame.own .naval-grid');
        await expect(target).toBeVisible();
        await expect(own).toBeVisible();
        await expect(target.locator('.naval-cell')).toHaveCount(100);
        await expect(own.locator('.naval-cell')).toHaveCount(100);
        await expect(target.locator('xpath=..')).toHaveAttribute('dir', 'ltr');
        await expect(own.locator('xpath=..')).toHaveAttribute('dir', 'ltr');
        await expectSquare(target, 'Naval target board', 3);
        await expectSquare(own, 'Naval own board', 3);
        await expectNoGlobalOverflow(page);

        const [targetBox, ownBox] = await Promise.all([target.boundingBox(), own.boundingBox()]);
        expect(targetBox).not.toBeNull();
        expect(ownBox).not.toBeNull();
        if (targetBox && ownBox)
          expect(
            targetBox.width + 1,
            `active target grid priority at ${viewport.width}x${viewport.height}`,
          ).toBeGreaterThanOrEqual(ownBox.width);

        expect(runtimeErrors, 'Naval runtime errors').toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
}
