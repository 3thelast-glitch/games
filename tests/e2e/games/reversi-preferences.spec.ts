import { test, expect, type Page } from '@playwright/test';

const storageKey = 'board-arena:reversi-visual-settings';

async function startLocalReversi(page: Page) {
  await page.addInitScript((key) => window.localStorage.removeItem(key), storageKey);
  await page.goto('/');
  const card = page.locator('.game-card.reversi');
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Play now' }).click();
  const dialog = page.getByLabel('How do you want to play?');
  await expect(dialog.getByRole('heading', { name: 'Reversi', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Start match', exact: true }).click();
  const board = page.locator('.reversi-board');
  await expect(board).toBeVisible();
  return board;
}

test('Reversi board preferences control hints, preview, animation speed and coordinates', async ({ page }) => {
  const board = await startLocalReversi(page);

  await expect(board).toHaveAttribute('data-show-legal-moves', 'true');
  await expect(board).toHaveAttribute('data-move-preview', 'true');
  await expect(board).toHaveAttribute('data-animation-speed', 'normal');
  await expect(board).toHaveAttribute('data-board-coordinates', 'false');
  await expect(board.locator('.reversi-legal-dot')).toHaveCount(4);
  await expect(board.locator('.reversi-preview-disc')).toHaveCount(4);

  await page.locator('.reversi-preferences > summary').click();

  const legalToggle = page.locator('[data-reversi-setting="show-legal-moves"]');
  const previewToggle = page.locator('[data-reversi-setting="move-preview"]');
  const coordinateToggle = page.locator('[data-reversi-setting="board-coordinates"]');

  await legalToggle.uncheck();
  await expect(board).toHaveAttribute('data-show-legal-moves', 'false');
  await expect(board.locator('.reversi-legal-dot')).toHaveCount(0);
  await expect(board.locator('.reversi-cell[data-legal="true"]:not(:disabled)')).toHaveCount(4);

  await previewToggle.uncheck();
  await expect(board).toHaveAttribute('data-move-preview', 'false');
  await expect(board.locator('.reversi-preview-disc')).toHaveCount(0);

  await coordinateToggle.check();
  await expect(board).toHaveAttribute('data-board-coordinates', 'true');
  await expect(board.locator('.reversi-coordinate')).toHaveCount(16);

  const slow = page.locator('[data-reversi-speed="slow"]');
  await slow.click();
  await expect(slow).toHaveAttribute('aria-pressed', 'true');
  await expect(board).toHaveAttribute('data-animation-speed', 'slow');

  await expect.poll(async () =>
    page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? '{}'), storageKey),
  ).toEqual({
    showLegalMoves: false,
    movePreview: false,
    animationSpeed: 'slow',
    boardCoordinates: true,
  });
});
