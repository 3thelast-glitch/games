import { expect, test } from '@playwright/test';

for (const [name, size, cells, pawns] of [
  ['Classic', 4, 52, 16],
  ['Hexa', 6, 78, 24],
  ['Octa', 8, 104, 32],
  ['Grand', 10, 130, 40],
] as const) {
  for (const viewport of [{width:320,height:568},{width:390,height:844}]) {
    test('Ludo '+name+' '+viewport.width+'px loads live offline board', async ({page})=>{
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.locator('.game-card.ludo')).toBeVisible();
      await page.locator('.game-card.ludo .play-button').click();
      await expect(page.locator('.ludo-variants')).toBeVisible();
      await page.locator('.ludo-variants button').filter({hasText:name}).click();
      await page.locator('.ludo-options button').filter({hasText:'Pass & play'}).click();
      await page.locator('.ludo-start').click();
      await expect(page.locator('.ludo-board')).toBeVisible();
      await expect(page.locator('.ludo-board [data-ludo-cell]')).toHaveCount(cells);
      await expect(page.locator('.ludo-board [data-ludo-token]')).toHaveCount(pawns);
      await expect(page.locator('.ludo-player-strip > span')).toHaveCount(size);
      await expect(page.locator('.ludo-dice-line button')).toBeEnabled();
      await page.locator('.ludo-dice-line button').click();
      await expect(page.locator('.ludo-die')).not.toHaveText('?');
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
}
