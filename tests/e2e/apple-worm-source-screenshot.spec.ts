import {test,expect} from '@playwright/test';

/** The source-derived 105-stage game now has three distinct screens,
 * rather than a debug dashboard / gallery mixed with the actual level.
 */
test('original 105-stage gameplay follows title → stage select → fullscreen puzzle',async({page})=>{
  const uncaught:string[]=[];
  page.on('pageerror',error=>uncaught.push(error.message));
  await page.goto('/');
  await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});
  await page.locator('.game-card.appleWorm .play-button').click();
  const game=page.locator('body > [data-stage-origin="user-screenshot"]');
  await expect(game).toBeVisible();
  await expect(game).toHaveAttribute('data-source-stage-count','105');
  await expect(game).toHaveAttribute('data-visual-revision','PDF105-R12');
  await expect(game).toHaveAttribute('data-worm-screen','home');
  await expect(game.locator('.worm3-title-logo')).toBeVisible();
  await expect(game.locator('svg[data-source-level]')).toHaveCount(0);

  await game.locator('.worm3-play-button').click();
  await expect(game).toHaveAttribute('data-worm-screen','levels');
  await expect(game.locator('.worm3-level-tile')).toHaveCount(15);
  await expect(game.locator('.worm3-level-tile').nth(10)).toBeDisabled();
  await game.getByRole('button',{name:'Next level page'}).click();
  await expect(game.locator('.worm3-level-tile').first()).toBeDisabled();
  await game.getByRole('button',{name:'Previous level page'}).click();

  await game.getByRole('button',{name:'Level 1'}).click();
  await expect(game).toHaveAttribute('data-worm-screen','game');
  const board=game.locator('svg[data-source-level="1"]');
  await expect(board).toBeVisible();
  await expect(board).toHaveAttribute('viewBox','0 0 630 270');
  await expect(board).toHaveAttribute('data-terrain-cell-count','12');
  await expect(board.locator('[data-source-terrain="premium-art"]')).toHaveCount(1);
  await expect(board.locator('.worm-character')).toHaveCount(1);
  await expect(board.locator('.worm-terrain')).toHaveCount(1);
  await expect(board.locator('.worm-portal-ready')).toHaveCount(1);
  await expect(board.locator('.worm-clouds')).toHaveCount(0); // forest remains fullscreen background
  await expect(board.locator('[data-source-worm]')).toHaveAttribute('data-body-length','3');
  await expect(board.locator('[data-source-apple]')).toHaveCount(0);
  await expect(board.locator('[data-source-portal]')).toHaveCount(1);
  await expect(game.locator('.worm-source-stats')).toHaveCount(0);
  await expect(game.locator('.worm3-move-pad button')).toHaveCount(4);

  await game.getByRole('button',{name:'Move right'}).click();
  await expect(game.locator('.worm3-game')).toBeVisible();
  await game.getByRole('button',{name:'Game menu'}).click();
  await game.getByRole('button',{name:'Undo'}).click();
  await game.getByRole('button',{name:'Level Select'}).click();
  await expect(game).toHaveAttribute('data-worm-screen','levels');
  await game.getByRole('button',{name:'Level 2'}).click();
  const second=game.locator('svg[data-source-level="2"]');
  await expect(second).toBeVisible();
  await expect(second.locator('[data-source-portal]')).toHaveCount(1);
  await expect(second.locator('[data-source-worm]')).toHaveCount(1);
  await expect(game.locator('.worm-video-gallery')).toHaveCount(0);
  expect(uncaught).toEqual([]);
});
