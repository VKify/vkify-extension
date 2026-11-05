import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { resolve } from 'node:path';

test('full-widget artwork reveals controls and falls back outside free placement', async ({}, info) => {
  const browser = await chromium.launch({ headless:true, executablePath:process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage({viewport:{width:1000,height:850}});
    await page.route('https://covers.test/**', route => route.request().url().includes('missing')
      ? route.fulfill({status:404,body:''})
      : route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#ffbd69"/><stop offset=".5" stop-color="#b24c78"/><stop offset="1" stop-color="#252c69"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/><circle cx="300" cy="300" r="170" fill="none" stroke="#fff8" stroke-width="2"/><circle cx="300" cy="300" r="130" fill="none" stroke="#fff4" stroke-width="45"/><text x="300" y="310" fill="white" font-size="35" text-anchor="middle" font-family="sans-serif">NIGHT DRIVE</text></svg>'}));
    await page.setContent('<style>:root{--vkui--color_background_modal:#20212b;--vkui--color_text_primary:#eee}body{background:#151820}</style>');
    const bundle = await build({stdin:{resolveDir:process.cwd(),contents:`
      import { createMiniPlayerFeature } from './src/content/features/center/music/playback/mini-player/index.ts';
      import { storage } from './src/content/core/storage.ts';
      import { dispatchPageEvent } from './src/content/utils/page-event.ts';
      const values = {mini_player_width:360,mini_player_height:360,mini_player_cover_background:true,mini_player_visualizer:false,'widget:music-mini-player':{mode:'free',position:{left:120,top:100}}};
      const listeners = new Set();
      window.chrome = {runtime:{id:'fixture',sendMessage:async () => ({success:true})},storage:{local:{get:async () => ({...values}),set:async patch => {
        Object.assign(values,patch);
        const changes=Object.fromEntries(Object.entries(patch).map(([key,newValue]) => [key,{newValue}]));
        for (const fn of listeners) fn(changes,'local');
      }},onChanged:{addListener:fn => listeners.add(fn),removeListener:fn => listeners.delete(fn)}}};
      window.configureCoverFixture = patch => storage.setMultiple(patch);
      window.coverTrackFixture = cover => dispatchPageEvent('vkify:mini-player:state',{track:{id:'1_1',title:'Night Drive',artist:'Late Hours',cover},playing:true,currentTime:30,duration:180,volume:.6,rate:1,controllable:true});
      createMiniPlayerFeature({getAllSettings:() => storage.getAll(),getSetting:key => storage.get(key),setSetting:(key,value) => storage.set(key,value),onStorageChange:fn => storage.onChange(fn),injectScript(){}}).music_mini_player.enable();
    `},bundle:true,write:false,format:'iife',alias:{'@':resolve('src')},define:{'import.meta.env.DEV':'false'}});
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    const player = page.locator('.vkify-mini');
    const shade = player.locator('.mp-cover-shade');
    const body = player.locator('.vkify-fw__body');
    const configure = (patch: Record<string, unknown>) => page.evaluate(p => (window as any).configureCoverFixture(p),patch);
    const track = (src: string) => page.evaluate(src => (window as any).coverTrackFixture(src),src);
    await expect(player).toBeVisible();
    await track('https://covers.test/first.svg');
    await expect(player).toHaveClass(/has-cover-background/);
    await expect(body).toHaveCSS('opacity','0');
    await expect(shade).toHaveCSS('opacity','0');
    const boxes = await player.evaluate(root => {
      const outer=root.getBoundingClientRect(), image=root.querySelector('.mp-cover-background')!.getBoundingClientRect();
      return {width:outer.width,height:outer.height,imageWidth:image.width,imageHeight:image.height};
    });
    expect(Math.abs(boxes.width-boxes.imageWidth)).toBeLessThanOrEqual(2);
    expect(Math.abs(boxes.height-boxes.imageHeight)).toBeLessThanOrEqual(2);
    await player.screenshot({path:info.outputPath('artwork-idle.png')});
    await player.hover();
    await expect(shade).toHaveCSS('opacity','1');
    await expect(body).toHaveCSS('opacity','1');
    await expect(player.locator('.mp-art')).toBeHidden();
    await expect(player.locator('.mp-title')).toHaveCSS('color','rgb(255, 255, 255)');
    await player.screenshot({path:info.outputPath('artwork-controls.png')});
    await page.mouse.move(0,0);
    await player.locator('.mp-transport button').first().focus();
    await expect(shade).toHaveCSS('opacity','1');
    await expect(body).toHaveCSS('opacity','1');
    for (const size of [{width:280,height:280},{width:600,height:320}]) {
      await player.evaluate((root,size) => Object.assign((root as HTMLElement).style,{width:size.width+'px',height:size.height+'px'}),size);
      await expect(player.locator('.mp-content')).toHaveCSS('display','block');
      await expect(player.locator('.mp-transport')).toBeVisible();
    }
    await configure({'widget:music-mini-player':{mode:'free',autoHide:true,position:{left:120,top:100}}});
    await expect(player).not.toHaveClass(/has-cover-background/);
    await configure({'widget:music-mini-player':{mode:'free',autoHide:false,position:{left:120,top:100}}});
    await expect(player).toHaveClass(/has-cover-background/);
    await player.locator('[data-stack-toggle]').click();
    await expect(player).toHaveClass(/is-stacked/);
    await expect(player).not.toHaveClass(/has-cover-background/);
    await player.locator('[data-stack-toggle]').click();
    await expect(player).toHaveClass(/has-cover-background/);
    await player.locator('.mp-mode').click();
    await expect(player).toHaveClass(/is-pill/);
    await expect(player).not.toHaveClass(/has-cover-background/);
    await player.locator('.vkify-fw__head > [aria-expanded]').click();
    await expect(player).toHaveClass(/has-cover-background/);
    await track('https://covers.test/missing.svg');
    await expect(player).not.toHaveClass(/has-cover-background/);
    await expect(player.locator('.mp-art')).toBeVisible();
    await expect(body).toHaveCSS('opacity','1');
    await track('');
    await expect(player).not.toHaveClass(/has-cover-background/);
    await track('https://covers.test/second.svg');
    await expect(player).toHaveClass(/has-cover-background/);
    await configure({mini_player_cover_background:false});
    await expect(player).not.toHaveClass(/has-cover-background/);
    await expect(player.locator('.mp-cover-background')).not.toHaveAttribute('src');
  } finally { await browser.close(); }
});
