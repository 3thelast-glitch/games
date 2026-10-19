import { createElement } from 'react';
import { mkdirSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from '@playwright/test';
import { AppleWormScreenshotBoard } from '../apps/mobile/src/AppleWormScreenshotBoard.tsx';
import { startScreenshotWorm } from '../packages/games/apple-worm/screenshot-engine.ts';

mkdirSync('artifacts/apple-worm/rendered',{recursive:true});
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:640,height:360},deviceScaleFactor:1});
  for(let level=1;level<=105;level++) {
    const svg=renderToStaticMarkup(createElement(AppleWormScreenshotBoard,{state:startScreenshotWorm(level),label:`Stage ${level}`}));
    const name=String(level).padStart(3,'0');
    writeFileSync(`artifacts/apple-worm/rendered/stage_${name}.svg`,svg);
    await page.setContent(`<style>html,body{margin:0;padding:0;width:640px;height:360px;overflow:hidden}svg{display:block;width:640px;height:360px}</style>${svg}`);
    await page.screenshot({path:`artifacts/apple-worm/rendered/stage_${name}.png`});
  }
} finally { await browser.close(); }
