import { test, expect, chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';

// Public topic DOM + hover rule observed on VK on 2026-10-10.
// Local fixture: no messages, authentication or real VK account required.
test('reading wheel and hover tokens in a real browser, including theme and selection', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<style>
      :root { --vkui--color_transparent: transparent; --vkui--color_transparent--hover: rgba(0,0,0,.04); }
      :root.dark { --vkui--color_transparent--hover: rgba(255,255,255,.04); }
      [data-testid="comment"] { height:100px; }
      [data-testid="comment"]:hover, button:hover { background-color:var(--vkui--color_transparent--hover); }
      [data-testid="comment"][aria-selected="true"] { background-color:rgb(50,100,150); }
      #scroller { width:400px; height:200px; overflow:auto; }
      #outside { position:absolute; top:0; left:500px; width:200px; height:200px; }
    </style><div data-testid="board-topic-page"><div id="scroller"><div data-testid="board-comments-list">
      <div data-testid="comment" id="comment">Message<button>React</button></div>
      <div style="height:1500px">More messages</div>
    </div></div></div><div id="outside">Free page area</div>`);
    await page.addStyleTag({ content: readFileSync(resolve('src/content/features/center/communities/discussions/reading.css'), 'utf8') });
    const compiled = await build({ entryPoints: [resolve('src/content/features/center/communities/discussions/reading.ts')],
      bundle: true, write: false, format: 'iife', globalName: 'Reading', alias: { '@': resolve('src') } });
    await page.addScriptTag({ content: compiled.outputFiles[0].text });
    await page.evaluate(() => {
      const w = window as any;
      let refresh: () => void;
      const ctx = { value: true, observeChanges: (_id: string, cb: () => void) => { refresh = cb; return () => {}; } };
      w.feature = w.Reading.createGlobalScrollFeature(ctx).plugins[0];
      w.readingCtx = ctx;
      w.refreshReading = () => refresh();
    });
    await page.evaluate(() => (window as any).feature.onEnable((window as any).readingCtx));
    await page.evaluate(() => (window as any).feature.onEnable((window as any).readingCtx));
    await page.mouse.move(550, 100); await page.mouse.wheel(0, 80);
    await expect.poll(() => page.locator('#scroller').evaluate(el => el.scrollTop)).toBe(80);
    await page.evaluate(() => (window as any).feature.onDisable());
    await page.mouse.wheel(0, 80);
    expect(await page.locator('#scroller').evaluate(el => el.scrollTop)).toBe(80);
    await page.locator('#scroller').evaluate(el => el.scrollTop = 0);
    const comment = page.locator('#comment');
    for (const dark of [false, true]) {
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark);
      await comment.hover({ position: { x: 350, y: 40 } });
      await expect(comment).toHaveCSS('background-color', dark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)');
      await page.evaluate(() => document.documentElement.setAttribute('data-vkify-messages_disable_hover', ''));
      await expect(comment).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await comment.locator('button').hover();
      await expect(comment.locator('button')).toHaveCSS('background-color', dark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)');
      await comment.evaluate(el => el.setAttribute('aria-selected', 'true'));
      await expect(comment).toHaveCSS('background-color', 'rgb(50, 100, 150)');
      await comment.evaluate(el => el.removeAttribute('aria-selected'));
      await page.evaluate(() => document.documentElement.removeAttribute('data-vkify-messages_disable_hover'));
      await comment.hover({ position: { x: 350, y: 40 } });
      await expect(comment).toHaveCSS('background-color', dark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)');
    }
  } finally { await browser.close(); }
});
