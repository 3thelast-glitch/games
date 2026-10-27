import { test, expect } from '@playwright/test';

test('NAQLA Tactics launches from the real library and plays a legal move', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('.game-card.naqlaTactics');
  await expect(card).toBeVisible();
  await card.locator('.play-button').click();
  await expect(page.locator('.naqla-tactics-root')).toBeVisible();
  await expect(page.locator('.naqla-tactics-grid [role="gridcell"]')).toHaveCount(80);
  // Mission 1 starts with a friendly infantry at B7, and navigable ground nearby.
  await page.locator('.naqla-tactics-grid [role="gridcell"]').nth(61).click();
  await expect(page.locator('.naqla-tactics-grid .can-move').first()).toBeVisible();
  await page.locator('.naqla-tactics-grid .can-move').first().click();
  await expect(page.locator('.naqla-tactics-root')).toBeVisible();
  await page.locator('.naqla-tactics-exit').first().click();
  await expect(page.locator('.game-card.naqlaTactics')).toBeVisible();
});

for (const width of [320, 390, 768, 1280, 1920]) {
  test(`tactics board is visible without horizontal page overflow at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      await page.goto('/');
      await page.locator('.game-card.naqlaTactics .play-button').click();
      await expect(page.locator('.naqla-tactics-grid [role="gridcell"]')).toHaveCount(80);
      const measurements = await page.evaluate(() => ({
        scroll: document.querySelector('.naqla-tactics-root')!.scrollWidth,
        client: document.querySelector('.naqla-tactics-root')!.clientWidth,
      }));
      expect(measurements.scroll).toBeLessThanOrEqual(measurements.client+2);
    } finally { await context.close(); }
  });
}