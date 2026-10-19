import {test,expect} from '@playwright/test';
import {expectNoGlobalOverflow} from '../helpers/layout.ts';

/** Source-image gameplay must work on narrow portrait screens and landscape.
 * Unlike the legacy 40-level view, the screenshot board can be interacted
 * with in either orientation, and 105 real source stages are navigable.
 */
for(const locale of [{id:'ar',name:'ar-SA',dir:'rtl'},{id:'en',name:'en-US',dir:'ltr'}] as const) {
  for(const shortSide of [320,360,390,430] as const) {
    test('Apple Worm screenshot game '+locale.id+' '+shortSide+'px touch/undo/exit',async({browser,browserName})=>{
      const touch=browserName!=='firefox';
      const longSide=shortSide===320?568:shortSide===360?740:shortSide===390?844:932;
      const context=await browser.newContext({
        locale:locale.name,
        viewport:{width:shortSide,height:longSide},
        isMobile:touch,hasTouch:touch,deviceScaleFactor:2,
      });
      try{
        const page=await context.newPage();
        const errors:string[]=[];
        page.on('pageerror',e=>errors.push(e.message));
        await page.goto('/');
        await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});
        await expect(page.locator('html')).toHaveAttribute('dir',locale.dir);
        await page.locator('.game-card.appleWorm .play-button').click();
        const game=page.locator('body > [data-stage-origin="user-screenshot"]');
        await expect(game).toBeVisible();
        await expect(game).toHaveAttribute('data-source-stage-count','105');
        const board=game.locator('svg[data-source-level="1"]');
        await expect(board).toBeVisible();
        await expect(board).toHaveCSS('touch-action','none');
        await expect(page.locator('.worm-pad')).toHaveCount(0);
        await expect(page.locator('.sidebar')).toBeHidden();
        await expect(page.locator('.topbar')).toBeHidden();
        await expect(page.locator('.mobile-nav')).toBeHidden();
        const frame=await game.boundingBox();
        expect(frame).not.toBeNull();
        if(frame){
          expect(Math.abs(frame.x)).toBeLessThan(2);
          expect(Math.abs(frame.y)).toBeLessThan(2);
          expect(Math.abs(frame.width-shortSide)).toBeLessThan(2);
          expect(Math.abs(frame.height-longSide)).toBeLessThan(2);
        }
        await expect(game).toHaveCSS('overflow-y','auto');
        await expectNoGlobalOverflow(page);

        await page.setViewportSize({width:longSide,height:shortSide});
        await expect(board).toBeVisible();
        await expect.poll(async()=>board.evaluate(svg=>{
          const b=svg.getBoundingClientRect();
          const view=(svg as SVGSVGElement).viewBox.baseVal;
          return Math.abs(view.width/view.height-b.width/b.height);
        })).toBeLessThan(.02);
        const first=board.locator('[data-source-worm]').first().locator('circle').first();
        await expect(first).toHaveAttribute('cx','165');
        const rect=await board.boundingBox();
        expect(rect).not.toBeNull();
        if(!rect)throw Error('No source stage board');
        const x=rect.x+rect.width*.30;
        const y=rect.y+rect.height*.50;
        const end=x+Math.min(rect.width*.14,85);
        if(browserName==='chromium'){
          const cdp=await context.newCDPSession(page);
          await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:0}]});
          for(let k=1;k<=5;k++)await cdp.send('Input.dispatchTouchEvent',{
            type:'touchMove',touchPoints:[{x:x+(end-x)*k/5,y,id:0}],
          });
          await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
          await cdp.detach();
        }else{
          await page.mouse.move(x,y);
          await page.mouse.down();
          await page.mouse.move(end,y,{steps:8});
          await page.mouse.up();
        }
        await expect(first).toHaveAttribute('cx','195');
        await game.getByRole('button',{name:locale.id==='ar'?'تراجع':'Undo'}).click();
        await expect(first).toHaveAttribute('cx','165');

        const choose=game.locator('button[aria-expanded]');
        await choose.click();
        const dialog=game.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('button',{name:'91–105'})).toBeVisible();
        await dialog.getByRole('button',{name:'91–105'}).click();
        await dialog.getByRole('button',{name:locale.id==='ar'?'المرحلة 101':'Stage 101'}).click();
        const late=game.locator('svg[data-source-level="101"]');
        await expect(late).toBeVisible();
        await expect(late.locator('[data-source-apple]')).toHaveCount(12);
        await expect(late.locator('[data-source-portal]')).toHaveCount(0);
        await expectNoGlobalOverflow(page);
        await game.locator('header button').first().click();
        await expect(page.locator('.game-card.appleWorm .play-button')).toBeVisible();
        await expect(page.locator('.app-shell')).not.toHaveClass(/is-immersive-game/);
        await expect(page.locator('html')).not.toHaveAttribute('data-immersive-game','appleWorm');
        expect(errors).toEqual([]);
      }finally{await context.close();}
    });
  }
}
