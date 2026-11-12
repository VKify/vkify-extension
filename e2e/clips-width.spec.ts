import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

for (const { rail, customWidth } of [{ rail: false, customWidth: true }, { rail: true, customWidth: true }, { rail: true, customWidth: false }]) test(`clips fit content width from minimum to maximum${rail ? ' with edge navigation' : ''}${customWidth ? '' : ' without custom content width'}`, async ({}, info) => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const css = await readFile('src/content/features/appearance/layout/widescreen.css', 'utf8');
    const edge = await readFile('src/content/features/appearance/sidebar/edge-sidebar.css', 'utf8');
    // Structure and inline dimensions observed on vk.ru/clips. AutoSizer measures
    // its container; the native controls then receive an absolute left offset.
    await page.setContent(`<style>
      *{box-sizing:border-box}body{margin:0;background:#141820;color:#eee;font:14px Arial}
      #page_layout{width:1076px;margin:auto;position:relative}#page_layout>[data-vkify-layout-body]{display:flex;gap:6px}
      .TopNavigationWrapper__outer--fixture{position:fixed;top:0;left:0;width:100vw}
      #page_header{width:1076px;margin:auto;padding-inline:15px;position:relative}
      html[data-vkify-edge_sidebar] #page_layout{padding-inline:16px}
      #layout_sidebar{flex:0 0 164px;padding-top:64px}#page_body{width:912px;min-width:0}#spa_layout_content{width:912px}
      .FeedLayout__root--fixture{position:fixed;top:48px;width:912px;height:calc(100vh - 48px)}
      .outer,.split{width:100%;height:100%}.split{display:flex;gap:16px}
      .main{flex:1 0 auto;min-width:0}.side{width:345px;flex:0 0 auto}.slot{position:relative;height:100%}
      [data-testid="clips_feed"]{width:100vw;height:100%;padding-top:16px}
      [data-testid="clips-scroll-handler"],[data-testid="clips-touch-handler"],[class*="AutoSizer__root"]{width:100%;height:100%}
      .measured{width:var(--vkui_internal--inline-size);height:100%;overflow:hidden}
      [data-testid="clips-carousel-vertical-item"]{width:100%}[data-testid="clips-feed-item"]{width:380px}
      .card{width:100%;aspect-ratio:var(--vkui_internal--aspect_ratio);position:relative;background:linear-gradient(150deg,#0077ff,#09263d 65%,#75468b);border-radius:16px;overflow:hidden}
      [data-testid="clipcard-cover"]{position:absolute;inset:0;display:grid;place-items:center;font-size:24px}
      [data-testid="clips-feed-controls"]{position:absolute;top:16px;left:430px;width:52px;height:626px;display:flex;flex-direction:column;justify-content:space-between}
      [data-testid="clips-feed-controls"] button{height:48px;width:48px;border-radius:50%;border:0;background:#334154;color:#fff;font-size:18px}
      .FeedLayout__rightWrapper--fixture{width:345px;display:flex;flex-direction:column;gap:16px;padding-top:16px}
      .menu,.comments{width:100%;min-width:0;padding:16px;border-radius:14px;background:#222}.menu{display:flex;flex-wrap:wrap;gap:12px}.comments{min-height:200px}
      ${css}${edge}
      </style><div id="layout_wrapper_root"><div class="TopNavigationWrapper__outer--fixture"><header id="page_header">Header</header></div><div id="page_layout"><div data-vkify-layout-body>
      <nav id="layout_sidebar">VK navigation</nav><main id="page_body"><div id="spa_layout_content">
      <div class="FeedLayout__root--fixture"><div class="outer"><div class="split">
        <div class="main vkuiInternalSplitCol--viewWidth-none"><div class="slot">
          <div data-testid="clips_feed"><div data-testid="clips-scroll-handler"><div data-testid="clips-touch-handler"><div class="AutoSizer__root--fixture">
            <div class="measured" style="--vkui_internal--inline-size:1280px"><div data-testid="clips-carousel-vertical-item"><div data-testid="clips-feed-item" style="width:380px"><div class="card" style="--vkui_internal--aspect_ratio:.607028754"><div data-testid="clipcard-cover">Clip</div></div></div></div></div>
          </div></div></div></div>
          <div data-testid="clips-feed-controls" style="left:430px;right:auto">${['♪','♡','☏','↗','↑','↓'].map(t=>`<button>${t}</button>`).join('')}</div>
        </div></div>
        <div class="side vkuiInternalSplitCol--viewWidth-none"><div style="position:sticky;top:0"><div class="FeedLayout__rightWrapper--fixture"><div class="FeedLayout__hiddenContent--fixture"></div><section class="menu"><span>My clips</span><button>Publish</button></section><section class="comments">Comments</section></div></div></div>
      </div></div></div></div></main></div></div></div>`);
    await page.evaluate(() => {
      const target = document.querySelector('.AutoSizer__root--fixture')!;
      new ResizeObserver(([entry]) => {
        (target.firstElementChild as HTMLElement).style.setProperty('--vkui_internal--inline-size', `${entry.contentRect.width}px`);
      }).observe(target);
    });
    await page.locator('html').evaluate((el, { rail, customWidth }) => {
      if (customWidth) el.setAttribute('data-vkify-content_width', 'true');
      if (rail) el.setAttribute('data-vkify-edge_sidebar', 'true');
    }, { rail, customWidth });
    for (const viewport of [900, 1280, 2560, 3840]) {
      await page.setViewportSize({ width: viewport, height: 900 });
      for (const width of customWidth ? [900, 1100, 1600, 2500, 5000] : [1108]) {
        if (customWidth) await page.locator('html').evaluate((el, width) => el.style.setProperty('--vkify-cw', `min(${width}px,100vw)`), width);
        await expect.poll(() => page.locator('.AutoSizer__root--fixture').evaluate(el =>
          Math.abs(el.clientWidth - el.firstElementChild!.clientWidth))).toBeLessThan(1);
        const geometry = await page.locator('.FeedLayout__root--fixture').evaluate(root => {
          const rect = (el: Element) => { const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height}; };
          return { header:rect(document.querySelector('#page_header')!),root:rect(root),slot:rect(root.querySelector('.slot')!),video:rect(root.querySelector('[data-testid="clipcard-cover"]')!),controls:rect(root.querySelector('[data-testid="clips-feed-controls"]')!),side:rect(root.querySelector('.side')!) };
        });
        const expectedWidth = rail ? Math.min(width, viewport - Math.min(204, Math.max(156, viewport * .18)) - 16) - 32 : Math.min(width, viewport) - 170;
        expect(geometry.root.width).toBeCloseTo(expectedWidth, 1);
        if (rail) {
          // Native page_layout has 16px inner gutters; the header uses 15px.
          expect(geometry.root.left).toBeCloseTo(geometry.header.left + 16, 1);
          expect(geometry.side.right).toBeCloseTo(geometry.header.right - 16, 1);
        }
        expect(geometry.video.left).toBeGreaterThanOrEqual(geometry.root.left);
        expect(geometry.controls.left).toBeGreaterThanOrEqual(geometry.video.right);
        expect(geometry.controls.right).toBeLessThanOrEqual(geometry.side.left);
        expect(geometry.side.right).toBeLessThanOrEqual(geometry.root.right + 1);
        expect(geometry.root.right).toBeLessThanOrEqual(viewport + 1);
        expect(geometry.video.width / geometry.video.height).toBeCloseTo(9 / 16, 2);
        expect(geometry.video.width).toBeCloseTo(Math.min((900 - 80) * 9 / 16, geometry.slot.width - 68), 1);
        expect(geometry.controls.height).toBeCloseTo(geometry.video.height, 1);
        expect(geometry.video.height).toBeLessThanOrEqual(900 - 80 + 1);
      }
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    if (customWidth) await page.locator('html').evaluate(el => el.style.setProperty('--vkify-cw', '900px'));
    await page.screenshot({ path: info.outputPath('clips-min-width.png') });
    await page.setViewportSize({ width: 3840, height: 900 });
    if (customWidth) await page.locator('html').evaluate(el => el.style.setProperty('--vkify-cw', '2500px'));
    await page.screenshot({ path: info.outputPath('clips-max-width.png') });
    const large = await page.getByTestId('clipcard-cover').boundingBox();
    expect(large!.width).toBeGreaterThan(380);
    // A short window limits the frame by height, and a tall window uses more
    // width while keeping the controls beside the video and fully on screen.
    for (const height of [600, 720, 1080, 1440]) {
      await page.setViewportSize({ width: 3840, height });
      await expect.poll(() => page.locator('.AutoSizer__root--fixture').evaluate(el =>
        Math.abs(el.clientWidth - el.firstElementChild!.clientWidth))).toBeLessThan(1);
      const frame = (await page.getByTestId('clipcard-cover').boundingBox())!;
      const controls = (await page.getByTestId('clips-feed-controls').boundingBox())!;
      const slot = (await page.locator('.slot').boundingBox())!;
      expect(frame.height).toBeCloseTo(Math.min(height - 80, (slot.width - 68) * 16 / 9), 1);
      expect(frame.y + frame.height).toBeLessThanOrEqual(height);
      expect(controls.height).toBeCloseTo(frame.height, 1);
      expect(controls.x).toBeGreaterThanOrEqual(frame.x + frame.width);
    }
    await page.locator('html').evaluate(el => { el.removeAttribute('data-vkify-content_width'); el.removeAttribute('data-vkify-edge_sidebar'); });
    await expect(page.locator('.FeedLayout__root--fixture')).toHaveCSS('width', '912px');
    await expect(page.getByTestId('clips-feed-controls')).toHaveCSS('position', 'absolute');
    await expect(page.getByTestId('clips-feed-item')).toHaveCSS('width', '380px');
  } finally { await browser.close(); }
});
