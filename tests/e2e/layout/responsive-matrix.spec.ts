import { test, expect } from '@playwright/test';
import { gameIds, locales, selectedViewports } from '../fixtures/matrix.ts';
import { boardSelectors, captureRuntimeErrors, disableMotion, openLocalGame } from '../helpers/game.ts';
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
          isMobile: canTouch,
          deviceScaleFactor: viewport.group === 'mobile' ? 2 : 1,
        });
        const page = await context.newPage();
        const runtimeErrors = captureRuntimeErrors(page);

        try {
          await openLocalGame(page, gameId, locale);
          await disableMotion(page);
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

          if (gameId === 'digitalGame')
            await expectIntentionalScroller(page.locator('.digital-rack'), 'digital rack');

          if (gameId === 'dominoes') {
            await expectIntentionalScroller(page.locator('.domino-chain-shell'), 'domino chain');
            await expectIntentionalScroller(page.locator('.domino-hand'), 'domino hand');
          }

          if (['checkers', 'quoridor', 'nineMensMorris', 'reversi', 'chess', 'dotsAndBoxes', 'navalBattle'].includes(gameId))
            await expectSquare(board, `${gameId} board`, 3);

          if (gameId === 'connectFour') {
            const slots = page.locator('.connect-slot');
            await expect(slots).toHaveCount(42);
            for (const index of [0, 6, 35, 41])
              await expectSquare(slots.nth(index), `connectFour slot ${index}`, 2);
          }

          if (gameId === 'gomoku') {
            const cells = page.locator('.gomoku-board .intersection');
            await expect(cells).toHaveCount(225);
            for (const index of [0, 14, 112, 210, 224])
              await expectSquare(cells.nth(index), `gomoku cell ${index}`, 2);
          }

          if (gameId === 'reversi') {
            const cells = page.locator('.reversi-cell');
            await expect(cells).toHaveCount(64);
            for (const index of [0, 7, 27, 36, 56, 63])
              await expectSquare(cells.nth(index), `reversi cell ${index}`, 2);
          }

          if (gameId === 'chess') {
            const cells = page.locator('.chess-cell');
            await expect(cells).toHaveCount(64);
            for (const index of [0, 7, 27, 36, 56, 63])
              await expectSquare(cells.nth(index), `chess cell ${index}`, 2);
            await expect(board).toHaveAttribute('dir', 'ltr');
          }

          if (gameId === 'dotsAndBoxes') {
            await expect(page.locator('.dots-edge')).toHaveCount(60);
            await expect(page.locator('.dots-dot')).toHaveCount(36);
            await expect(board).toHaveAttribute('dir', 'ltr');
            const horizontal = page.locator('.dots-edge.horizontal:not(:disabled)').first();
            const vertical = page.locator('.dots-edge.vertical:not(:disabled)').first();
            await expectCenterHitTarget(horizontal, 'Dots horizontal edge');
            await expectCenterHitTarget(vertical, 'Dots vertical edge');
          }

          if (gameId === 'dominoes') {
            const handTiles = page.locator('.domino-hand-tile');
            await expect(handTiles).toHaveCount(7);
            const opening = page.locator('.domino-hand-tile:not(:disabled)').first();
            await expectCenterHitTarget(opening, 'Domino playable tile');
            await expectMinimumControlSize(opening, 'Domino playable tile', 48);
          }

          if (gameId === 'navalBattle') {
            const cells = page.locator('.naval-board-frame.placement .naval-cell');
            await expect(cells).toHaveCount(100);
            await expect(board).toHaveAttribute('role', 'grid');
            await expect(board.locator('xpath=..')).toHaveAttribute('dir', 'ltr');
            for (const index of [0, 9, 44, 90, 99]) {
              await expectSquare(cells.nth(index), `naval cell ${index}`, 2);
              await expectCenterHitTarget(cells.nth(index), `naval cell ${index}`);
            }
            await expect(page.locator('.naval-fleet-item')).toHaveCount(5);
          }

          if (gameId === 'abalone') {
            const box = await board.boundingBox();
            expect(box).not.toBeNull();
            if (box) expect(Math.abs(box.width / box.height - 480 / 444)).toBeLessThan(0.02);
          }

          const headerControls = page.locator('.match-header button:visible');
          for (let index = 0; index < (await headerControls.count()); index++) {
            const control = headerControls.nth(index);
            await expectCenterHitTarget(control, `${gameId}: header control ${index}`);
            await expectMinimumControlSize(control, `${gameId}: header control ${index}`, 40);
          }

          const matchControls = page.locator('.match-controls button:visible');
          for (let index = 0; index < (await matchControls.count()); index++) {
            const control = matchControls.nth(index);
            await expectCenterHitTarget(control, `${gameId}: match control ${index}`);
            await expectMinimumControlSize(control, `${gameId}: match control ${index}`, 40);
          }

          if (canTouch) {
            expect(
              await page.evaluate(() => matchMedia('(pointer: coarse)').matches),
              `${gameId}: touch context should expose a coarse pointer`,
            ).toBe(true);
          }

          expect(runtimeErrors, `${gameId}: runtime errors`).toEqual([]);
        } finally {
          await context.close();
        }
      });
    }
  }
}
