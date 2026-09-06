import { test, expect } from '@playwright/test';
import { gameIds, locales } from '../fixtures/matrix.ts';
import { boardSelectors, openLocalGame } from '../helpers/game.ts';
import { expectNoGlobalOverflow } from '../helpers/layout.ts';

for (const gameId of gameIds) {
  for (const locale of locales) {
    test(`${gameId} survives portrait/landscape/desktop resize (${locale.id})`, async ({ browser, browserName }) => {
      const touch = browserName !== 'firefox';
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        locale: locale.locale,
        hasTouch: touch,
        isMobile: touch,
      });
      try {
        const page = await context.newPage();
        await openLocalGame(page, gameId, locale);
        const board = page.locator(boardSelectors[gameId]);
        const initialText = await page.locator('.match-move-number').textContent();
        const initialBoardCount = await board.count();

        for (const viewport of [
          { width: 844, height: 390 },
          { width: 320, height: 568 },
          { width: 1366, height: 768 },
          { width: 390, height: 844 },
        ]) {
          await page.setViewportSize(viewport);
          await expect(board).toBeVisible();
          await expect(page.locator('.match-page')).toBeVisible();
          await expectNoGlobalOverflow(page);
          expect(await board.count()).toBe(initialBoardCount);
          expect(await page.locator('.match-move-number').textContent()).toBe(initialText);
        }
      } finally {
        await context.close();
      }
    });
  }
}
