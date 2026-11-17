import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('right navigation stays clickable above the fixed clips feed and below dialogs', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const css = (await Promise.all(['sidebar-right', 'fixed-sidebar', 'tile-sidebar', 'sidebar-with-background'].map(name =>
      readFile(`src/content/features/appearance/sidebar/${name}.css`, 'utf8')))).join('\n');
    await page.setContent(`<html data-vkify-sidebar_right data-vkify-fixed_sidebar data-vkify-sidebar_with_background>
      <style>:root{--spa-layout-header-height:48px;--spa-layout-sidebar-width:164px}
      body{margin:0}#page_layout{margin:48px auto;width:1000px;position:relative}
      .layout{display:flex}#page_body{width:836px;height:1500px}#layout_sidebar{width:164px}
      a{display:block;height:36px} .FeedLayout__root{position:fixed;inset:48px 0 0 264px}
      #modal{position:fixed;inset:0;z-index:100;background:white}${css}</style>
      <div id="page_layout"><div class="layout" data-vkify-layout-body>
        <aside id="layout_sidebar"><div class="LeftMenu__root"><nav data-testid="leftmenu"><ol>
          <li data-testid="leftmenuitem"><a href="#feed"><span data-testid="leftmenuitem-label">Лента</span></a></li>
          <li data-testid="leftmenuitem"><a href="#friends"><span data-testid="leftmenuitem-label">Друзья</span></a></li>
        </ol></nav></div></aside>
        <main id="page_body"><div class="FeedLayout__root"><div data-testid="clips_feed">Клипы</div></div></main>
      </div></div></html>`);
    for (const tiles of [false, true]) {
      await page.evaluate(tiles => document.documentElement.toggleAttribute('data-vkify-tile_sidebar', tiles), tiles);
      await expect(page.locator('#layout_sidebar')).toHaveCSS('position', 'sticky');
      for (const name of ['Лента', 'Друзья']) {
        await page.getByRole('link', { name, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(name === 'Лента' ? '#feed$' : '#friends$'));
      }
      await page.evaluate(() => { const modal = document.createElement('div'); modal.id = 'modal'; document.body.append(modal); });
      const link = await page.getByRole('link', { name: 'Лента', exact: true }).boundingBox();
      expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, { x: link!.x + 10, y: link!.y + 10 })).toBe('modal');
      await page.locator('#modal').evaluate(element => element.remove());
    }
    await page.locator('[data-testid=clips_feed]').evaluate(element => element.remove());
    await expect(page.locator('#layout_sidebar')).toHaveCSS('z-index', '1');
    await page.evaluate(() => document.documentElement.removeAttribute('data-vkify-sidebar_right'));
    await expect(page.locator('#layout_sidebar')).toHaveCSS('z-index', 'auto');
  } finally { await browser.close(); }
});
