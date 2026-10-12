import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { resolve } from 'node:path';

for (const modern of [true, false]) {
  test(`left menu ordering preserves separators, promo and pinned tail (${modern ? 'VKUI hashed' : 'legacy'} markup)`, async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
    try {
      const page = await browser.newPage();
      const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
        import { buildMenuOrderCss } from './src/content/features/hiding/menu/menu-items-order.ts';
        import { buildHiddenMenuItemsCss } from './src/content/features/hiding/menu/hide-menu-items.ts';
        import { MENU_ITEM_IDS } from './src/shared/constants/menu-items.ts';
        window.menuFixture = { buildMenuOrderCss, buildHiddenMenuItemsCss, ids: MENU_ITEM_IDS };
      ` }, bundle: true, write: false, format: 'iife', alias: { '@': resolve('src') } });
      // Main-list structure from the supplied HTML; omit personal links/images.
      const main = ['l_pr', 'l_nwsf', 'l_msg', 'l_ca', 'l_fr', 'l_gr', 'l_ph', 'l_aud', 'l_vid', 'l_svd', 'l_ap', 'l_stickers', 'l_mk',
        'sep_main', 'l_mini_apps', 'l_buy_votes', 'l_invite_menu_promo', 'sep_services', 'l_fav', 'l_doc', 'l_ads', 'l_faq',
        'pinned_separator', 'l_mgid235511300', 'l_vkify_settings'];
      const markup = main.map(id => id.includes('sep')
        ? `<div data-fixture="${id}" class="${modern ? 'vkit-08i3SQ PLWFnY ByGxgg ZjZOwx' : 'LeftMenuOld__separator--fixture'}"><hr class="RCvVnl"></div>`
        : `<li data-testid="leftmenuitem" id="${id}" class="vkit-IrzagA"><a href="#${id}"><span data-testid="leftmenuitem-text">${id}</span><span data-testid="leftmenuitem-counter">2</span></a><div data-testid="leftmenuitem-settings" role="button"></div></li>`).join('');
      await page.setContent(`<!DOCTYPE html><html><head><style>
        body{margin:0} ol{padding:0;margin:0;list-style:none} li{height:30px} ol > div:has(hr){height:12px} hr{margin:0}
      </style><style id="order"></style><style id="hidden"></style></head><body>
        <div class="LeftMenu__root--D0gbZ"><nav data-testid="leftmenu" class="LeftMenu__leftMenu--Kp2FO">
          <ol id="main-menu">${markup}</ol><div id="ads_wrapper"><ol><li id="l_blog">Blog</li></ol></div>
        </nav></div><script>${bundle.outputFiles[0].text}</script></body></html>`);
      const visualOrder = () => page.locator('#main-menu > *').evaluateAll(elements => elements
        .filter(el => getComputedStyle(el).display !== 'none')
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
        .map(el => el.id || el.getAttribute('data-fixture')));
      const apply = async (order: string[], hidden: string[] = []): Promise<void> => {
        await page.evaluate(({ order, hidden }) => {
          const f = (window as unknown as { menuFixture: { buildMenuOrderCss(v: unknown): string | null; buildHiddenMenuItemsCss(v: unknown): string | null } }).menuFixture;
          document.querySelector('#order')!.textContent = f.buildMenuOrderCss(order) ?? '';
          document.querySelector('#hidden')!.textContent = f.buildHiddenMenuItemsCss(hidden) ?? '';
        }, { order, hidden });
      };
      await expect.poll(visualOrder).toEqual(main);
      const ids = await page.evaluate(() => (window as unknown as { menuFixture: { ids: string[] } }).menuFixture.ids);
      const order = ['l_aud', ...ids.filter(id => id !== 'l_aud')];
      const expected = ['l_aud', ...main.filter(id => id !== 'l_aud')];
      await apply(order);
      await expect.poll(visualOrder).toEqual(expected);
      await expect(page.locator('#l_blog')).toHaveCSS('order', '0');
      // Counters and React replacement should not require reordering DOM nodes.
      await page.locator('#l_msg [data-testid="leftmenuitem-counter"]').evaluate(el => el.textContent = '3');
      await page.locator('#main-menu').evaluate(el => el.innerHTML = el.innerHTML.replaceAll('vkit-08i3SQ', 'vkit-newHash'));
      await expect.poll(visualOrder).toEqual(expected);
      const moved = ['sep_services', 'l_vkify_settings', ...order.filter(id => !['sep_services', 'l_vkify_settings'].includes(id))];
      await apply(moved);
      await expect.poll(async () => (await visualOrder()).slice(0, 2)).toEqual(['sep_services', 'l_vkify_settings']);
      await apply(moved, ['sep_main', 'sep_services']);
      await expect(page.locator('[data-fixture="sep_main"]')).toBeHidden();
      await expect(page.locator('[data-fixture="sep_services"]')).toBeHidden();
      await expect(page.locator('[data-fixture="pinned_separator"]')).toBeVisible();
      await apply([]);
      await expect.poll(visualOrder).toEqual(main);
    } finally { await browser.close(); }
  });
}
