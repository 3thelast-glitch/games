import {test,expect} from '@playwright/test';
import {expectNoGlobalOverflow} from '../helpers/layout.ts';

/** Start portrait in NAQLA, rotate the phone, play full-viewport, then exit. */
for(const locale of [{id:'ar',name:'ar-SA',dir:'rtl'},{id:'en',name:'en-US',dir:'ltr'}] as const){
 for(const shortSide of [320,360,390,430] as const){
  test('Apple Worm landscape '+locale.id+' '+shortSide+'px touch/undo/exit',async ({browser,browserName})=>{
   const touch=browserName!=='firefox';
   const longSide=shortSide===320?568:shortSide===360?740:shortSide===390?844:932;
   const context=await browser.newContext({
    locale:locale.name,viewport:{width:shortSide,height:longSide},
    isMobile:touch,hasTouch:touch,deviceScaleFactor:2,
   });
   try {
    const page=await context.newPage();
    const errors:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('dir',locale.dir);
    await page.locator('.game-card.appleWorm .play-button').click();
    await expect(page.locator('.worm-page')).toBeVisible();
    await expect(page.locator('.worm-rotate-gate')).toBeVisible();
    await expect(page.locator('.worm-pad')).toHaveCount(0);
    await expect(page.locator('.worm-panel')).toHaveCount(0);
    await page.setViewportSize({width:longSide,height:shortSide});
    await expect(page.locator('.worm-rotate-gate')).toBeHidden();
    await expect(page.locator('.topbar')).toBeHidden();
    await expect(page.locator('.mobile-nav')).toBeHidden();
    await expect(page.locator('.sidebar')).toBeHidden();
    const game=page.locator('.worm-page');
    await expect(game).toHaveAttribute('data-display','immersive-landscape');
    const rect=await game.boundingBox();
    expect(rect).not.toBeNull();
    if(rect){
      expect(Math.abs(rect.x)).toBeLessThan(2);
      expect(Math.abs(rect.y)).toBeLessThan(2);
      expect(Math.abs(rect.width-longSide)).toBeLessThan(2);
      expect(Math.abs(rect.height-shortSide)).toBeLessThan(2);
    }
    const board=page.locator('.worm-board');
    await expect(board).toHaveCSS('touch-action','none');
    await expect(page.locator('body > .worm-immersive.worm-page')).toBeVisible();
    // Regression for the actual screenshot: former 204px NAQLA sidebar offset
    // left an empty blue strip. The game must paint the leftmost screen pixel.
    await expect.poll(async()=>page.evaluate(() => {
      const stage=document.querySelector('body > .worm-immersive');
      const rect=stage?.getBoundingClientRect();
      const painted=document.elementFromPoint(2,innerHeight/2);
      return Boolean(rect && Math.abs(rect.left)<1 && rect.right>=innerWidth-1 &&
        painted?.closest('.worm-immersive')===stage);
    })).toBe(true);
    await expect.poll(async()=>board.evaluate(svg=>{
      const element=svg as SVGSVGElement;
      const rect=element.getBoundingClientRect();
      return Math.abs(element.viewBox.baseVal.width/element.viewBox.baseVal.height -
        rect.width/rect.height);
    })).toBeLessThan(.005); // No 16:9 letterbox on ultra-wide phones.
    await expect(page.locator('.worm-page')).not.toHaveCSS('overflow-x','auto');
    const count=page.locator('.worm-moves-value');
    await expect(count).toHaveText('0');
    const area=await board.boundingBox();
    expect(area).not.toBeNull();
    if(!area)throw new Error('Missing board rect');
    const x=area.x+area.width*.32,y=area.y+area.height*.60;
    const end=x+Math.min(area.width*.19,105);
    if(browserName==='chromium'){
      const session=await context.newCDPSession(page);
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:0}]});
      for(let i=1;i<=4;i++)
        await session.send('Input.dispatchTouchEvent',{
          type:'touchMove',touchPoints:[{x:x+(end-x)*i/4,y,id:0}]});
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await session.detach();
    }else{
      await page.mouse.move(x,y);await page.mouse.down();
      await page.mouse.move(end,y,{steps:5});await page.mouse.up();
    }
    await expect(count).toHaveText('1');
    const options=page.getByRole('button',{name:locale.id==='ar'?'خيارات اللعبة':'Game options'});
    await options.click();
    await expect(page.locator('.worm-game-menu')).toBeVisible();
    await page.locator('.worm-game-menu button').first().click();
    await expect(count).toHaveText('0');
    await options.click();
    await page.getByRole('button',{name:locale.id==='ar'?'اختيار المرحلة':'Choose level'}).click();
    await expect(page.locator('.worm-game-level-dialog')).toBeVisible();
    await expect(page.locator('.worm-pack-tabs [role="tab"]')).toHaveCount(4);
    await expect(page.locator('.worm-game-level-dialog .worm-level-grid button')).toHaveCount(10);
    await page.getByRole('tab',{name:'31–40'}).click();
    await expect(page.locator('.worm-game-level-dialog .worm-level-grid button')).toHaveCount(10);
    await expect(page.locator('.worm-game-level-dialog .worm-level-grid button').first()).toHaveText('🔒');
    await page.locator('.worm-level-heading button').click();
    await expect(page.locator('.worm-game-level-dialog')).toBeHidden();
    await expectNoGlobalOverflow(page);
    await page.locator('.worm-exit').click();
    await expect(page.locator('.game-card.appleWorm .play-button')).toBeVisible();
    await expect(page.locator('.app-shell')).not.toHaveClass(/is-immersive-game/);
    await expect(page.locator('html')).not.toHaveAttribute('data-immersive-game','appleWorm');
    expect(errors).toEqual([]);
   }finally{await context.close();}
  });
 }
}
