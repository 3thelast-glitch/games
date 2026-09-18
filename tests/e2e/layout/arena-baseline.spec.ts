import { test, expect } from '@playwright/test';

const guestProfile = {
  id: 'guest-arena',
  name: 'Guest',
  avatar: 'orbit',
  guest: true,
  level: 1,
  totalMatches: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  winRate: 0,
  favorites: [],
  ratings: {},
  history: [],
  friendCode: 'ARENA1',
  friends: [],
};

test('captures the current Arabic Arena overflow at 320px', async ({ browserName, page }) => {
  test.skip(browserName !== 'chromium');

  await page.route('**/api/auth/guest', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'arena-test-token', profile: guestProfile }),
    });
  });
  await page.route('**/api/leaderboard**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ entries: [] }),
    });
  });

  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

  await page.locator('.mobile-nav button').nth(1).click();
  await expect(page.locator('.leaderboard-panel')).toBeVisible();
  await expect(page.locator('.loading-state')).toHaveCount(0);

  const metrics = await page.evaluate(() => {
    const selectors = [
      '.app-shell',
      '.main-shell',
      '.topbar',
      '.main-content',
      '.page-heading',
      '.leaderboard-controls',
      '.leaderboard-controls .segmented',
      '.period-tabs',
      '.leaderboard-panel',
      '.rank-ladder',
    ];
    const bounds = Object.fromEntries(
      selectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!element) return [selector, null];
        const rect = element.getBoundingClientRect();
        return [
          selector,
          {
            left: Math.round(rect.left * 100) / 100,
            right: Math.round(rect.right * 100) / 100,
            width: Math.round(rect.width * 100) / 100,
            scrollWidth: (element as HTMLElement).scrollWidth,
            clientWidth: (element as HTMLElement).clientWidth,
          },
        ];
      }),
    );
    return {
      viewport: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      bounds,
    };
  });

  console.log('ARENA_BASELINE_METRICS', JSON.stringify(metrics));
  expect(
    metrics.documentScrollWidth,
    `Arena baseline document overflow: ${JSON.stringify(metrics)}`,
  ).toBeLessThanOrEqual(metrics.viewport + 1);
});
