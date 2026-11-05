import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { build } from 'esbuild';

test('mini player controls remain separate through stacked pill and collapse transitions', async ({}, info) => {
  test.setTimeout(60000);
  const browser = await chromium.launch({ headless:true, executablePath:process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    await page.setContent('<html><style>:root{--vkui--color_background_modal:#20212b;--vkui--color_text_primary:#eee;--vkui--color_background_accent:#23a969}body{background:#191a23}</style><body><div id="page_header_cont"></div><div id="page_layout"></div></body></html>');
    const bundle = await build({ stdin:{ resolveDir:process.cwd(), contents:`
      import { createMiniPlayerFeature } from './src/content/features/center/music/playback/mini-player/index.ts';
      import { storage } from './src/content/core/storage.ts';
      import { dispatchPageEvent } from './src/content/utils/page-event.ts';
      const data = { mini_player_visualizer:false, mini_player_width:280, mini_player_mode:'compact', mini_player_collapsed:false, widgetStack:{width:280,animation:false}, 'widget:music-mini-player':{mode:'free',position:{left:130,top:180}} };
      const listeners = new Set();
      window.chrome = { runtime:{id:'fixture', sendMessage:async () => ({success:true})}, storage:{
        local:{ get:async () => ({...data}), set:async patch => {
          Object.assign(data,patch);
          const changes=Object.fromEntries(Object.entries(patch).map(([key,newValue]) => [key,{newValue}]));
          for (const fn of listeners) fn(changes,'local');
        }}, onChanged:{addListener:fn => listeners.add(fn), removeListener:fn => listeners.delete(fn)}
      }};
      window.setStackWidth = width => storage.set('widgetStack',{width,animation:false});
      window.updatePlayerFixture = () => dispatchPageEvent('vkify:mini-player:state', {track:{id:'1_1',title:'Track',artist:'Artist',cover:''},playing:true,currentTime:40,duration:100,volume:1,rate:1,controllable:true});
      const feature = createMiniPlayerFeature({getAllSettings:() => storage.getAll(),getSetting:key => storage.get(key),setSetting:(key,value) => storage.set(key,value),onStorageChange:fn => storage.onChange(fn),injectScript(){}}).music_mini_player;
      window.remountPlayerFixture = async () => { feature.disable(); await feature.enable(); };
      window.playerSettingsFixture = () => ({...data});
      feature.enable();
    ` }, bundle:true, write:false, format:'iife', alias:{'@':resolve('src')}, define:{'import.meta.env.DEV':'false'} });
    await page.addScriptTag({ content:bundle.outputFiles[0].text });
    const player = page.locator('[data-vkify-widget="music-mini-player"]');
    await expect(player).toBeVisible();
    await page.evaluate(() => (window as any).updatePlayerFixture());
    await player.locator('[data-stack-toggle]').click();
    await expect(player).toHaveClass(/is-stacked/);
    const assertControls = async () => {
      const geometry = await player.evaluate(root => {
        const rect = (el: Element) => { const r = el.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom }; };
        const elements = [...root.querySelectorAll('.mp-thumb-box, .mp-compact-controls button, .vkify-fw__head > button')].filter(el => el.getBoundingClientRect().width > 0);
        const parent = root.parentElement!;
        const style = getComputedStyle(parent);
        const contentWidth = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        return { classes:root.className, root:rect(root), parent:rect(parent), contentWidth, items:elements.map(el => ({...rect(el), name:el.getAttribute('aria-label') || el.className})) };
      });
      expect(geometry.root.right).toBeLessThanOrEqual(geometry.parent.right + 1);
      if (geometry.classes.includes('is-stacked')) expect(geometry.root.right - geometry.root.left).toBeCloseTo(geometry.contentWidth, 1);
      for (let i = 0; i < geometry.items.length; i++) {
        expect(geometry.items[i].left).toBeGreaterThanOrEqual(geometry.root.left);
        expect(geometry.items[i].right).toBeLessThanOrEqual(geometry.root.right);
        if (i) expect(geometry.items[i].left, JSON.stringify(geometry)).toBeGreaterThanOrEqual(geometry.items[i - 1].right);
      }
      for (const button of await player.locator('.vkify-fw__head > button').all()) {
        await button.hover();
        const offset = await button.evaluate(el => {
          const b=el.getBoundingClientRect(), s=el.querySelector('svg')!.getBoundingClientRect();
          return { x:Math.abs((b.left+b.right-s.left-s.right)/2), y:Math.abs((b.top+b.bottom-s.top-s.bottom)/2) };
        });
        expect(offset.x).toBeLessThan(1);
        expect(offset.y).toBeLessThan(1);
      }
    };
    const collapse = player.locator('.vkify-fw__head > [aria-expanded]');
    await collapse.click();
    await expect(player).toHaveClass(/is-collapsed/);
    await expect(player).not.toHaveClass(/is-pill/);
    await collapse.click();
    await player.locator('.mp-mode').click();
    await expect(player).toHaveClass(/is-pill/);
    await expect(player).toHaveClass(/is-collapsed/);
    await collapse.click();
    await expect(player).not.toHaveClass(/is-collapsed/);
    await expect(player).not.toHaveClass(/is-pill/);
    await collapse.click();
    await expect(player).toHaveClass(/is-collapsed/);
    await expect(player).not.toHaveClass(/is-pill/);
    await assertControls();
    for (const width of [240, 280, 340, 480, 600]) {
      await page.evaluate(width => (window as any).setStackWidth(width), width);
      await expect(page.locator('.vkify-stack')).toHaveCSS('width', `${width}px`);
      for (let i = 0; i < 2; i++) {
        await collapse.click();
        await player.locator('.mp-mode').click();
        await expect(player).toHaveClass(/is-collapsed/);
        await expect(player).toHaveClass(/is-pill/);
        await assertControls();
        await collapse.click();
        await expect(player).not.toHaveClass(/is-pill/);
        await collapse.click();
        await expect(player).not.toHaveClass(/is-pill/);
        await assertControls();
      }
    }
    await expect.poll(() => page.evaluate(() => (window as any).playerSettingsFixture().mini_player_mode)).toBe('compact');
    await page.evaluate(() => (window as any).remountPlayerFixture());
    await expect(player).toHaveClass(/is-collapsed/);
    await expect(player).not.toHaveClass(/is-pill/);
    await collapse.click();
    await player.locator('.mp-mode').click();
    await page.evaluate(() => (window as any).remountPlayerFixture());
    await expect(player).toHaveClass(/is-pill/);
    await expect(player).toHaveClass(/is-collapsed/);
    await assertControls();
    expect(await page.evaluate(() => (window as any).playerSettingsFixture()['widget:music-mini-player'].position)).toEqual({left:130,top:180});
    await player.locator('[data-stack-toggle]').click();
    await expect(player).not.toHaveClass(/is-stacked/);
    await expect(player).toHaveCSS('left', '130px');
    await expect(player).toHaveCSS('top', '180px');
    await assertControls();
    await player.screenshot({ path:info.outputPath('player-transitions.png') });
  } finally { await browser.close(); }
});
