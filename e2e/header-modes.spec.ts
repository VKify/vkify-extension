import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('scroll-aware and compact headers share offsets without moving page content', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const css = (await Promise.all([
      'header/header-offsets.css', 'header/auto-hide.css', 'header/compact-header.css',
      'header/static-header.css', 'sidebar/fixed-sidebar.css',
    ].map(file => readFile(`src/content/features/appearance/${file}`, 'utf8')))).join('\n');
    const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
      import { startAutoHideHeader } from './src/content/features/appearance/header/auto-hide.ts';
      window.stopHeader = startAutoHideHeader();
    ` }, bundle: true, write: false, format: 'iife', alias: { '@': resolve('src') } });
    await page.setContent(`<!DOCTYPE html><html data-vkify-auto_hide_header data-vkify-compact_header data-vkify-fixed_sidebar><head><style>
      html { --header-height:48px; } body { margin:0; }
      #layout_wrapper_root { --spa-layout-header-height:var(--header-height); --page-block-offset:16px; }
      #page_header_cont { position:fixed;top:0;left:0;width:100%;height:var(--spa-layout-header-height); }
      #page_header { height:var(--spa-layout-header-height);display:flex;align-items:center;margin:0;padding:0; }
      #page_header > li { height:48px;list-style:none; }
      .TopNavBtn { height:48px;min-height:48px;display:flex;align-items:center; }
      .TopNavBtn:hover { background:purple; }
      .LayoutWrapper__body--fixture { display:flex;padding-top:var(--spa-layout-header-height); }
      #layout_sidebar { width:164px;height:100px; }
      #content { height:3000px;flex:1; }
      #profile_redesigned { width:345px; }
      ${css}
    </style></head><body><div id="layout_wrapper_root">
      <div id="page_header_cont"><div id="page_header_wrap"><ul id="page_header"><li><a href="#" id="logo">Logo</a></li><li><input aria-label="Search" id="search" style="height:32px;box-sizing:border-box"></li>
        <li><button class="TopNavBtn" id="notifications">Notifications</button></li>
        <li><div><div class="TopNavBtn" id="mini-player" role="button" tabindex="0"><button id="play" style="height:24px">Play</button>Track</div></div></li>
      </ul></div></div>
      <div id="page_layout"><div class="LayoutWrapper__body--fixture"><div id="layout_sidebar">Menu</div><main id="content">
        <div id="tabs" style="position:fixed;top:48px"><div id="group_tabs">Posts</div></div>
        <div id="player" style="position:fixed;top:48px;height:72px"><section data-testid="AudioPage_PlayerBlock">Player</section></div>
        <div id="profile_redesigned"><div class="ScrollStickyWrapper"><div id="profile-column" style="position:fixed;top:64px">Sidebar</div></div></div>
      </main></div></div>
    </div><script>${bundle.outputFiles[0].text}</script></body></html>`);
    // Flush the initial viewport resize before exercising user scrolling.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const scroll = async (y: number): Promise<void> => {
      await page.evaluate(y => window.scrollTo(0, y), y);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(y);
    };
    const offsets = async (height: number): Promise<void> => {
      await expect(page.locator('#tabs')).toHaveCSS('top', `${height}px`);
      await expect(page.locator('#player')).toHaveCSS('top', `${height}px`);
      await expect(page.locator('#layout_sidebar')).toHaveCSS('top', `${height}px`);
      await expect(page.locator('#profile-column')).toHaveCSS('top', `${height + 16}px`);
    };
    await expect(page.locator('#page_header_cont')).toHaveCSS('height', '40px');
    await page.locator('#mini-player').hover();
    for (const selector of ['#notifications', '#mini-player', '#logo']) {
      await expect(page.locator(selector)).toHaveCSS('height', '40px');
      expect(await page.locator(selector).evaluate(el => {
        const rect = el.getBoundingClientRect(), header = document.querySelector('#page_header_cont')!.getBoundingClientRect();
        return rect.top >= header.top && rect.bottom <= header.bottom;
      })).toBe(true);
    }
    await expect(page.locator('#play')).toHaveCSS('height', '24px');
    await page.mouse.move(1000, 500);
    await expect(page.locator('#page_layout > div')).toHaveCSS('padding-top', '40px');
    await offsets(40);
    await scroll(300);
    await expect(page.locator('html')).toHaveAttribute('data-vkify-header-hidden', '');
    await expect(page.locator('#page_header_cont')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, -40)');
    await offsets(0);
    await expect.poll(() => page.locator('#content').evaluate(el => el.getBoundingClientRect().top + window.scrollY)).toBe(40);
    await scroll(295); // Below the direction threshold: no flicker.
    await expect(page.locator('html')).toHaveAttribute('data-vkify-header-hidden', '');
    await scroll(280);
    await expect(page.locator('html')).not.toHaveAttribute('data-vkify-header-hidden');
    await offsets(40);
    await scroll(400);
    await expect(page.locator('html')).toHaveAttribute('data-vkify-header-hidden', '');
    // SPA replacement inherits both compact height and hidden state.
    await page.locator('#page_header_cont').evaluate(el => {
      el.innerHTML = '<div id="page_header_wrap"><div id="page_header"><input id="search" aria-label="Search"></div></div>';
    });
    await expect(page.locator('#page_header')).toHaveCSS('height', '40px');
    await page.locator('#search').focus();
    await expect(page.locator('html')).not.toHaveAttribute('data-vkify-header-hidden');
    await scroll(500);
    await expect(page.locator('html')).not.toHaveAttribute('data-vkify-header-hidden');
    await page.locator('#search').evaluate(el => (el as HTMLElement).blur());
    await scroll(600);
    await expect(page.locator('html')).toHaveAttribute('data-vkify-header-hidden', '');
    await scroll(0);
    await expect(page.locator('html')).not.toHaveAttribute('data-vkify-header-hidden');
    await page.evaluate(() => document.documentElement.removeAttribute('data-vkify-compact_header'));
    await expect(page.locator('#page_header_cont')).toHaveCSS('height', '48px');
    await offsets(48);
    await page.evaluate(() => document.documentElement.setAttribute('data-vkify-static_header', ''));
    await scroll(300);
    await expect(page.locator('html')).not.toHaveAttribute('data-vkify-header-hidden');
    await expect.poll(() => page.locator('#page_header_cont').evaluate(el => el.getBoundingClientRect().top)).toBe(-300);
    await offsets(0);
    await page.evaluate(() => {
      document.documentElement.removeAttribute('data-vkify-static_header');
      (window as unknown as { stopHeader(): void }).stopHeader();
      document.documentElement.removeAttribute('data-vkify-auto_hide_header');
    });
    await scroll(500);
    await expect(page.locator('html')).not.toHaveAttribute('data-vkify-header-hidden');
    await expect(page.locator('#tabs')).toHaveCSS('top', '48px');
    await expect(page.locator('#profile-column')).toHaveCSS('top', '64px');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => document.documentElement.setAttribute('data-vkify-auto_hide_header', ''));
    await expect(page.locator('#page_header_cont')).toHaveCSS('transition-duration', '0s');
  } finally { await browser.close(); }
});
