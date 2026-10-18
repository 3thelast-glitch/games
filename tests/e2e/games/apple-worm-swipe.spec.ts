import {test,expect} from '@playwright/test';
import {expectNoGlobalOverflow} from '../helpers/layout.ts';

/** Real mobile pointer events; Chromium uses native touch dispatch through CDP. */
for(const locale of [{id:'ar',name:'ar-SA',dir:'rtl'},{id:'en',name:'en-US',dir:'ltr'}] as const){
 for(const width of [320,360,390,430] as const){
  test('Apple Worm swipe-only '+locale.id+' '+width+'px moves, undoes, and stays responsive',
  async ({browser,browserName})=>{
   const touch=browserName!=='firefox';
   const context=await browser.newContext({
    locale:locale.name,viewport:{width,height:width===320?568:width===360?740:width===390?844:932},
    isMobile:touch,hasTouch:touch,deviceScaleFactor:2,
   });
   try{
    const page=await context.newPage();
    const errors:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('dir',locale.dir);
    await page.locator('.game-card.appleWorm .play-button').click();
    const board=page.locator('.worm-board');
    await expect(board).toBeVisible();
    await expect(board).toHaveAttribute('data-input','swipe');
    await expect(page.locator('.worm-pad')).toHaveCount(0);
    await expect(page.locator('.worm-swipe-callout')).toBeVisible();
    await expect(board).toHaveCSS('touch-action','none');
    const count=page.locator('.worm-stage-top > span');
    await expect(count).toContainText('0');
    const rect=await board.boundingBox();
    expect(rect).not.toBeNull();
    if(!rect)throw new Error('No Apple Worm board geometry');
    const x=rect.x+rect.width*.34,y=rect.y+rect.height*.43;
    const end=x+Math.min(rect.width*.28,97);
    if(browserName==='chromium'){
     const cdp=await context.newCDPSession(page);
     await cdp.send('Input.dispatchTouchEvent',{
      type:'touchStart',touchPoints:[{x,y,id:0}],
     });
     for(let i=1;i<=4;i++)await cdp.send('Input.dispatchTouchEvent',{
      type:'touchMove',touchPoints:[{x:x+(end-x)*i/4,y,id:0}],
     });
     await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
     await cdp.detach();
    }else{
     await page.mouse.move(x,y);await page.mouse.down();
     await page.mouse.move(end,y,{steps:5});await page.mouse.up();
    }
    await expect(count).toContainText('1');
    await page.locator('.worm-actions button').first().click();
    await expect(count).toContainText('0');
    await expectNoGlobalOverflow(page);
    expect(errors).toEqual([]);
   }finally{await context.close();}
  });
 }
}
