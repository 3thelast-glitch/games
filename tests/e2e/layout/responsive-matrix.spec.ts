import { test, expect } from '@playwright/test';
import { gameIds, locales, selectedViewports } from '../fixtures/matrix.ts';
import { boardSelectors, captureRuntimeErrors, openLocalGame, stableUi } from '../helpers/game.ts';
import {
  expectCenterHitTarget,
  expectIntentionalScroller,
  expectMinimumControlSize,
  expectNoGlobalOverflow,
  expectNoOverlap,
  expectSquare,
} from '../helpers/layout.ts';

for (const locale of locales) {
  for (const viewport of selectedViewports()) {
    for (const gameId of gameIds) {
      test(`${gameId} ${locale.id} ${viewport.id} ${viewport.width}x${viewport.height}`, async ({ browser, browserName }) => {
        const canTouch = viewport.touch && browserName !== 'firefox';
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          locale: locale.locale,
          hasTouch: canTouch,
          isMobile: canTouch && browserName !== 'firefox',
          deviceScaleFactor: viewport.group === 'mobile' ? 2 : 1,
        });
        const page = await context.newPage();
        const runtimeErrors = await captureRuntimeErrors(page);

        try {
          await openLocalGame(page, gameId, locale);
          await stableUi(page);

          await expectNoGlobalOverflow(page);

          const header = page.locator('.match-header');
          const layout = page.locator('.match-layout');
          const boardColumn = page.locator('.board-column');
          const matchSide = page.locator('.match-side');
          const board = page.locator(boardSelectors[gameId]);

          await expect(header).toBeVisible();
          await expect(layout).toBeVisible();
          await expect(boardColumn).toBeVisible();
          await expect(matchSide).toBeVisible();
          await expect(board).toBeVisible();

          await expectNoOverlap(header, layout, `${gameId}: header/layout`);
          await expectNoOverlap(boardColumn, matchSide, `${gameId}: board/side-panel`);

          if (gameId === 'gomoku') {
            const scroller = page.locator('.board-scroll');
            await expect(scroller).toBeVisible();
            await expectIntentionalScroller(scroller, 'gomoku board-scroll');
          }

          if (gameId === 'digitalGame') {
            await expectIntentionalScroller(page.locator('.digital-rack'), 'digital rack');
          }

          if (['checkers', 'quoridor', 'nineMensMorris'].includes(gameId)) {
            await expectSquare(board, `${gameId} board`, 3);
          }

          if (gameId === 'connectFour') {
            const slots = page.locator('.connect-slot');
            await expect(slots).toHaveCount(42);
            for (const index of [0, 6, 35, 41])
              await expectSquare(slots.nth(index), `connectFour slot ${index}`, 2);
          }

          if (gameId === 'gomoku') {
            const cells = page.locator('.gomoku-board .board-cell, .gomoku-board .intersection');
            const count = await cells.count();
            expect(count, 'gomoku must expose its intersections/cells').toBeGreaterThanOrEqual(225);
            for (const index of [0, 14, 112, 210, 224])
              await expectSquare(cells.nth(index), `gomoku cell ${index}`, 2);
          }

          if (gameId === 'abalone') {
            const box = await board.boundingBox();
            expect(box).not.toBeNull();
            if (box) expect(Math.abs(box.width / box.height - 480 / 444)).toBeLessThan(0.02);
          }

          for (const control of await page.locator('.match-header button:visible').all()) {
            await expectCenterHitTarget(control, `${gameId}: header control`);
            await expectMinimumControlSize(control, `${gameId}: header control`, 40);
          }

          const importantControls = page.locator('.match-controls button:visible');
          for (let index = 0; index < (await importantControls.count()); index++) {
            const control = importantControls.nth(index);
            await expectCenterHitTarget(control, `${gameId}: match control ${index}`);
            await expectMinimumControlSize(control, `${gameId}: match control ${index}`, 40);
          }

          if (canTouch) {
            expect(
              await page.evaluate(() => matchMedia('(pointer: coarse)').matches),
              `${gameId}: touch context should expose a coarse pointer`,
            ).toBe(true);
          }

          expect(runtimeErrors.filter((error) => !error.includes('favicon')), `${gameId}: runtime errors`).toEqual([]);
        } finally {
          await context.close();
        }
      });
    }
  }
}
