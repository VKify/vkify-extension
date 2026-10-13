import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('edge sidebar reaches the viewport edge, reserves content space and survives conflicting layout flags', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 1264, height: 720 } });
    // Modern layout wrappers observed on vk.ru/vkify; omit account data.
    const css = await Promise.all(['sidebar/edge-sidebar', 'sidebar/fixed-sidebar', 'sidebar/sidebar-with-background', 'sidebar/tile-sidebar', 'sidebar/minimalistic-sidebar', 'layout/page-offset'].map(name => readFile(`src/content/features/appearance/${name}.css`, 'utf8')));
    await page.setContent(`<html data-vkify-edge_sidebar data-vkify-fixed_sidebar data-vkify-sidebar_with_background data-vkify-tile_sidebar data-vkify-minimalistic_sidebar data-vkify-page_offset><head><style>
      :root{--spa-layout-header-height:48px;--spa-layout-sidebar-width:164px;--vkify-page-shift:-300px;--vkui--color_background_content:#293542;--vkui--color_accent_blue:#81b1da;--vkui--color_background_accent_tint:#354b60;--vkui--color_separator_primary:#405262}
      body{margin:0;font:14px Arial;background:#eef2f6;color:#dce6f0;min-height:1600px} #page_layout{width:1108px;padding:0 16px;margin:auto;box-sizing:border-box}
      .LayoutWrapper__body--fixture{display:flex;padding-top:64px} #layout_sidebar{width:164px;flex:none}.LayoutWrapper__content--fixture{flex:1;min-width:0}
      #spa_layout_content{height:1100px;background:#fff;border-radius:12px;color:#293542;padding:20px;box-sizing:border-box} ol{list-style:none;padding:0;margin:0}
      #page_header_cont{position:fixed;inset:0 0 auto;height:48px;z-index:100;background:#4c75a3}
      .TopNavigationWrapper__outer--fixture{width:100%} #page_header{height:48px;padding:14px 16px}
      html[data-vkify-static_header] #page_header_cont{position:relative}
      li>a{display:flex;color:inherit;text-decoration:none;align-items:center;height:32px} li>a>div:first-child{margin-right:12px}
      ${css.join('\n')}
    </style></head><body><div id="layout_wrapper_root"><div id="page_header_cont"><div class="TopNavigationWrapper__outer--fixture"><div id="page_header">ВКонтакте</div></div></div><div id="page_layout"><div class="LayoutWrapper__body--fixture"><aside id="layout_sidebar"><div class="LeftMenu__root--fixture"><nav data-testid="leftmenu"><ol>
      ${Array.from({length:24},(_,i)=>`<li id="l_${i}" data-testid="leftmenuitem"><a href="/section${i}" ${i===1?'aria-current="page"':''}><div style="width:20px;height:20px"><svg width="20" height="20"><rect x="2" y="2" width="16" height="16" rx="3" fill="none" stroke="currentColor"/></svg></div><span data-testid="leftmenuitem-label"><div data-testid="leftmenuitem-text">${['Профиль','Новости','Сообщения','Друзья','Сообщества','Фотографии','Видео','Музыка'][i%8]}</div></span></a></li>`).join('')}
      </ol></nav></div></aside><div class="LayoutWrapper__content--fixture"><main id="spa_layout_content"><h2>Новости</h2><p>Контент страницы</p></main></div></div></div></div></body></html>`);
    const rail = page.locator('#layout_sidebar');
    for (const width of [1600, 1100, 820]) {
      await page.setViewportSize({ width, height: 720 });
      const panel = await rail.boundingBox();
      const content = await page.locator('#spa_layout_content').boundingBox();
      expect(panel!.x).toBe(0);
      expect(panel!.y).toBe(48);
      expect(panel!.y + panel!.height).toBe(720);
      expect(content!.x).toBeGreaterThanOrEqual(panel!.width + 16);
      expect(content!.x + content!.width).toBeLessThanOrEqual(width);
      const header = await page.locator('#page_header').boundingBox();
      expect(header!.x).toBeGreaterThanOrEqual(panel!.width + 16);
      expect(header!.x + header!.width).toBeLessThanOrEqual(width);
      await expect(rail).toHaveCSS('border-top-left-radius', '0px');
    }
    await expect(page.locator('#l_0 [data-testid="leftmenuitem-label"]')).toBeVisible();
    await expect(page.locator('#l_0 > a')).toHaveAttribute('href', '/section0');
    await page.locator('#l_2 > a').evaluate(el => {
      const badge = document.createElement('span');
      badge.dataset.testid = 'leftmenuitem-counter';
      badge.textContent = '12';
      el.append(badge);
    });
    await page.locator('#l_3 > a').evaluate(el => {
      const wrapper = document.createElement('object');
      wrapper.type = 'internal/link';
      const link = document.createElement('a');
      link.href = '/requests';
      const badge = document.createElement('span');
      badge.dataset.testid = 'leftmenuitem-counter';
      badge.textContent = '1';
      link.append(badge); wrapper.append(link); el.append(wrapper);
    });
    for (const id of ['l_2','l_3']) {
      const link = await page.locator(`#${id} > a`).boundingBox();
      const badge = await page.locator(`#${id} [data-testid="leftmenuitem-counter"]`).boundingBox();
      expect(badge!.x + badge!.width).toBeLessThanOrEqual(link!.x + link!.width);
      expect(badge!.y + badge!.height/2).toBeCloseTo(link!.y + link!.height/2, 1);
    }
    await page.locator('#l_0 > a').focus();
    await expect(page.locator('#l_0 > a')).toHaveCSS('outline-width', '2px');
    await page.locator('#l_0 > a').evaluate(el => (el as HTMLElement).blur());
    expect(await rail.evaluate(n => n.scrollHeight > n.clientHeight)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 400));
    expect((await rail.boundingBox())!.x).toBe(0);
    expect((await rail.boundingBox())!.y).toBe(48);
    await page.evaluate(() => { window.scrollTo(0,0); document.documentElement.style.setProperty('--vkify-header-offset','40px'); });
    expect((await rail.boundingBox())!.y).toBe(40);
    await page.evaluate(() => { document.documentElement.style.setProperty('--vkify-header-offset','0px'); document.documentElement.setAttribute('data-vkify-static_header',''); });
    expect((await rail.boundingBox())!.y).toBe(0);
    const staticHeader = await page.locator('#page_header').boundingBox();
    const staticContent = await page.locator('#spa_layout_content').boundingBox();
    expect(staticHeader!.x).toBeLessThanOrEqual(staticContent!.x);
    await page.evaluate(() => { document.documentElement.style.removeProperty('--vkify-header-offset'); document.documentElement.removeAttribute('data-vkify-static_header'); });
    // Nested split-column wrappers and inline widths observed on vk.ru/00x69.
    await page.locator('#spa_layout_content').evaluate(el => {
      (el as HTMLElement).style.padding = '0';
      el.innerHTML = `<div id="profile_redesigned" style="width:912px">
        <section id="profile-header" style="height:120px;background:#e1e8ef;width:100%">Profile</section>
        <div class="x3Ylin" style="display:flex"><div class="vkuiInternalSplitCol--viewWidth-tabletPlus" style="width:912px">
          <div><div id="profile-columns" style="display:flex;width:912px">
            <div class="Profile__column vkuiInternalSplitCol--viewWidth-tabletPlus" style="width:550px;flex:1 1 auto"><section style="height:200px;background:#eaf0f6">Music and wall</section></div>
            <div class="ScrollStickyWrapper" style="width:345px;height:182px;margin-left:16px;flex:1 1 auto"><div id="profile-side" style="width:345px;height:182px;background:#d5e0ea">Subscriptions</div></div>
          </div></div>
        </div></div></div>`;
    });
    for (const width of [1600,1100,820,700]) {
      await page.setViewportSize({ width, height: 720 });
      const header = await page.locator('#profile-header').boundingBox();
      const primary = await page.locator('.Profile__column').boundingBox();
      const side = await page.locator('.ScrollStickyWrapper').boundingBox();
      expect(primary!.x).toBe(header!.x);
      expect(side!.x + side!.width).toBeCloseTo(header!.x + header!.width, 1);
      if (width > 760) expect(side!.x - primary!.x - primary!.width).toBe(16);
      else expect(primary!.width).toBe(header!.width);
      await page.locator('#profile-side').evaluate(el => (el as HTMLElement).style.position = 'fixed');
      expect((await page.locator('#profile-side').boundingBox())!.width).toBeCloseTo(side!.width, 1);
      await page.locator('#profile-side').evaluate(el => (el as HTMLElement).style.position = '');
    }
    await page.setViewportSize({ width:1100, height:720 });
    await page.screenshot({ path: 'test-results/edge-sidebar.png' });
    await page.evaluate(() => ['edge_sidebar','fixed_sidebar','sidebar_with_background','tile_sidebar','minimalistic_sidebar','page_offset'].forEach(id=>document.documentElement.removeAttribute('data-vkify-'+id)));
    await expect(rail).toHaveCSS('position', 'static');
    await expect(page.locator('#layout_wrapper_root')).toHaveCSS('padding-left', '0px');
  } finally { await browser.close(); }
});
