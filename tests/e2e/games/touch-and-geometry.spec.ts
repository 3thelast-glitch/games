import { test, expect, type Browser, type Locator, type Page } from '@playwright/test';
import { locales, type GameId } from '../fixtures/matrix.ts';
import { openLocalGame } from '../helpers/game.ts';
import { expectCenterHitTarget, expectNoGlobalOverflow, expectSquare } from '../helpers/layout.ts';

const mobile = { width: 390, height: 844 };

async function activate(
  target: Locator,
  browserName: string,
  position?: { x: number; y: number },
) {
  // Playwright does not expose touch emulation for Firefox. Keep real tap
  // coverage on Chromium/WebKit and use the equivalent pointer activation on
  // Firefox so the cross-browser geometry suite still validates hit targets.
  if (browserName === 'firefox') {
    await target.click(position ? { position } : undefined);
    return;
  }
  await target.tap(position ? { position } : undefined);
}

async function withMobileGame(
  browser: Browser,
  browserName: string,
  gameId: GameId,
  locale: (typeof locales)[number],
  run: (page: Page) => Promise<void>,
) {
  const touch = browserName !== 'firefox';
  const context = await browser.newContext({
    viewport: mobile,
    locale: locale.locale,
    hasTouch: touch,
    isMobile: touch,
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
      await activate(marble, browserName);
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
      await activate(target, browserName, { x: 12, y: 12 });
      await expect.poll(() => pawn.getAttribute('style')).not.toBe(before);
      await expectNoGlobalOverflow(page);
    });
  });

  test(`Checkers selectable pieces and board remain reachable (${locale.id})`, async ({ browser, browserName }) => {
    await withMobileGame(browser, browserName, 'checkers', locale, async (page) => {
      const board = page.locator('.checkers-board');
      await expectSquare(board, 'Checkers board', 3);
      const enabled = board.locator('button:not(:disabled)');
      expect(await enabled.count()).toBeGreaterThan(0);
      await expectCenterHitTarget(enabled.first(), 'Checkers enabled square');
      await activate(enabled.first(), browserName);
      await expectNoGlobalOverflow(page);
    });
  });

  test(`Gomoku corner and center targets remain reachable (${locale.id})`, async ({ browser, browserName }) => {
    await withMobileGame(browser, browserName, 'gomoku', locale, async (page) => {
      const scroller = page.locator('.board-scroll');
      const cells = page.locator('.gomoku-board .intersection');
      await expect(cells).toHaveCount(225);
      for (const index of [0, 112, 224]) {
        const cell = cells.nth(index);
        await cell.scrollIntoViewIfNeeded();
        await expectCenterHitTarget(cell, `Gomoku intersection ${index}`);
      }
      await scroller.evaluate((element) => (element.scrollLeft = element.scrollWidth));
      expect(await scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThanOrEqual(0);
      await expectNoGlobalOverflow(page);
    });
  });

  test(`Nine Men's Morris nodes stay on the board (${locale.id})`, async ({ browser, browserName }) => {
    await withMobileGame(browser, browserName, 'nineMensMorris', locale, async (page) => {
      const board = page.locator('.morris-board');
      await expectSquare(board, 'Morris board', 3);
      const boardBox = await board.boundingBox();
      expect(boardBox).not.toBeNull();
      const nodes = page.locator('.morris-point');
      await expect(nodes).toHaveCount(24);
      if (boardBox) {
        for (const index of [0, 6, 12, 18, 23]) {
          const box = await nodes.nth(index).boundingBox();
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
      await activate(nodes.first(), browserName);
      await expectNoGlobalOverflow(page);
    });
  });

  test(`Connect Four edge columns and circular slots remain correct (${locale.id})`, async ({ browser, browserName }) => {
    await withMobileGame(browser, browserName, 'connectFour', locale, async (page) => {
      const columns = page.locator('.connect-column');
      await expect(columns).toHaveCount(7);
      await expectCenterHitTarget(columns.first(), 'Connect Four first column');
      await expectCenterHitTarget(columns.last(), 'Connect Four last column');
      for (const index of [0, 6, 35, 41])
        await expectSquare(page.locator('.connect-slot').nth(index), `Connect Four slot ${index}`, 2);
      await activate(columns.last(), browserName);
      await expect(columns.last().locator('.board-disc')).toHaveCount(1);
      await expectNoGlobalOverflow(page);
    });
  });

  test(`Reversi corners, legal moves and disc placement stay aligned (${locale.id})`, async ({ browser, browserName }) => {
    await withMobileGame(browser, browserName, 'reversi', locale, async (page) => {
      const board = page.locator('.reversi-board');
      const cells = board.locator('.reversi-cell');
      await expectSquare(board, 'Reversi board', 3);
      await expect(cells).toHaveCount(64);
      for (const index of [0, 7, 56, 63]) {
        await expectSquare(cells.nth(index), `Reversi corner ${index}`, 2);
        await expectCenterHitTarget(cells.nth(index), `Reversi corner ${index}`);
      }
      const legal = board.locator('.reversi-cell:not(:disabled)');
      await expect(legal).toHaveCount(4);
      await expectCenterHitTarget(legal.first(), 'Reversi legal move');
      await activate(legal.first(), browserName);
      await expect(board.locator('.reversi-disc')).toHaveCount(5);
      await expect(board.locator('.reversi-disc.flipped')).toHaveCount(1);
      await expect(board.locator('.reversi-cell:not(:disabled)')).not.toHaveCount(4);
      await expectNoGlobalOverflow(page);
    });
  });

  test(`Digital Game rack and actions remain reachable (${locale.id})`, async ({ browser, browserName }) => {
    await withMobileGame(browser, browserName, 'digitalGame', locale, async (page) => {
      const rack = page.locator('.digital-rack');
      const tiles = rack.locator('.digital-tile');
      expect(await tiles.count()).toBeGreaterThanOrEqual(14);
      await tiles.last().scrollIntoViewIfNeeded();
      await expectCenterHitTarget(tiles.last(), 'Digital last rack tile');
      await activate(tiles.first(), browserName);
      await expect(tiles.first()).toHaveClass(/selected/);
      const actions = page.locator('.digital-actions button');
      expect(await actions.count()).toBeGreaterThanOrEqual(2);
      for (let index = 0; index < (await actions.count()); index++)
        await expectCenterHitTarget(actions.nth(index), `Digital action ${index}`);
      await expectNoGlobalOverflow(page);
    });
  });

  test(`Dots and Boxes edge targets stay separated at intersections (${locale.id})`, async ({ browser, browserName }) => {
    await withMobileGame(browser, browserName, 'dotsAndBoxes', locale, async (page) => {
      const board = page.locator('.dots-board');
      await expectSquare(board, 'Dots and Boxes board', 3);
      await expect(board).toHaveAttribute('dir', 'ltr');
      const horizontal = page.locator('.dots-edge.horizontal:not(:disabled)').first();
      const vertical = page.locator('.dots-edge.vertical:not(:disabled)').first();
      await expectCenterHitTarget(horizontal, 'Dots horizontal edge');
      await expectCenterHitTarget(vertical, 'Dots vertical edge');

      const [hBox, vBox] = await Promise.all([horizontal.boundingBox(), vertical.boundingBox()]);
      expect(hBox).not.toBeNull();
      expect(vBox).not.toBeNull();
      if (hBox && vBox) {
        const overlapX = Math.max(0, Math.min(hBox.x + hBox.width, vBox.x + vBox.width) - Math.max(hBox.x, vBox.x));
        const overlapY = Math.max(0, Math.min(hBox.y + hBox.height, vBox.y + vBox.height) - Math.max(hBox.y, vBox.y));
        expect(overlapX * overlapY, 'Dots adjacent edge hit boxes must not overlap').toBe(0);
      }

      await activate(horizontal, browserName);
      await expect(page.locator('.dots-edge.last-edge')).toHaveCount(1);
      await expect(page.locator('.dots-edge.last-edge')).toHaveAttribute('aria-current', 'true');
      await expectNoGlobalOverflow(page);
    });
  });

  test(`Dominoes hand and chain controls remain reachable (${locale.id})`, async ({ browser, browserName }) => {
    await withMobileGame(browser, browserName, 'dominoes', locale, async (page) => {
      const chain = page.locator('.domino-chain-shell');
      const hand = page.locator('.domino-hand');
      await expect(chain).toBeVisible();
      await expect(hand).toBeVisible();
      await expect(page.locator('.domino-hand-tile')).toHaveCount(7);

      const playable = page.locator('.domino-hand-tile:not(:disabled)').first();
      await expectCenterHitTarget(playable, 'Domino playable tile');
      await activate(playable, browserName);
      await expect(page.locator('.domino-chain-item')).toHaveCount(1);

      const nav = page.locator('.domino-chain-nav button');
      await expect(nav).toHaveCount(2);
      await expectCenterHitTarget(nav.first(), 'Domino left chain navigation');
      await expectCenterHitTarget(nav.last(), 'Domino right chain navigation');
      await expectNoGlobalOverflow(page);
    });
  });

}
