import { expect, test } from '@playwright/test';

/**
 * Reference-driven product flow: NAQLA game card -> Apple Worm title with Play
 * -> 15 tile stage picker -> fullscreen playable board with right-side D-pad.
 * The old screenshot-preview page and stats/dashboard must not reappear.
 */
for (const {name,width,height} of [
  {name:'Android landscape',width:844,height:390},
  {name:'Android portrait',width:390,height:844},
  {name:'desktop',width:1366,height:768},
]) {
  test(`Apple Worm has 3 genuine separate screens: ${name}`, async ({page})=>{
    await page.setViewportSize({width,height});
    await page.goto('/');
    await page.addStyleTag({content:`
      *, *::before, *::after {animation:none!important;transition:none!important;}
    `});
    await page.locator('.game-card.appleWorm .play-button').click();
    const app=page.locator('body > .worm-immersive.worm3');
    await expect(app).toBeVisible();
    await expect(app).toHaveAttribute('data-worm-screen','home');
    await expect(app.locator('.worm3-title-logo')).toBeVisible();
    await expect(app.locator('button[aria-label="Play Apple Worm"], button[aria-label="العب دودة التفاح"]')).toBeVisible();
    await expect(app.locator('svg[data-source-level]')).toHaveCount(0);

    await app.locator('.worm3-play-button').click();
    await expect(app).toHaveAttribute('data-worm-screen','levels');
    await expect(app.locator('.worm3-level-grid .worm3-level-tile')).toHaveCount(15);
    await expect(app.locator('svg[data-source-level]')).toHaveCount(0);
    await expect(app.locator('.worm3-level-tile').nth(10)).toBeDisabled();

    await app.locator('.worm3-level-tile').first().click();
    await expect(app).toHaveAttribute('data-worm-screen','game');
    await expect(app.locator('svg[data-source-level="1"]')).toBeVisible();
    await expect(app).toHaveAttribute('data-source-stage-count','105');
    await expect(app.locator('.worm3-move-pad button')).toHaveCount(4);
    await expect(app.locator('.worm3-current-level')).toHaveText('01');
    await expect(app.locator('.worm-source-stats')).toHaveCount(0);
    await expect(app.locator('.worm-video-gallery')).toHaveCount(0);

    // Going back to levels returns to the second screen, NOT to a
    // confusing preview page over gameplay.
    await app.locator('.worm3-top-left button').first().click();
    await expect(app).toHaveAttribute('data-worm-screen','levels');
    await expect(app.locator('.worm3-level-grid .worm3-level-tile')).toHaveCount(15);
  });
}
