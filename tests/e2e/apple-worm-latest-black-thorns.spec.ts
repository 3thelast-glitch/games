import {test,expect} from '@playwright/test';

/** Release gate for the user's manually drawn PDF black thorns: prove that
 * the latest NAQLA game renders real hazards (not annotation pixels) on PC
 * and touch-screen viewports, keeping ALL 105 levels unlocked.
 */
for(const viewport of [{width:390,height:844},{width:844,height:390},{width:1366,height:768}]){
  test(`Apple Worm PDF black thorns visible in fullscreen on ${viewport.width}x${viewport.height}`,
    async({page})=>{
      await page.setViewportSize(viewport);
      await page.goto('/');
      await page.addStyleTag({content:'*, *::before, *::after {animation:none!important;transition:none!important}'});
      await page.locator('.game-card.appleWorm .play-button').click();
      const app=page.locator('body > .worm-immersive.worm3');
      await expect(app).toHaveAttribute('data-worm-screen','home');
      await app.locator('.worm3-play-button').click();
      await expect(app).toHaveAttribute('data-worm-screen','levels');
      await expect(app.locator('.worm3-level-tile[data-locked="true"]')).toHaveCount(0);
      await app.getByRole('button',{name:/Next level page|صفحة المراحل التالية/}).click();
      await expect(app.getByRole('button',{name:/Level 21|المرحلة 21/,exact:true})).toBeEnabled();
      await app.getByRole('button',{name:/Level 21|المرحلة 21/,exact:true}).click();
      await expect(app).toHaveAttribute('data-worm-screen','game');
      await expect(app.locator('svg[data-source-level="21"] [data-user-marked="true"]')).toHaveCount(1);
      await expect(app.locator('[data-thorn-facing="up"]')).toHaveCount(1);

      await app.locator('.worm3-game .worm3-top-left button').first().click();
      await expect(app).toHaveAttribute('data-worm-screen','levels');
      await app.getByRole('button',{name:/Level 30|المرحلة 30/,exact:true}).click();
      await expect(app).toHaveAttribute('data-worm-screen','game');
      await expect(app.locator('svg[data-source-level="30"] [data-user-marked="true"]')).toHaveCount(18);
      await expect(app.locator('svg[data-source-level="30"] [data-thorn-facing]')).toHaveCount(22);
      await expect(app.locator('svg[data-source-level="30"] [data-thorn-facing="left"]')).toHaveCount(4);
      await expect(app.locator('svg[data-source-level="30"] [data-thorn-facing="right"]')).toHaveCount(8);
      await expect(app.locator('svg[data-source-level="30"] [data-thorn-facing="down"]')).toHaveCount(4);
      await expect(app.locator('svg[data-source-level="30"] [data-thorn-facing="up"]')).toHaveCount(2);
    });
}
