import { test, expect, type Page } from '@playwright/test';

async function openReversiDialog(page: Page) {
  await page.goto('/');
  const card = page.locator('.game-card.reversi');
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Play now' }).click();
  const dialog = page.getByLabel('How do you want to play?');
  await expect(dialog.getByRole('heading', { name: 'Reversi', exact: true })).toBeVisible();
  return dialog;
}

test('Reversi exposes Off and 15/30/45/60/90 second turn timers', async ({ page }) => {
  const dialog = await openReversiDialog(page);
  for (const label of ['Off', '15s', '30s', '45s', '60s', '90s'])
    await expect(dialog.getByRole('button', { name: label, exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '15s', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '15s', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Start match', exact: true }).click();
  await expect(page.locator('.match-header')).toContainText('15s');
});

test('Reversi timer Off keeps the normal bank clock and labels the turn timer as off', async ({ page }) => {
  const dialog = await openReversiDialog(page);
  await expect(dialog.getByRole('button', { name: 'Off', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Start match', exact: true }).click();
  await expect(page.locator('.match-header')).toContainText('Turn: Off');
  await expect(page.locator('.match-clock').first()).toContainText('10:00');
});
