import { test, expect } from '@playwright/test';
import { expectNoGlobalOverflow } from '../helpers/layout.ts';

test('Arithmetica exposes a responsive in-board pause button and accessible answer feedback', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.locator('.game-card.arithmetica .play-button').click();

  const board = page.locator('.arithmetica-blackboard');
  const pause = board.locator('.arithmetica-board-pause');
  await expect(board).toBeVisible();
  await expect(pause).toBeDisabled();
  await board.locator('.arithmetica-overlay button').click();
  await expect(pause).toBeEnabled();

  await board.locator('.arithmetica-answer').first().click();
  await expect(board.locator('.arithmetica-announcement')).not.toBeEmpty();
  await expect(board.locator('.arithmetica-answer')).toHaveCount(2);
  await expect(page.locator('.arithmetica-stats')).toContainText('%');

  await pause.click();
  await expect(board.locator('.arithmetica-overlay')).toBeVisible();
  const stoppedTime = await board.locator('.arithmetica-time').getAttribute('aria-valuenow');
  await page.waitForTimeout(200);
  await expect(board.locator('.arithmetica-time')).toHaveAttribute('aria-valuenow', stoppedTime!);

  await board.locator('.arithmetica-overlay button').click();
  await expect(board.locator('.arithmetica-overlay')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(board.locator('.arithmetica-overlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(board.locator('.arithmetica-overlay')).toHaveCount(0);

  await expectNoGlobalOverflow(page);
});
