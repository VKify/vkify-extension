import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('clips follow page offset with native width, custom width and either edge menu', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 900 } });
    const css = (await Promise.all(['layout/widescreen', 'layout/page-offset', 'sidebar/edge-sidebar', 'sidebar/minimalistic-sidebar', 'sidebar/sidebar-right'].map(name =>
      readFile(`src/content/features/appearance/${name}.css`, 'utf8')))).join('\n');
    await page.setContent(`<style>
      *{box-sizing:border-box}body{margin:0}#page_layout,#page_header{position:relative;width:1108px;margin:auto;padding:0}
      #page_header_cont{height:48px}.TopNavigationWrapper__outer--fixture{position:fixed;inset:0 0 auto;width:100vw}#page_header{height:48px}.LayoutWrapper__body--fixture{display:flex;gap:6px}#layout_sidebar{width:164px;flex:none}
      #page_body,#spa_layout_content{width:912px}#page_layout{min-height:calc(100vh - 48px)}
      .FeedLayout__root--fixture{position:fixed;top:48px;left:calc((100vw - 1108px)/2 + 180px);width:912px;height:calc(100vh - 48px)}
      .split{display:flex;gap:16px;height:100%}.main{flex:1;min-width:0}.side{width:345px}.slot{height:100%;position:relative}
      .ClipsFeedComponent__feedWrapper--fixture{width:100vw;height:100%}.ClipsFeedControlsLayout__root--fixture{position:absolute;left:480px;top:16px;width:52px}
      ${css}</style><div id="layout_wrapper_root"><div id="page_header_cont"><div class="TopNavigationWrapper__outer--fixture"><header id="page_header">Header</header></div></div>
      <div id="page_layout"><div class="LayoutWrapper__body--fixture" data-vkify-layout-body><nav id="layout_sidebar">Menu</nav>
      <main id="page_body"><div id="spa_layout_content"><div class="FeedLayout__root--fixture"><div><div class="split">
      <div class="main"><div class="slot"><div class="ClipsFeedComponent__feedWrapper--fixture"><div data-clip-id="-1_2" data-active="true">Clip</div></div><div class="ClipsFeedControlsLayout__root--fixture">Controls</div></div></div>
      <div class="side"><div class="FeedLayout__rightWrapper--fixture">Comments</div></div></div></div></div></div></main></div></div></div>`);
    for (const mode of ['native', 'wide', 'mini-right', 'edge-left', 'edge-right']) {
      await page.locator('html').evaluate((el, mode) => {
        el.toggleAttribute('data-vkify-content_width', mode === 'wide' || mode === 'mini-right');
        el.toggleAttribute('data-vkify-edge_sidebar', mode.startsWith('edge'));
        el.toggleAttribute('data-vkify-sidebar_right', mode === 'edge-right' || mode === 'mini-right');
        el.toggleAttribute('data-vkify-minimalistic_sidebar', mode === 'mini-right');
        if (mode === 'wide' || mode === 'mini-right') (el as HTMLElement).style.setProperty('--vkify-cw', '1300px');
        else (el as HTMLElement).style.removeProperty('--vkify-cw');
        el.setAttribute('data-vkify-page_offset', '');
      }, mode);
      const positions: number[] = [];
      for (const shift of [-200, 0, 200]) {
        await page.locator('html').evaluate((el, shift) => (el as HTMLElement).style.setProperty('--vkify-page-shift', `${shift}px`), shift);
        const geometry = await page.evaluate(() => {
          const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().toJSON();
          return { feed: box('.FeedLayout__root--fixture'), body: box('#page_body'), menu: box('#layout_sidebar'), header: box('#page_header') };
        });
        expect(geometry.feed.left).toBeCloseTo(geometry.body.left, 1);
        expect(geometry.feed.top).toBeCloseTo(48, 1);
        expect(geometry.feed.bottom).toBeCloseTo(900, 1);
        expect(geometry.feed.right).toBeLessThanOrEqual(geometry.header.right + 1);
        if (mode === 'mini-right') expect(geometry.feed.right).toBeLessThanOrEqual(geometry.menu.left);
        positions.push(geometry.feed.left);
      }
      expect(positions[1] - positions[0]).toBeCloseTo(200, 1);
      expect(positions[2] - positions[1]).toBeCloseTo(200, 1);
      await page.locator('html').evaluate(el => ['page_offset', 'content_width', 'sidebar_right', 'edge_sidebar', 'minimalistic_sidebar'].forEach(flag => el.removeAttribute('data-vkify-' + flag)));
      await expect(page.locator('.FeedLayout__root--fixture')).toHaveCSS('position', 'fixed');
    }
  } finally { await browser.close(); }
});

