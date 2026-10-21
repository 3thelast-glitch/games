import {test,expect} from '@playwright/test';

/** Player-requested QA behavior: all 105 source-video stages should be open
 * for direct review. Selection must never fabricate completed stages/stars.
 */
for(const viewport of [{width:390,height:844},{width:844,height:390},{width:1366,height:768}]){
  test(`Apple Worm all 105 unlocked at ${viewport.width}x${viewport.height}`,async({page})=>{
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;}'});
    await page.locator('.game-card.appleWorm .play-button').click();
    const app=page.locator('body > .worm-immersive.worm3');
    await expect(app).toHaveAttribute('data-worm-screen','home');
    await app.locator('.worm3-play-button').click();
    await expect(app).toHaveAttribute('data-worm-screen','levels');
    await expect(app).toHaveAttribute('data-source-stage-count','105');

    const discovered=new Set<number>();
    for(let group=0;group<7;group++){
      const cards=app.locator('.worm3-level-tile');
      await expect(cards).toHaveCount(15);
      await expect(app.locator('.worm3-level-tile:disabled')).toHaveCount(0);
      await expect(app.locator('.worm3-level-tile[data-locked="true"]')).toHaveCount(0);
      await expect(app.locator('.worm3-padlock')).toHaveCount(0);
      const ids=await cards.locator('.worm3-tile-number').allTextContents();
      for(const txt of ids)discovered.add(Number(txt.trim()));
      if(group<6)
        await app.getByRole('button',{name:/Next level page|صفحة المراحل التالية/}).click();
    }
    expect([...discovered].sort((a,b)=>a-b)).toEqual(
      Array.from({length:105},(_,i)=>i+1));
    await expect(app.getByRole('button',{name:/Level 105|المرحلة 105/})).toBeEnabled();

    // Open final stage immediately, despite no preceding 104 wins.
    await app.getByRole('button',{name:/Level 105|المرحلة 105/}).click();
    await expect(app).toHaveAttribute('data-worm-screen','game');
    await expect(app.locator('svg[data-source-level="105"]')).toBeVisible();
    await expect(app.locator('.worm3-current-level')).toHaveText('105');

    // Returning should preserve page 7 and let any earlier stage be tested.
    await app.locator('.worm3-game .worm3-top-left button').first().click();
    await expect(app).toHaveAttribute('data-worm-screen','levels');
    await expect(app.getByRole('button',{name:/Level 91|المرحلة 91/})).toBeEnabled();
    await expect(app.getByRole('button',{name:/Next level page|صفحة المراحل التالية/})).toBeDisabled();
    await app.getByRole('button',{name:/Level 91|المرحلة 91/}).click();
    await expect(app.locator('svg[data-source-level="91"]')).toBeVisible();

    // Selecting and reviewing stages is not the same as winning.
    await app.locator('.worm3-game .worm3-top-left button').first().click();
    await expect(app.getByRole('button',{name:/Level 91|المرحلة 91/})
      .locator('.worm3-tile-stars')).not.toHaveText('★★★');
  });
}
