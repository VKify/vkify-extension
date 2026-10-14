import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { installStyleRelations } from './style-relations-fixture.js';

test('tile menu keeps native links, badges, separators, custom order and a scrollable fixed panel', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
    const css = await Promise.all(['minimalistic-sidebar', 'sidebar-with-background', 'fixed-sidebar', 'tile-sidebar'].map(name => readFile(`src/content/features/appearance/sidebar/${name}.css`, 'utf8')));
    const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
      import { buildMenuOrderCss } from './src/content/features/hiding/menu/menu-items-order.ts';
      import { buildHiddenMenuItemsCss } from './src/content/features/hiding/menu/hide-menu-items.ts';
      document.documentElement.setAttribute('data-vkify-menu_items_order', '');
      document.querySelector('#order').textContent = buildMenuOrderCss(['l_msg', 'sep_main', 'l_pr']);
      window.hideMenu = () => document.querySelector('#hidden').textContent = buildHiddenMenuItemsCss(['l_aud']);
    ` }, bundle: true, write: false, format: 'iife', alias: { '@': resolve('src') } });
    const items = [['l_pr', 'Моя страница'], ['l_msg', 'Мессенджер'], ['l_aud', 'Музыка'], ['l_vid', 'Видео'], ['l_fr', 'Друзья'], ['l_gr', 'Сообщества'], ['l_ph', 'Фотографии'], ['l_mk', 'Маркет'], ['l_mini_apps', 'Мини-приложения'], ['l_buy_votes', 'Голоса'], ['l_fav', 'Закладки'], ['l_doc', 'Файлы'], ['l_ads', 'Реклама'], ['l_faq', 'Помощь'], ['l_vkify_settings', 'Настройки VKify']];
    const item = ([id, label]: string[]) => `<li data-testid="leftmenuitem" id="${id}"><a href="/${id}" ${id === 'l_msg' ? 'aria-current="page"' : ''}>
      <div class="vkit-Bk4LdZ vkitInternalImageBase" style="width:20px;height:20px;flex-shrink:0"><div class="WjmGck"><span><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="4" stroke="currentColor" stroke-width="1.5"/></svg></span></div></div>
      <span data-testid="leftmenuitem-label"><span><div data-testid="leftmenuitem-text">${label}</div></span></span>
      ${id === 'l_msg' ? '<span class="vkuiInternalCounter" data-testid="leftmenuitem-counter">12</span>' : ''}
      ${id === 'l_fr' ? '<object type="internal/link"><a href="/friends?section=requests"><span class="vkuiInternalCounter" data-testid="leftmenuitem-counter">1</span></a></object>' : ''}
      </a><div data-testid="leftmenuitem-settings"></div></li>`;
    await page.setContent(`<html data-vkify-tile_sidebar data-vkify-fixed_sidebar data-vkify-sidebar_with_background data-vkify-minimalistic_sidebar><head><style>
      :root { --spa-layout-header-height:48px; --spa-layout-sidebar-width:164px; --vkui--color_background_content:#19132e; --vkui--color_background_accent_tint:#292044; --vkui--color_separator_primary:#302548; --vkui--color_accent_blue:#65c850; --vkui--color_background_modal:#19132e; }
      body{display:flex;margin:0;padding:32px;background:#0d0b13;color:#bdb0eb;font:13px Arial} #layout_sidebar{width:180px;flex:none} ol{list-style:none}
      .vkit-Bk4LdZ{margin-right:12px} .WjmGck{position:relative} #page_body{width:600px;height:400px;background:#19132e;border-radius:24px}
      li>a{display:flex;align-items:center;text-decoration:none;color:inherit} [data-testid=leftmenuitem-label]{margin-left:12px} hr{border:0;border-top:1px solid #302548}
      [data-testid=leftmenuitem-counter]{background:#8562c7;color:white;border-radius:8px;padding:2px 4px}
      ${css.join('\n')}
    </style><style id="order"></style><style id="hidden"></style></head><body><aside id="layout_sidebar"><div class="LeftMenu__root--fixture"><nav data-testid="leftmenu"><ol>${items.slice(0,8).map(item).join('')}<div id="separator"><hr></div>${items.slice(8).map(item).join('')}</ol></nav></div></aside><main id="page_body"></main><script>${bundle.outputFiles[0].text}</script></body></html>`);
    await installStyleRelations(page);
    const menu = page.locator('ol');
    await expect(menu).toHaveCSS('display', 'grid');
    const positions = await page.locator('li').evaluateAll(nodes => nodes.map(n => ({ id: n.id, x: n.getBoundingClientRect().x, y: n.getBoundingClientRect().y })));
    expect(new Set(positions.map(p => p.x)).size).toBe(2);
    expect(positions.find(p => p.id === 'l_msg')!.y).toBe(positions.find(p => p.id === 'l_pr')!.y);
    await expect(page.locator('#separator')).toBeHidden();
    await expect(page.locator('#l_msg [data-testid="leftmenuitem-label"]')).toBeVisible();
    const geometry = await page.locator('li').evaluateAll(nodes => nodes.map(node => {
      const link = node.querySelector(':scope > a')!.getBoundingClientRect();
      const icon = node.querySelector('svg')!.getBoundingClientRect();
      return { offsetX: icon.x + icon.width / 2 - (link.x + link.width / 2), offsetY: icon.y - link.y };
    }));
    for (const icon of geometry) {
      expect(Math.abs(icon.offsetX)).toBeLessThanOrEqual(.5);
      expect(icon.offsetY).toBe(8);
    }
    for (const id of ['l_msg', 'l_fr']) {
      const badge = await page.locator(`#${id} [data-testid="leftmenuitem-counter"]`).boundingBox();
      const link = await page.locator(`#${id} > a`).boundingBox();
      expect(badge!.y - link!.y).toBe(4);
      expect(link!.x + link!.width - badge!.x - badge!.width).toBe(4);
      expect(badge!.height).toBe(14);
    }
    await expect(page.locator('#l_fr object a')).toHaveAttribute('href', '/friends?section=requests');
    const panel = await page.locator('nav').boundingBox();
    const content = await page.locator('#page_body').boundingBox();
    const tileGap = content!.x - panel!.x - panel!.width;
    await page.evaluate(() => document.documentElement.removeAttribute('data-vkify-tile_sidebar'));
    const miniPanel = await page.locator('nav').boundingBox();
    const miniContent = await page.locator('#page_body').boundingBox();
    expect(tileGap).toBe(miniContent!.x - miniPanel!.x - miniPanel!.width);
    await page.evaluate(() => document.documentElement.setAttribute('data-vkify-tile_sidebar', ''));
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--vkui--size_border_radius_paper--regular', '80px');
      const root = document.querySelector<HTMLElement>('[class*="LeftMenu__root"]')!;
      root.style.borderRadius = 'var(--vkui--size_border_radius_paper--regular)';
      root.style.overflow = 'hidden';
      document.querySelector<HTMLElement>('nav')!.style.borderRadius = 'var(--vkui--size_border_radius_paper--regular)';
    });
    await expect(page.locator('nav')).toHaveCSS('border-top-left-radius', '13px');
    await expect(page.locator('[class*="LeftMenu__root"]')).toHaveCSS('border-top-left-radius', '13px');
    await expect(page.locator('#l_msg > a')).toHaveCSS('border-top-left-radius', '9px');
    await page.evaluate(() => document.documentElement.style.setProperty('--vkui--size_border_radius_paper--regular', '0px'));
    await expect(page.locator('nav')).toHaveCSS('border-top-left-radius', '0px');
    await expect(page.locator('#l_msg > a')).toHaveCSS('border-top-left-radius', '0px');
    await page.evaluate(() => document.documentElement.style.setProperty('--vkui--size_border_radius_paper--regular', '80px'));
    await expect(page.locator('#l_msg > a')).toHaveCSS('height', '52px');
    await expect(page.locator('#l_msg a')).toHaveAttribute('href', '/l_msg');
    await page.evaluate(() => (window as unknown as { hideMenu(): void }).hideMenu());
    await expect(page.locator('#l_aud')).toBeHidden();
    await page.setViewportSize({ width: 900, height: 360 });
    const nav = page.locator('nav');
    expect(await nav.evaluate(n => n.scrollHeight > n.clientHeight)).toBe(true);
    await page.locator('#l_vkify_settings a').focus();
    await expect(page.locator('#l_vkify_settings a')).toBeInViewport();
    await page.locator('#l_vkify_settings a').evaluate(n => (n as HTMLElement).blur());
    await page.setViewportSize({ width: 900, height: 600 });
    await nav.evaluate(n => n.scrollTop = 0);
    await expect(page.locator('#l_pr > a')).toHaveCSS('border-top-color', 'rgb(48, 37, 72)');
    await page.screenshot({ path: 'test-results/tile-sidebar.png' });
    await page.evaluate(() => { document.documentElement.removeAttribute('data-vkify-tile_sidebar'); document.documentElement.removeAttribute('data-vkify-minimalistic_sidebar'); });
    await expect(menu).toHaveCSS('display', 'flex');
    await expect(page.locator('#separator')).toBeVisible();
    await expect(page.locator('nav')).toHaveCSS('border-top-left-radius', '80px');
  } finally { await browser.close(); }
});
