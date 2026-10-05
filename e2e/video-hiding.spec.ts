import { test, expect, chromium, type Page } from '@playwright/test';
import { resolve } from 'node:path';

import { VIDEO_MENU_ITEMS } from '../src/shared/constants/video-menu-items.js';

const MENU = VIDEO_MENU_ITEMS.filter(item => !item.before && !['main_menu_authors_list', 'main_menu_tv_install'].includes(item.id)).map(item => item.id);
function menuRow(id: string): string {
  const item = VIDEO_MENU_ITEMS.find(item => item.id === id)!;
  if (item.before) return `<div id="${id}"><div><hr style="margin:0;height:12px"></div></div>`;
  return `<div><a data-testid="${id}" href="/${id}" onclick="event.preventDefault();this.dataset.clicked='true'" style="display:block;height:44px">${id}</a></div>`;
}
const mainMenu = VIDEO_MENU_ITEMS.slice(0, VIDEO_MENU_ITEMS.findIndex(item => item.id === 'sep_video_subscriptions')).map(item => menuRow(item.id)).join('');
const OFF = { hide_video_comments: false, hide_video_recommendations: false, collapse_video_playlist: false, hide_video_playlist: false, video_menu_items_order: [],
  hide_video_categories: false, hide_video_login_prompt: false, hidden_video_menu_items: [], block_recommendations_video: false };

// Structure observed on VK Video: player and info are separate branches; a fixed-width
// sidebar owns both playlist and related videos; padding wrappers surround catalog tabs/login.
const HTML = `<html><body style="margin:0"><div id="spa_root">
  <header data-testid="video_spa_header"><button data-testid="top-menu-registration-btn">Register</button></header>
  <aside data-testid="video_left_menu">
    <nav id="menu-tree" style="display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;flex-direction:column;gap:6px">
        <div id="menu-main" style="display:flex;flex-direction:column;gap:6px">${mainMenu}</div>
        ${menuRow('sep_video_subscriptions')}
        <div style="display:flex;flex-direction:column;gap:6px">${menuRow('main_menu_subscribes')}${menuRow('main_menu_video_subscriptions_select')}</div>
        <div id="authors" style="display:flex;flex-direction:column;gap:6px"><div><a data-testid="main_menu_block_111" href="/@first" style="display:block;height:44px">First creator</a></div><div><a data-testid="main_menu_block_222" href="/@second" style="display:block;height:44px">Second creator</a></div></div>
      </div>
      <div id="tv-promo" style="padding:8px">${menuRow('sep_video_tv')}<div role="heading" style="height:24px">VK Video on TV</div><div><a href="https://vkvideo.ru/landings/tv_instructions/index.html" style="display:block;height:44px">Install on TV</a></div></div>
      <div style="display:flex;flex-direction:column;gap:6px">${menuRow('sep_video_info')}${menuRow('main-menu-content-info')}${menuRow('main_menu_legal_info')}</div>
    </nav>
    <div style="padding:8px"><div><section id="login" style="height:100px"><p style="margin:0">Sign in</p><button data-testid="main-menu-sign-in-btn">Sign in</button></section></div></div>
    <div id="legal">Legal links</div>
  </aside>
  <section id="catalog">
    <div id="category-shell" style="padding:0 0 20px"><div style="padding:10px 8px"><div data-testid="headerlayout"><div><div data-testid="headerlayout-in">
      <div id="banner-padding" style="padding:12px 12px 16px"><div><ins data-ad-slot="1694217" style="display:block;height:250px">Ad</ins></div></div>
      <div role="tablist" style="height:40px"><a data-testid="tab-/" href="/">All</a><a data-testid="tab-/music" href="/music">Music</a></div>
    </div></div></div></div></div>
    <section id="premium"><a href="https://vk.ru/vkpremium">Premium</a></section><div data-testid="grid" style="height:80px">Video grid</div>
  </section>
  <div id="layout" style="display:flex;gap:16px;width:100%;align-items:flex-start">
    <div role="main" style="width:calc(100% - 361px);min-width:0"><section id="watch">
      <div id="player-branch"><div id="player-host" style="display:block;width:100%;aspect-ratio:16/9;background:#111"></div><button id="next" onclick="this.dataset.clicked='true'">Next</button></div>
      <div style="padding:0 8px 16px"><div data-testid="video-page-info" style="height:130px">Video title and description</div></div>
      <div id="comments-heading" style="padding-bottom:8px"><span data-testid="video-comments-count">1 comment</span><button data-testid="video-comments-sorting">Sort</button></div>
      <div id="comments-body" style="height:300px"><div data-testid="comment">Comment text</div><textarea placeholder="Comment"></textarea></div><div></div>
    </section><div></div></div>
    <div id="side" style="width:345px;flex-shrink:0"><div>
      <section data-testid="video_page_playlist_videos" style="height:298px"><div style="height:40px"><a href="/playlist/-1_1">Playlist title</a></div><div id="queue" style="height:220px"><button>Native shuffle</button><a href="/video-1_2">Next queue item</a></div></section>
      <div style="height:16px"></div><section id="video_recommendations" style="height:894px"><div data-testid="video_recommendations_header">Related videos</div><a href="/video-2_2">Video</a></section>
    </div></div>
  </div>
  <script>const root=document.getElementById('player-host').attachShadow({mode:'open'});root.innerHTML='<div role="region" aria-label="Video player"><video id="main-video" style="width:100%;height:100%"></video></div>';</script>
</div></body></html>`;

