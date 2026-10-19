import {test,expect} from '@playwright/test';
import {expectNoGlobalOverflow} from '../helpers/layout.ts';

/** One approved 105-stage gallery-layout game supports movement,
 * RTL/LTR, swipes, restart and stage selection on phone and PC.
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
        await expect(game).toHaveAttribute('data-renderer','premium-gallery-game');
        await expect(game.getByRole('button',{name:/Legacy 40|المراحل القديمة 40/})).toHaveCount(0);
        await expectNoGlobalOverflow(page);

        await page.setViewportSize({width:longSide,height:shortSide});
        await expect(board).toBeVisible();
        await expect(board).toHaveAttribute('viewBox','0 0 630 270');
        await expect(board).toHaveAttribute('preserveAspectRatio','xMidYMid meet');
        await expect(board.locator('[data-source-terrain="premium-art"]')).toHaveCount(1);
        const first=board.locator('[data-source-worm]');
        await expect(first).toHaveAttribute('data-head-x','165');
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
        await expect(first).toHaveAttribute('data-head-x','195');
        await game.getByRole('button',{name:locale.id==='ar'?'تراجع':'Undo'}).click();
        await expect(first).toHaveAttribute('data-head-x','165');

        const choose=game.locator('button[aria-expanded]');
        await choose.click();
        const stages=game.getByRole('navigation',{name:locale.id==='ar'?'المراحل المعتمدة من 1 إلى 105':'Approved stages 1 to 105'});
        await expect(stages).toBeVisible();
        await stages.getByRole('button',{name:'91–105'}).click();
        await stages.getByRole('button',{name:locale.id==='ar'?'المرحلة 101':'Stage 101'}).click();
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
