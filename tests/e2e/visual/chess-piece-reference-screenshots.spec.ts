import { test, expect } from '@playwright/test';
import { locales, type LocaleCase } from '../fixtures/matrix.ts';
import { disableMotion, openLocalGame } from '../helpers/game.ts';

const shots = [
  { id: 'en-320x568', locale: 'en', width: 320, height: 568 },
  { id: 'ar-360x640', locale: 'ar', width: 360, height: 640 },
  { id: 'en-390x844', locale: 'en', width: 390, height: 844 },
  { id: 'ar-430x932', locale: 'ar', width: 430, height: 932 },
  { id: 'ar-768x1024', locale: 'ar', width: 768, height: 1024 },
  { id: 'en-844x390', locale: 'en', width: 844, height: 390 },
  { id: 'en-1366x768', locale: 'en', width: 1366, height: 768 },
] as const;

for (const shot of shots) {
  test(`Chess traced-piece visual evidence ${shot.id}`, async ({ browser, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium');
    const locale = locales.find((item) => item.id === shot.locale) as LocaleCase;
    const touch = shot.width < 1024;
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
      locale: locale.locale,
      hasTouch: touch,
      isMobile: touch && shot.width < 700,
      deviceScaleFactor: shot.width <= 430 ? 2 : 1,
    });
    const page = await context.newPage();
    try {
      await openLocalGame(page, 'chess', locale);
      await disableMotion(page);

      const board = page.locator('.chess-board');
      await expect(board).toBeVisible();
      await expect(board.locator('.chess-piece-svg')).toHaveCount(32);
      await expect(board.locator('.chess-piece-svg[data-piece="king"]')).toHaveCount(2);
      await expect(board.locator('.chess-piece-svg[data-piece="queen"]')).toHaveCount(2);
      await expect(board.locator('.chess-piece-svg[data-piece="rook"]')).toHaveCount(4);
      await expect(board.locator('.chess-piece-svg[data-piece="bishop"]')).toHaveCount(4);
      await expect(board.locator('.chess-piece-svg[data-piece="knight"]')).toHaveCount(4);
      await expect(board.locator('.chess-piece-svg[data-piece="pawn"]')).toHaveCount(16);

      const traced = board.locator('.chess-piece-svg[data-reference-traced="true"]');
      await expect(traced).toHaveCount(32);

      await page.screenshot({
        path: testInfo.outputPath(`${shot.id}-chess-reference-set.png`),
        fullPage: false,
      });
      await board.screenshot({
        path: testInfo.outputPath(`${shot.id}-chess-board-only.png`),
      });
    } finally {
      await context.close();
    }
  });
}
