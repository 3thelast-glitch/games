import { test, expect } from '@playwright/test';
import { expectNoGlobalOverflow } from '../helpers/layout.ts';

for(const language of ['en','ar'] as const) for(const [width,height] of [[320,568],[390,844],[568,320],[844,390],[1024,768]]) {
  test(`screenshot Apple Worm ${language} ${width}x${height}: move, undo, restart, resume, 105 stages`,async({browser})=>{
    const context=await browser.newContext({viewport:{width,height},locale:language==='ar'?'ar-SA':'en-US'});
    const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    try {
      await page.goto('/');
      await page.locator('.game-card.appleWorm .play-button').click();
      await expect(page.locator('.screenshot-worm-page')).toBeVisible();
      await expect(page.locator('.screenshot-worm-board')).toHaveAttribute('data-level','1');
      await expect(page.locator('.screenshot-worm-page')).toHaveAttribute('dir',language==='ar'?'rtl':'ltr');
      await expect(page.locator('.screenshot-worm-board')).toHaveCSS('direction','ltr');
      await expect(page.locator('.source-moves')).toHaveText('0');
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('.source-moves')).toHaveText('1');
      await page.getByRole('button',{name:language==='ar'?'تراجع':'Undo',exact:true}).click();
      await expect(page.locator('.source-moves')).toHaveText('0');
      await page.keyboard.press('ArrowRight');
      await expect.poll(()=>page.evaluate(()=>localStorage.getItem('CapacitorStorage.arena:apple-worm-screenshots-105-v1'))).toContain('right');
      await page.reload();await page.locator('.game-card.appleWorm .play-button').click();
      await expect(page.locator('.source-moves')).toHaveText('1');
      await page.getByRole('button',{name:language==='ar'?'إعادة المرحلة':'Restart',exact:true}).click();
      await expect(page.locator('.source-moves')).toHaveText('0');
      const board=page.locator('.screenshot-worm-board');
      const r=await board.boundingBox();if(!r)throw new Error('Board missing');
      await page.mouse.move(r.x+r.width*.3,r.y+r.height*.5);await page.mouse.down();
      await page.mouse.move(r.x+r.width*.3+60,r.y+r.height*.5);await page.mouse.up();
      await expect(page.locator('.source-moves')).toHaveText('1');
      await page.getByRole('button',{name:language==='ar'?'اختيار المرحلة':'Choose stage',exact:true}).click();
      await expect(page.getByRole('tab')).toHaveCount(7);
      await page.getByRole('tab',{name:'91–105'}).click();
      await expect(page.locator('.source-stage-grid button')).toHaveCount(15);
      await expect(page.locator('.source-stage-grid button').last()).toBeDisabled();
      await page.locator('.source-practice input').check();
      await page.getByRole('button',{name:language==='ar'?'المرحلة 105':'Stage 105',exact:true}).click();
      await expect(board).toHaveAttribute('data-level','105');
      await expectNoGlobalOverflow(page);
      const footer=await page.locator('.screenshot-worm-footer').boundingBox();
      expect(footer!.y+footer!.height).toBeLessThanOrEqual(height+1);
      await page.locator('.source-exit').click();
      await expect(page.locator('.game-card.appleWorm .play-button')).toBeVisible();
      expect(errors).toEqual([]);
    }finally{await context.close();}
  });
}
