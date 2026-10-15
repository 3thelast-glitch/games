import { test, expect } from '@playwright/test';
import { expectIntentionalScroller, expectNoGlobalOverflow } from '../helpers/layout.ts';

for (const locale of [
  { id: 'ar', locale: 'ar-SA', dir: 'rtl' },
  { id: 'en', locale: 'en-US', dir: 'ltr' },
] as const) {
  for (const width of [320, 390, 768]) {
    test(`Arena filter containment ${locale.id} ${width}px`, async ({ browser, browserName }) => {
      const touch = browserName !== 'firefox' && width < 768;
      const context = await browser.newContext({
        viewport: { width, height: 700 },
        locale: locale.locale,
        hasTouch: touch,
        isMobile: touch,
      });
      try {
        const page = await context.newPage();
        await page.goto('/');
        await page.locator('.mobile-nav button').nth(1).click();
        await expect(page.locator('html')).toHaveAttribute('dir', locale.dir);
        const scroll = page.locator('.arena-game-scroll');
        await expect(scroll).toBeVisible();
        await expect(scroll.locator('.segmented > button')).toHaveCount(12);
        await expectIntentionalScroller(scroll, 'arena game filters');
        const dimensions = await scroll.evaluate((element) => ({
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          parentWidth: element.parentElement?.clientWidth ?? 0,
        }));
        expect(dimensions.clientWidth).toBeLessThanOrEqual(dimensions.parentWidth + 2);
        expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
        await expectNoGlobalOverflow(page);
        await page.locator('.arena-game-scroll button').last().click();
        await expect(page.locator('.arena-game-scroll button').last()).toHaveAttribute('aria-pressed', 'true');
        await expectNoGlobalOverflow(page);
      } finally {
        await context.close();
      }
    });
  }
}
