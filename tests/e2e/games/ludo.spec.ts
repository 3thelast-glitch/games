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
      await expect(page.locator('.ludo-play')).toHaveAttribute('data-ludo-revision', '0');
      await page.locator('.ludo-dice-line button').click();
      // On rolls 1–5 with every token at base, the move resolves immediately.
      // A six leaves a selectable roll. Both outcomes are valid committed turns.
      await expect(page.locator('.ludo-play')).toHaveAttribute('data-ludo-revision', '1');
      const phase = await page.locator('.ludo-play').getAttribute('data-ludo-phase');
      if (phase === 'move') {
        await expect(page.locator('.ludo-die')).toHaveText('6');
        await expect(page.locator('.ludo-tray button:not(:disabled)')).toHaveCount(4);
      } else {
        await expect(page.getByText('No legal move; play advanced automatically.')).toBeVisible();
      }
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
}

test('Ludo Grand Arabic keeps board topology while reversing the surrounding UI',async ({browser})=>{
  const context=await browser.newContext({locale:'ar-SA',viewport:{width:360,height:800}});
  try{
    const page=await context.newPage();
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang','ar');
    await page.locator('.game-card.ludo .play-button').click();
    await page.locator('.ludo-variants button').nth(3).click();
    await page.locator('.ludo-options button').nth(1).click();
    await page.locator('.ludo-start').click();
    await expect(page.locator('.ludo-page')).toHaveAttribute('dir','rtl');
    await expect(page.locator('.ludo-board [data-ludo-cell]')).toHaveCount(130);
    await expect(page.locator('.ludo-board [data-ludo-token]')).toHaveCount(40);
    await expect(page.locator('.ludo-player-strip > span')).toHaveCount(10);
    await expect(page.locator('.ludo-board')).toHaveAttribute('style',/direction: ltr/);
  }finally{await context.close();}
});
