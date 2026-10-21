import {test,expect} from '@playwright/test';
import {solveAppleWormLevel} from '../../packages/games/apple-worm/solvability.ts';

/** Player-facing campaign: complete L1 -> unlock L2. Old all-open QA mode
 * must NOT silently leak back into either mobile or desktop builds.
 */
for(const viewport of [{width:390,height:844},{width:844,height:390},{width:1366,height:768}]){
  test(`Apple Worm first level only, win unlocks next: ${viewport.width}x${viewport.height}`,async({page})=>{
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;}'});
    await page.locator('.game-card.appleWorm .play-button').click();
    const app=page.locator('body > .worm-immersive.worm3');
    await expect(app).toHaveAttribute('data-worm-screen','home');
    await app.locator('.worm3-play-button').click();
    await expect(app).toHaveAttribute('data-worm-screen','levels');
    await expect(app).toHaveAttribute('data-source-stage-count','105');

    const covered:number[]=[];
    for(let group=0;group<7;group++){
      const cards=app.locator('.worm3-level-tile');
      await expect(cards).toHaveCount(15);
      const ids=await cards.locator('.worm3-tile-number').allTextContents();
      covered.push(...ids.map(x=>Number(x.trim())));
      await expect(app.locator('.worm3-level-tile:not(:disabled)'))
        .toHaveCount(group===0?1:0);
      await expect(app.locator('.worm3-level-tile[data-locked="true"]'))
        .toHaveCount(group===0?14:15);
      if(group<6)await app.getByRole('button',{
        name:/Next level page|صفحة المراحل التالية/}).click();
    }
    expect(covered).toEqual(Array.from({length:105},(_,i)=>i+1));
    await expect(app.locator('.worm3-level-tile').last()).toBeDisabled();

    for(let group=6;group>0;group--)
      await app.getByRole('button',{name:/Previous level page|صفحة المراحل السابقة/}).click();
    const initial=app.locator('.worm3-level-tile');
    await expect(initial.first()).toBeEnabled();
    await expect(initial.nth(1)).toBeDisabled();
    await initial.first().click();
    await expect(app.locator('svg[data-source-level="1"]')).toBeVisible();

    // Find a legitimate winning sequence using exactly the current game's
    // engine; never fake 'won' state or manually unlock a level.
    const solved=solveAppleWormLevel(1,{maxStates:12000,maxMillis:2000});
    expect(solved.status).toBe('won');
    expect(solved.route?.length).toBeGreaterThan(0);
    for(const dir of solved.route!)
      await app.locator('.worm3-pad-'+dir).click();

    // The completed screen briefly celebrates, then automatically opens L2.
    await expect(app.locator('svg[data-source-level="2"]')).toBeVisible({timeout:7000});
    await app.locator('.worm3-game .worm3-top-left button').first().click();
    await expect(app).toHaveAttribute('data-worm-screen','levels');
    const after=app.locator('.worm3-level-tile');
    await expect(after.first().locator('.worm3-tile-stars')).toHaveText('★★★');
    await expect(after.nth(1)).toBeEnabled();
    await expect(after.nth(2)).toBeDisabled();
    await expect(app.locator('.worm3-level-tile[data-locked="true"]')).toHaveCount(13);

    // Completion persists, rather than resetting to all-open testing mode.
    await page.reload();
    await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;}'});
    await page.locator('.game-card.appleWorm .play-button').click();
    const again=page.locator('body > .worm-immersive.worm3');
    await again.locator('.worm3-play-button').click();
    await expect(again.locator('.worm3-level-tile').nth(1)).toBeEnabled();
    await expect(again.locator('.worm3-level-tile').nth(2)).toBeDisabled();
  });
}
