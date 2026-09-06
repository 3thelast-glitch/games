import { test, expect, type Page } from '@playwright/test';
import { locales, type GameId } from '../fixtures/matrix.ts';
import { openLocalGame } from '../helpers/game.ts';
import { expectCenterHitTarget, expectNoGlobalOverflow, expectSquare } from '../helpers/layout.ts';

const mobile = { width: 390, height: 844 };

async function withMobileGame(
  browser: Parameters<Parameters<typeof test>[1]>[0]['browser'],
  browserName: string,
  gameId: GameId,
  locale: (typeof locales)[number],
  run: (page: Page) => Promise<void>,
) {
  const context = await browser.newContext({
    viewport: mobile,
    locale: locale.locale,
    hasTouch: browserName !== 'firefox',
    isMobile: browserName !== 'firefox',
    deviceScaleFactor: 2,
  });
  try {
    const page = await context.newPage();
    await openLocalGame(page, gameId, locale);
    await run(page);
  } finally {
    await context.close();
  }
}

for (const locale of locales) {
  test(`Abalone touch selection remains aligned (${locale.id})`, async ({ browser, browserName }) => {
    await withMobileGame(browser, browserName, 'abalone', locale, async (page) => {
      const marble = page.locator('.marble:not(:disabled)').first();
      await expectCenterHitTarget(marble, 'Abalone own marble');
      await marble.tap();
      await expect(marble).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.marble:disabled').first()).toBeDisabled();
      await expectNoGlobalOverflow(page);
    });
  });

  test(`Quoridor pawn target maps to rendered square (${locale.id})`, async ({ browser, browserName }) => {
    await withMobileGame(browser, browserName, 'quoridor', locale, async (page) => {
      const pawn = page.locator('.pawn').first();
      const before = await pawn.getAttribute('style');
      const target = page.locator('.quoridor-board .legal-square').first();
      await expectCenterHitTarget(target, 'Quoridor legal square');
      await target.tap({ position: { x: 12, y: 12 } });
      await expect.poll(() => pawn.getAttribute('style')).not.toBe(before);
      await expectNoGlobalOverflow(page);
    });
  });

  test(`Checkers selection and destination stay inside square grid (${locale.id})`, async ({ browser, browserName }) => {
    await withMobileGame(browser, browserName, 'checkers', locale, async (page) => {
      const board = page.locator('.checkers-board');
      await expectSquare(board, 'Checkers board', 3);
      const pieceButton = page.locator('.checkers-board button:not(:disabled)').first();
      await expectCenterHitTarget(pieceButton, 'Checkers selectable piece');
      await pieceButton.tap();
      const target = page.locator('.checkers-board button:not(:disabled)').filter({ hasNot: page.locator('.board-piece') }).first();
      if (await target.count()) await expectCenterHitTarget(target, 'Checkers destination');
      await expectNoGlobalOverflow(page);
    });
  });

  test(`Gomoku corner/center hit targets remain reachable (${locale.id})`, async ({ browser, browserName }) => {
    await withMobileGame(browser, browserName, 'gomoku', locale, async (page) => {
      const scroller = page.locator('.board-scroll');
      const cells = page.locator('.gomoku-board .board-cell, .gomoku-board .intersection');
      await expect(cells).toHaveCount(225);
      for (const index of [0, 112, 224]) {
        const cell = cells.nth(index);
        await cell.scrollIntoViewIfNeeded();
        await expectCenterHitTarget(cell, `Gomoku cell ${index}`);
      }
      const before = await page.locator('.gomoku-board').evaluate((element) => element.scrollWidth);
      await scroller.evaluate((element) => (element.scrollLeft = element.scrollWidth));
      const after = await scroller.evaluate((element) => element.scrollLeft);
      expect(before).toBeGreaterThan(0);
      expect(after).toBeGreaterThanOrEqual(0);
      await expectNoGlobalOverflow(page);
    });
  });

  test(`Nine Men's Morris nodes stay centered on the board (${locale.id})`, async ({ browser, browserName }) => {
    await withMobileGame(browser, browserName, 'nineMensMorris', locale, async (page) => {
      const board = page.locator('.morris-board');
      await expectSquare(board, 'Morris board', 3);
      const boardBox = await board.boundingBox();
      expect(boardBox).not.toBeNull();
      const nodes = page.locator('.morris-point');
      await expect(nodes).toHaveCount(24);
      if (boardBox) {
        for (const index of [0, 6, 12, 18, 23]) {
          const node = nodes.nth(index);
          const box = await node.boundingBox();
          expect(box).not.toBeNull();
          if (!box) continue;
          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;
          expect(cx).toBeGreaterThanOrEqual(boardBox.x - 2);
          expect(cx).toBeLessThanOrEqual(boardBox.x + boardBox.width + 2);
          expect(cy).toBeGreaterThanOrEqual(boardBox.y - 2);
          expect(cy).toBeLessThanOrEqual(boardBox.y + boardBox.height + 2);
        }
      }
      await expectCenterHitTarget(nodes.first(), 'Morris point');
      await nodes.first().tap();
      await expectNoGlobalOverflow(page);
    });
  });

  test(`Connect Four keeps circular slots and correct edge columns (${locale.id})`, async ({ browser, browserName }) => {
    await withMobileGame(browser, browserName, 'connectFour', locale, async (page) => {
      const columns = page.locator('.connect-column');
      await expect(columns).toHaveCount(7);
      await expectCenterHitTarget(columns.first(), 'Connect Four first column');
      await expectCenterHitTarget(columns.last(), 'Connect Four last column');
      for (const index of [0, 6, 35, 41])
        await expectSquare(page.locator('.connect-slot').nth(index), `Connect Four slot ${index}`, 2);
      await columns.last().tap();
      await expect(page.locator('.connect-column').last().locator('.board-disc')).toHaveCount(1);
      await expectNoGlobalOverflow(page);
    });
  });

  test(`Digital Game rack/table actions remain reachable (${locale.id})`, async ({ browser, browserName }) => {
    await withMobileGame(browser, browserName, 'digitalGame', locale, async (page) => {
      const rack = page.locator('.digital-rack');
      const tiles = rack.locator('.digital-tile');
      expect(await tiles.count()).toBeGreaterThanOrEqual(14);
      await tiles.last().scrollIntoViewIfNeeded();
      await expectCenterHitTarget(tiles.last(), 'Digital last rack tile');
      await tiles.first().tap();
      await expect(tiles.first()).toHaveClass(/selected/);

      const actions = page.locator('.digital-actions button');
      expect(await actions.count()).toBeGreaterThanOrEqual(2);
      for (let index = 0; index < (await actions.count()); index++)
        await expectCenterHitTarget(actions.nth(index), `Digital action ${index}`);
      await expectNoGlobalOverflow(page);
    });
  });
}
