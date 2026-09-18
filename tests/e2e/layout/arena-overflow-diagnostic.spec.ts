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
  friendCode: 'ARENA000001',
  friends: [],
};

test('diagnose Arabic Arena document overflow at 320px', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium');
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 },
    locale: 'ar-SA',
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  try {
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
          const element = document.querySelector(selector) as HTMLElement | null;
          if (!element) return [selector, null];
          const rect = element.getBoundingClientRect();
          return [selector, {
            left: Math.round(rect.left * 100) / 100,
            right: Math.round(rect.right * 100) / 100,
            width: Math.round(rect.width * 100) / 100,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
          }];
        }),
      );
      return {
        viewport: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        scrollX: window.scrollX,
        bounds,
      };
    });

    console.log('ARENA_BASELINE_METRICS=' + JSON.stringify(metrics));
    expect(metrics.documentScrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.viewport + 1);
  } finally {
    await context.close();
  }
});
