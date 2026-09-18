import { test, expect } from '@playwright/test';
import { disableMotion } from '../helpers/game.ts';

const entries = [
  {
    id: 'shot-1',
    name: 'عبدالله بن محمد الاستراتيجي',
    avatar: 'crown',
    rating: 1842,
    rank: 'Master',
    position: 1,
    score: 1842,
    played: 42,
  },
  {
    id: 'shot-2',
    name: 'Alexander The Strategist With A Long Name',
    avatar: 'orbit',
    rating: 1710,
    rank: 'Diamond',
    position: 2,
    score: 1710,
    played: 39,
  },
  {
    id: 'shot-3',
    name: 'Nawaf لاعب NAQLA 2026',
    avatar: 'comet',
    rating: 1588,
    rank: 'Platinum',
    position: 3,
    score: 1588,
    played: 31,
  },
  {
    id: 'shot-4',
    name: 'VeryLongUnbrokenLeaderboardName012345678901234567890',
    avatar: 'hex',
    rating: 1440,
    rank: 'Gold',
    position: 4,
    score: 1440,
    played: 28,
  },
];

const cases = [
  { id: 'ar-320x568', locale: 'ar-SA', width: 320, height: 568, empty: false },
  { id: 'ar-360x800-empty', locale: 'ar-SA', width: 360, height: 800, empty: true },
  { id: 'ar-360x800', locale: 'ar-SA', width: 360, height: 800, empty: false },
  { id: 'ar-390x844', locale: 'ar-SA', width: 390, height: 844, empty: false },
  { id: 'ar-412x915', locale: 'ar-SA', width: 412, height: 915, empty: false },
  { id: 'ar-800x360', locale: 'ar-SA', width: 800, height: 360, empty: false },
  { id: 'en-390x844', locale: 'en-US', width: 390, height: 844, empty: false },
  { id: 'ar-768x1024', locale: 'ar-SA', width: 768, height: 1024, empty: false },
  { id: 'en-1440x900', locale: 'en-US', width: 1440, height: 900, empty: false },
] as const;

test('capture deterministic Arena final screenshots', async ({ browser, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium');

  for (const shot of cases) {
    const touch = shot.width <= 1024;
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
      locale: shot.locale,
      hasTouch: touch,
      isMobile: touch && shot.width < 700,
      deviceScaleFactor: shot.width < 700 ? 2 : 1,
    });
    const page = await context.newPage();
    try {
      await page.route('**/api/leaderboard**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ entries: shot.empty ? [] : entries }),
        });
      });
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute(
        'dir',
        shot.locale.startsWith('ar') ? 'rtl' : 'ltr',
      );
      const nav = page.locator('.sidebar nav button:visible, .mobile-nav button:visible');
      await nav.nth(1).click();
      await expect(page.locator('.arena-page')).toBeVisible();
      await expect(page.locator('.loading-state')).toHaveCount(0);
      await disableMotion(page);

      await page.screenshot({
        path: testInfo.outputPath(`${shot.id}-viewport.png`),
        fullPage: false,
      });
      await page.screenshot({
        path: testInfo.outputPath(`${shot.id}-full.png`),
        fullPage: true,
      });
    } finally {
      await context.close();
    }
  }
});
