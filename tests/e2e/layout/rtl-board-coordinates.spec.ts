import { test, expect } from '@playwright/test';
import { gameIds, locales } from '../fixtures/matrix.ts';
import { boardSelectors, openLocalGame } from '../helpers/game.ts';

const viewport = { width: 390, height: 844 };

for (const gameId of gameIds) {
  test(`${gameId} board geometry stays logically fixed between LTR and RTL`, async ({ browser, browserName }) => {
    const boxes: Record<string, { width: number; height: number; left: number; top: number }> = {};

    for (const locale of locales) {
      const touch = browserName !== 'firefox';
      const context = await browser.newContext({
        viewport,
        locale: locale.locale,
        hasTouch: touch,
        isMobile: touch,
      });
      try {
        const page = await context.newPage();
        await openLocalGame(page, gameId, locale);
        const board = page.locator(boardSelectors[gameId]);
        const box = await board.boundingBox();
        expect(box).not.toBeNull();
        if (box)
          boxes[locale.id] = {
            width: box.width,
            height: box.height,
            left: box.x,
            top: box.y,
          };

        // Coordinate boards deliberately isolate themselves from RTL mirroring.
        // Digital Game is a localized rack/table layout and may naturally change height.
        if (gameId !== 'digitalGame') expect(await board.getAttribute('dir')).not.toBe('rtl');
      } finally {
        await context.close();
      }
    }

    expect(Math.abs(boxes.en.width - boxes.ar.width)).toBeLessThanOrEqual(2);
    if (gameId !== 'digitalGame')
      expect(Math.abs(boxes.en.height - boxes.ar.height)).toBeLessThanOrEqual(2);
  });
}
