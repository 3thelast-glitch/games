import { test, expect, type Page } from '@playwright/test';
import { expectNoGlobalOverflow } from '../helpers/layout.ts';

async function openArithmetica(page: Page) {
  await page.goto('/');
  await page.locator('.game-card.arithmetica .play-button').click();
  await expect(page.locator('[data-arithmetica-screen="home"]')).toBeVisible();
}

test('Arithmetica starts fullscreen and only begins the clock after START', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openArithmetica(page);
  await expect(page.locator('.arithmetica-start-button')).toBeVisible();
  await expect(page.locator('.arithmetica-blackboard')).toHaveCount(0);
  await expect(page.locator('.arithmetica-start-stats')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-immersive-game', 'arithmetica');
  await page.locator('.arithmetica-start-button').click();

  const board = page.locator('.arithmetica-blackboard');
  const pause = board.locator('.arithmetica-board-pause');
  await expect(board).toBeVisible();
  await expect(pause).toBeEnabled();

  await board.locator('.arithmetica-answer').first().click();
  await expect(board.locator('.arithmetica-announcement')).not.toBeEmpty();
  await expect(board.locator('.arithmetica-answer')).toHaveCount(2);
  await expect(page.locator('.arithmetica-stats')).toContainText('%');

  await pause.click();
  await expect(board.locator('.arithmetica-overlay')).toBeVisible();
  const stoppedTime = await board.locator('.arithmetica-time').getAttribute('aria-valuenow');
  await page.waitForTimeout(180);
  await expect(board.locator('.arithmetica-time')).toHaveAttribute('aria-valuenow', stoppedTime!);

  await board.locator('.arithmetica-overlay button').first().click();
  await expect(board.locator('.arithmetica-overlay')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(board.locator('.arithmetica-overlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(board.locator('.arithmetica-overlay')).toHaveCount(0);

  await expectNoGlobalOverflow(page);
  await page.locator('.arithmetica-heading .button.secondary').click();
  await expect(page.locator('[data-arithmetica-screen="home"]')).toBeVisible();
  await page.locator('.arithmetica-exit').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-immersive-game', 'arithmetica');
});

test('Clearing five questions saves a new stage and the start screen resumes there after reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openArithmetica(page);
  await expect(page.locator('[data-arithmetica-best-level]')).toHaveText('1');
  await page.locator('.arithmetica-start-button').click();
  const board = page.locator('.arithmetica-blackboard');

  for (let i = 0; i < 5; i++) {
    const spans = board.locator('.arithmetica-question > span');
    const left = Number(await spans.nth(0).innerText());
    const op = await spans.nth(1).innerText();
    const right = Number(await spans.nth(2).innerText());
    const result = op === '+' ? left + right : op === '-' ? left - right
      : op === '×' ? left * right : left / right;
    const choices = board.locator('.arithmetica-answer');
    const first = Number(await choices.nth(0).innerText());
    await choices.nth(first === result ? 0 : 1).click();
    await expect(board.locator('.arithmetica-question')).toContainText('?');
    await page.waitForTimeout(155); // Prevent intentionally guarded double taps.
  }
  await expect(page.locator('.arithmetica-level')).toContainText('2');
  await expect(page.locator('[data-arithmetica-best-level]')).toHaveText('2');

  await page.locator('.arithmetica-heading .button.secondary').click();
  await expect(page.locator('[data-arithmetica-screen="home"]')).toBeVisible();
  await expect(page.locator('[data-arithmetica-selected-level]')).toHaveText('2');
  await page.locator('.arithmetica-levels-toggle').click();
  await expect(page.locator('.arithmetica-stage').nth(0)).toHaveClass(/cleared/);
  await expect(page.locator('.arithmetica-stage').nth(1)).toHaveClass(/selected/);
  await expect(page.locator('.arithmetica-stage').nth(2)).toBeDisabled();

  await page.locator('.arithmetica-exit').click();
  await page.reload();
  await page.locator('.game-card.arithmetica .play-button').click();
  await expect(page.locator('[data-arithmetica-best-level]')).toHaveText('2');
  await expect(page.locator('[data-arithmetica-selected-level]')).toHaveText('2');
  await page.locator('.arithmetica-start-button').click();
  await expect(page.locator('.arithmetica-level')).toContainText('2');
  await expectNoGlobalOverflow(page);
});
