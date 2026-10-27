import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Tests the *built application*, not a CSS-only mockup. Run using
// npx playwright test --config=playwright.library.config.ts
const viewports = [
  { width: 320, height: 740, columns: [3, 3] },
  { width: 390, height: 844, columns: [4, 4] },
  { width: 430, height: 932, columns: [4, 4] },
  { width: 768, height: 1024, columns: [5, 7] },
  { width: 1280, height: 900, columns: [7, 9] },
  { width: 1920, height: 1080, columns: [9, 12] },
] as const;

const languages = [
  { id: 'en', locale: 'en-US', dir: 'ltr' },
  { id: 'ar', locale: 'ar-SA', dir: 'rtl' },
] as const;

for (const lang of languages) {
  for (const viewport of viewports) {
    test(`production library ${lang.id} ${viewport.width}x${viewport.height}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        locale: lang.locale,
        deviceScaleFactor: viewport.width <= 430 ? 2 : 1,
        reducedMotion: 'reduce',
      });
      try {
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('lang', lang.id);
        await expect(page.locator('html')).toHaveAttribute('dir', lang.dir);
        await expect(page.locator('.naqla-app-grid .naqla-icon-tile')).toHaveCount(24);
        await expect(page.locator('.naqla-icon-frame').first()).toBeVisible();

        const measurement = await page.evaluate(() => {
          const frames = [...document.querySelectorAll<HTMLElement>('.naqla-icon-frame')];
          const bounds = frames.map((element) => element.getBoundingClientRect());
          const firstTop = bounds[0]?.top ?? 0;
          return {
            columns: bounds.filter((rect) => Math.abs(rect.top - firstTop) < 2).length,
            iconSize: Math.round(bounds[0]?.width ?? 0),
            firstRowTop: Math.round(firstTop),
            aspectError: Math.max(...bounds.map((rect) => Math.abs(rect.width - rect.height))),
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            overflowingElements: [...document.querySelectorAll<HTMLElement>('body *')]
              .map((element) => {
                const rect = element.getBoundingClientRect();
                return {
                  name: element.tagName.toLowerCase(),
                  className: typeof element.className === 'string' ? element.className.slice(0, 64) : '',
                  left: Math.round(rect.left),
                  right: Math.round(rect.right),
                };
              })
              .filter((item) => item.left < -1 || item.right > innerWidth + 1)
              .slice(0, 10),
          };
        });
        await mkdir('artifacts/library', { recursive: true });
        const imagePath = `artifacts/library/${lang.id}-${viewport.width}x${viewport.height}.png`;
        await page.screenshot({ path: imagePath, fullPage: true, animations: 'disabled' });
        console.log(JSON.stringify({ ...measurement, language: lang.id, viewport: viewport.width, imagePath }));

        expect(measurement.columns).toBeGreaterThanOrEqual(viewport.columns[0]);
        expect(measurement.columns).toBeLessThanOrEqual(viewport.columns[1]);
        expect(measurement.aspectError).toBeLessThanOrEqual(1);
        expect(measurement.scrollWidth).toBeLessThanOrEqual(measurement.clientWidth + 1);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
}
