import { expect, test } from '@playwright/test';

/**
 * Regression: the user reported the full 105-stage catalogue opening instead
 * of gameplay. On Android landscape widths (>600px) the level selector was
 * unintentionally visible even though showChoose started false.
 *
 * The board must appear immediately; stage selection is opt-in on all screens.
 */
for (const {name,width,height} of [
  {name:'Android landscape',width:844,height:390},
  {name:'Android portrait',width:390,height:844},
  {name:'desktop',width:1366,height:768},
]) {
  test(`Apple Worm opens playable board, not level catalogue: ${name}`, async ({page})=>{
    await page.setViewportSize({width,height});
    await page.goto('/');
    await page.addStyleTag({content:`
      *, *::before, *::after {animation:none!important;transition:none!important;}
    `});
    const card=page.locator('.game-card.appleWorm');
    await expect(card).toBeVisible();
    await card.locator('.play-button').click();

    const game=page.locator('body > .worm-immersive.worm-source-play');
    await expect(game).toBeVisible();
    await expect(game.locator('svg[data-source-level="1"]')).toBeVisible();
    await expect(game).toHaveAttribute('data-source-stage-count','105');
    await expect(game.locator('.worm-video-gallery')).toHaveCount(0);

    // No giant stage-list page may open automatically.
    const picker=game.locator('#worm-source-levels');
    await expect(picker).toHaveAttribute('data-open','false');
    await expect(picker).toBeHidden();

    const choose=game.locator('button[aria-controls="worm-source-levels"]');
    await choose.click();
    await expect(picker).toHaveAttribute('data-open','true');
    await expect(picker).toBeVisible();
    await choose.click();
    await expect(picker).toBeHidden();

    // Closing stage picker never leaves gameplay.
    await expect(game.locator('svg[data-source-level="1"]')).toBeVisible();
  });
}