async function width(page: Page, selector: string): Promise<number> { return (await page.locator(selector).boundingBox())!.width; }
async function top(page: Page, selector: string): Promise<number> { return page.locator(selector).evaluate(element => element.getBoundingClientRect().top + window.scrollY); }

for (const viewport of [1333, 800]) {
  test(`video hiding frees layout space, preserves player and restores each setting (${viewport}px)`, async ({}, info) => {
    test.setTimeout(90000);
    const extension = resolve('dist/chrome');
    const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true,
      viewport: { width: viewport, height: 900 }, executablePath: process.env.PW_CHROME_PATH,
      args: ['--disable-features=DisableLoadExtensionCommandLineSwitch', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
    try {
      const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
      const id = new URL(worker.url()).host;
      const ui = await context.newPage();
      await ui.goto(`chrome-extension://${id}/index.html`);
      await expect(ui.locator('#root.ready')).toBeVisible();
      const set = async (values: Record<string, unknown>) => { await worker.evaluate(values => chrome.storage.local.set(values), values); };
      await set({ ...OFF, language: 'en', onboarding_done: true, first_run: false });
      const page = await context.newPage();
      await page.route('https://vkvideo.ru/**', route => route.fulfill({ contentType: 'text/html', body: HTML }));
      await page.goto('https://vkvideo.ru/video-1_1');
      const baselineWidth = await width(page, '#player-host');
      const baselineHeight = (await page.locator('#watch').boundingBox())!.height;
      const gridTop = await top(page, '[data-testid="grid"]');
      const legalTop = await top(page, '#legal');

      await set({ hide_video_comments: true });
      await expect(page.locator('#comments-heading')).toBeHidden();
      await expect(page.locator('#comments-body')).toBeHidden();
      await expect(page.locator('#main-video')).toBeVisible();
      await expect(page.locator('[data-testid="video-page-info"]')).toBeVisible();
      expect(await width(page, '#player-host')).toBe(baselineWidth);
      expect((await page.locator('#watch').boundingBox())!.height).toBeLessThan(baselineHeight - 300);
      await set({ hide_video_comments: false });
      await expect(page.locator('#comments-body')).toBeVisible();
      expect((await page.locator('#watch').boundingBox())!.height).toBe(baselineHeight);

      await set({ hide_video_recommendations: true });
      await expect(page.locator('#video_recommendations')).toBeHidden();
      await expect.poll(() => width(page, '#player-host')).toBe(viewport);
      expect(await width(page, '#player-host')).toBeGreaterThan(baselineWidth + 350);
      await expect(page.locator('#main-video')).toBeVisible();
      await expect(page.locator('#comments-body')).toBeVisible();
      await expect(page.locator('#queue')).toBeVisible();
      expect(await width(page, '[data-testid="video_page_playlist_videos"]')).toBe(viewport);
      expect(await top(page, '[data-testid="video_page_playlist_videos"]')).toBeGreaterThan(await top(page, '#watch'));
      await page.screenshot({ path: info.outputPath('expanded-player.png'), fullPage: true });
      await set({ hide_video_recommendations: false });
      await expect(page.locator('#video_recommendations')).toBeVisible();
      await expect.poll(() => width(page, '#player-host')).toBe(baselineWidth);

      await set({ collapse_video_playlist: true });
      await expect(page.locator('#queue')).toBeHidden();
      expect((await page.locator('[data-testid="video_page_playlist_videos"]').boundingBox())!.height).toBeLessThan(120);
      await page.getByRole('button', { name: 'Show playlist', exact: true }).click();
      await expect(page.locator('#queue')).toBeVisible();
      await page.getByRole('button', { name: 'Collapse playlist', exact: true }).click();
      await set({ collapse_video_playlist: false });
      await expect(page.locator('[data-vkify-playlist-toggle]')).toHaveCount(0);
      await expect(page.locator('[data-testid="video_page_playlist_videos"]')).toHaveCSS('height', '298px');

      await set({ hide_video_login_prompt: true });
      await expect(page.locator('#login')).toBeHidden();
      expect(await top(page, '#legal')).toBe(legalTop - 116);
      await expect(page.locator('[data-testid="top-menu-registration-btn"]')).toBeVisible();
      await set({ hide_video_login_prompt: false });
      await expect(page.locator('#login')).toBeVisible();
      expect(await top(page, '#legal')).toBe(legalTop);

      for (const item of MENU) {
        const oldTop = await top(page, '#legal');
        await set({ hidden_video_menu_items: [item] });
        await expect(page.locator(`[data-testid="${item}"]`)).toBeHidden();
        expect(await top(page, '#legal')).toBe(oldTop - 50);
        await set({ hidden_video_menu_items: [] });
        await expect(page.locator(`[data-testid="${item}"]`)).toBeVisible();
        expect(await top(page, '#legal')).toBe(oldTop);
      }
      for (const [id, selector] of [['main_menu_authors_list', '#authors'], ['main_menu_tv_install', '#tv-promo']]) {
        const oldTop = await top(page, '#legal');
        const oldHeight = (await page.locator(selector).boundingBox())!.height;
        await set({ hidden_video_menu_items: [id] });
        await expect(page.locator(selector)).toBeHidden();
        expect(await top(page, '#legal')).toBe(oldTop - oldHeight - 6);
        await expect(page.locator('[data-testid="main_menu_subscribes"]')).toBeVisible();
        await expect(page.locator('[data-testid="main_menu_video_subscriptions_select"]')).toBeVisible();
        await set({ hidden_video_menu_items: [] });
        await expect(page.locator(selector)).toBeVisible();
        expect(await top(page, '#legal')).toBe(oldTop);
      }

      for (const item of VIDEO_MENU_ITEMS.filter(item => item.before)) {
        const oldTop = await top(page, '#legal');
        const oldHeight = (await page.locator('#' + item.id).boundingBox())!.height;
        await set({ hidden_video_menu_items: [item.id] });
        await expect(page.locator('#' + item.id)).toBeHidden();
        expect(await top(page, '#legal')).toBeLessThanOrEqual(oldTop - oldHeight);
        await set({ hidden_video_menu_items: [] });
        await expect(page.locator('#' + item.id)).toBeVisible();
        expect(await top(page, '#legal')).toBe(oldTop);
      }
      const reordered = ['main_menu_family_values', 'sep_video_info', 'main_menu_trends'];
      await set({ video_menu_items_order: reordered });
      await expect.poll(() => top(page, '[data-testid="main_menu_family_values"]')).toBeLessThan(await top(page, '[data-testid="main_menu_trends"]'));
      expect(await top(page, '#sep_video_info')).toBeLessThan(await top(page, '[data-testid="main_menu_trends"]'));
      await page.locator('[data-testid="main_menu_trends"]').click();
      await expect(page.locator('[data-testid="main_menu_trends"]')).toHaveAttribute('data-clicked', 'true');
      await set({ hidden_video_menu_items: ['sep_video_info', 'main_menu_tv_install', 'main_menu_authors_list'] });
      for (const selector of ['#sep_video_info', '#tv-promo', '#authors']) await expect(page.locator(selector)).toBeHidden();
      await page.evaluate(() => {
        const tree = document.querySelector('#menu-tree')!; tree.replaceWith(tree.cloneNode(true));
      });
      await expect(page.locator('#sep_video_info')).toBeHidden();
      await expect.poll(() => top(page, '[data-testid="main_menu_family_values"]')).toBeLessThan(await top(page, '[data-testid="main_menu_trends"]'));
      await set({ video_menu_items_order: [], hidden_video_menu_items: [] });
      await expect(page.locator('[data-vkify-video-menu-order-root]')).toHaveCount(0);
      expect(await top(page, '#legal')).toBe(legalTop);

      const relatedTop = await top(page, '#video_recommendations');
      await set({ hide_video_playlist: true });
      await expect(page.locator('[data-testid="video_page_playlist_videos"]')).toBeHidden();
      expect(await top(page, '#video_recommendations')).toBe(relatedTop - 314);
      await expect(page.locator('#main-video')).toBeVisible();
      expect(await width(page, '#player-host')).toBe(baselineWidth);
      await set({ collapse_video_playlist: true });
      await expect(page.locator('[data-vkify-playlist-toggle]')).toHaveCount(1);
      await set({ hide_video_playlist: false });
      await expect(page.locator('[data-testid="video_page_playlist_videos"]')).toBeVisible();
      await expect(page.locator('#queue')).toBeHidden();
      await set({ collapse_video_playlist: false });
      await expect(page.locator('#queue')).toBeVisible();
      expect(await top(page, '#video_recommendations')).toBe(relatedTop);

      await set({ hide_video_categories: true });
      await expect(page.locator('[role="tablist"]')).toBeHidden();
      expect(await top(page, '[data-testid="grid"]')).toBe(gridTop - 40);
      await expect(page.locator('#banner-padding')).toBeVisible();
      await set({ hide_video_categories: false, block_recommendations_video: true });
      await expect(page.locator('#banner-padding')).toBeHidden();
      await expect(page.locator('[role="tablist"]')).toBeVisible();
      await expect(page.locator('#catalog')).toBeVisible();
      expect(await top(page, '[data-testid="grid"]')).toBeLessThan(gridTop - 277);
      await set({ hide_video_categories: true });
      await expect(page.locator('#category-shell')).toBeHidden();
      await expect(page.locator('[data-testid="grid"]')).toBeVisible();
      expect(await top(page, '[data-testid="grid"]')).toBe(await top(page, '#catalog'));

      await set({ hide_video_comments: true, hide_video_recommendations: true, collapse_video_playlist: true,
        hide_video_login_prompt: true, hidden_video_menu_items: ['main_menu_clips'] });
      await expect(page.locator('#queue')).toBeHidden();
      await page.evaluate(() => {
        document.querySelectorAll('#spa_root *').forEach((element, i) => element.className = `changed_hash_${i}`);
        const root = document.querySelector('[data-testid="video_page_playlist_videos"]')!;
        root.replaceWith(root.cloneNode(true));
        const menu = document.querySelector('[data-testid="video_left_menu"] nav')!;
        menu.replaceWith(menu.cloneNode(true));
        history.pushState({}, '', '/video-1_2'); dispatchEvent(new PopStateEvent('popstate'));
      });
      await expect(page.locator('[data-vkify-playlist-toggle]')).toHaveCount(1);
      await page.getByRole('button', { name: 'Show playlist', exact: true }).click();
      await expect(page.locator('#queue')).toBeVisible();
      await expect(page.locator('#main-video')).toBeVisible();
      await expect(page.locator('[data-testid="main_menu_clips"]')).toBeHidden();
      await page.locator('#next').click();
      await expect(page.locator('#next')).toHaveAttribute('data-clicked', 'true');
      await page.screenshot({ path: info.outputPath('combined-settings.png'), fullPage: true });
      await set(OFF);
      for (const selector of ['#comments-heading', '#comments-body', '#video_recommendations', '[role="tablist"]', '#login', '#banner-padding', '#premium', '#queue']) {
        await expect(page.locator(selector)).toBeVisible();
      }
      await expect(page.locator('[data-vkify-playlist-toggle]')).toHaveCount(0);
      expect(await width(page, '#player-host')).toBe(baselineWidth);
      expect(await top(page, '[data-testid="grid"]')).toBe(gridTop);
      expect(await top(page, '#legal')).toBe(legalTop);
      // A playlist alone must not reserve a sidebar when hidden.
      const relatedMarkup = await page.locator('#video_recommendations').evaluate(element => element.outerHTML);
      await page.locator('#video_recommendations').evaluate(element => element.remove());
      await set({ hide_video_playlist: true });
      await expect.poll(() => width(page, '#player-host')).toBe(viewport);
      await expect(page.locator('#main-video')).toBeVisible();
      await set({ hide_video_playlist: false });
      await expect.poll(() => width(page, '#player-host')).toBe(baselineWidth);
      await page.locator('#side > div').evaluate((element, html) => element.insertAdjacentHTML('beforeend', html), relatedMarkup);
      // Homepage without an ad slot and watch pages without a playlist need no empty shells.
      await page.evaluate(() => {
        document.querySelector('#banner-padding')!.remove();
        document.querySelector('[data-testid="video_page_playlist_videos"]')!.remove();
      });
      await set({ hide_video_categories: true, hide_video_recommendations: true });
      await expect(page.locator('#category-shell')).toBeHidden();
      await expect.poll(() => width(page, '#player-host')).toBe(viewport);
      await expect(page.locator('#main-video')).toBeVisible();
      await expect(page.locator('#comments-body')).toBeVisible();
      await set(OFF);
      await expect(page.locator('#category-shell')).toBeVisible();
      await expect(page.locator('#video_recommendations')).toBeVisible();
      await expect.poll(() => width(page, '#player-host')).toBe(baselineWidth);
    } finally { await context.close(); }
  });
}
