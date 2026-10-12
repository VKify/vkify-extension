import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('static header scrolls away without a content gap and restores native layout', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const headerCss = await readFile('src/content/features/appearance/header/static-header.css', 'utf8');
    const offsetsCss = await readFile('src/content/features/appearance/header/header-offsets.css', 'utf8');
    const sidebarCss = await readFile('src/content/features/appearance/sidebar/fixed-sidebar.css', 'utf8');
    // Native layout structure and header-height inheritance observed on vk.ru/vkify.
    await page.setContent(`<html data-vkify-static_header data-vkify-fixed_sidebar><head><style>
      body { margin:0; }
      html { --header-height:48px; }
      #layout_wrapper_root { position:relative; --spa-layout-header-height:var(--header-height,48px); --page-block-offset:16px; }
      #page_header_cont { position:fixed; top:0; left:0; width:100%; }
      #page_header { height:var(--spa-layout-header-height,48px); }
      .layout-body { display:flex; padding-top:var(--spa-layout-header-height); }
      #layout_sidebar { width:164px; height:100px; }
      #content { height:2500px; }
      #right-column { align-self:flex-start; height:100px; }
      ${headerCss}
      ${offsetsCss}
      ${sidebarCss}
    </style></head><body><div id="layout_wrapper_root">
      <div id="page_header_cont"><div id="page_header">Header</div></div>
      <div id="page_layout"><div class="layout-body LayoutWrapper__body--fixture"><div id="layout_sidebar">Menu</div><main id="content">Content
        <div id="wall-tabs" style="height:44px;width:551px;position:fixed"><div id="group_tabs">Posts / Video</div></div>
      </main><aside id="right-column" style="position:sticky;top:calc(var(--page-block-offset) + var(--header-height))">Right column</aside></div></div>
    </div><div id="overlay" style="position:fixed;top:48px">Overlay</div><script>window.firstLayout = { header:document.querySelector('#page_header_cont').getBoundingClientRect().height, content:document.querySelector('#content').getBoundingClientRect().top };</script></body></html>`);
    expect(await page.evaluate(() => (window as unknown as { firstLayout: unknown }).firstLayout)).toEqual({ header:48, content:48 });
    await expect(page.locator('#wall-tabs')).toHaveCSS('top', '66px');
    await expect(page.locator('#right-column')).toHaveCSS('top', '16px');
    await expect(page.locator('#overlay')).toHaveCSS('top', '48px');
    const geometry = () => page.evaluate(() => ({
      header: document.querySelector('#page_header_cont')!.getBoundingClientRect().top,
      sidebar: document.querySelector('#layout_sidebar')!.getBoundingClientRect().top,
    }));
    await page.evaluate(() => window.scrollTo(0, 250));
    await expect.poll(geometry).toEqual({ header:-250, sidebar:0 });
    // VK writes an inline pixel offset when its wall tabs become pinned.
    await page.locator('#wall-tabs').evaluate(el => (el as HTMLElement).style.top = '48px');
    await expect(page.locator('#wall-tabs')).toHaveCSS('top', '0px');
    await expect.poll(() => page.locator('#right-column').evaluate(el => el.getBoundingClientRect().top)).toBe(16);

    // New SPA header nodes receive the same styles without a DOM observer.
    await page.evaluate(() => {
      document.querySelector('#page_header_cont')!.outerHTML = '<div id="page_header_cont"><div id="page_header">New header</div></div>';
      document.querySelector<HTMLElement>('#layout_wrapper_root')!.style.setProperty('--header-height', '64px');
      window.scrollTo(0, 0);
    });
    await expect(page.locator('#page_header')).toHaveCSS('height', '64px');
    await expect.poll(() => page.locator('#content').evaluate(el => el.getBoundingClientRect().top)).toBe(64);
    await expect(page.locator('.layout-body')).toHaveCSS('padding-top', '0px');

    await page.evaluate(() => document.documentElement.removeAttribute('data-vkify-static_header'));
    await expect(page.locator('#page_header_cont')).toHaveCSS('position', 'fixed');
    await expect(page.locator('.layout-body')).toHaveCSS('padding-top', '64px');
    await expect(page.locator('#right-column')).toHaveCSS('top', '80px');
    await expect(page.locator('#wall-tabs')).toHaveCSS('top', '48px');
    await expect.poll(() => page.locator('#content').evaluate(el => el.getBoundingClientRect().top)).toBe(64);
    await page.evaluate(() => window.scrollTo(0, 250));
    await expect.poll(geometry).toEqual({ header:0, sidebar:64 });

    // Personal profiles still have legacy wall tabs and a JS-pinned column.
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-vkify-static_header', '');
      document.querySelector('#content')!.innerHTML = `<div id="profile_redesigned">
        <div id="profile-tabs" style="position:fixed;top:64px"><h2 id="wall_tabs">Wall</h2></div>
        <div class="ScrollStickyWrapper"><div id="profile-column" style="position:fixed;top:80px;width:345px">Profile sidebar</div></div>
      </div>`;
    });
    await expect(page.locator('#profile-tabs')).toHaveCSS('top', '0px');
    await expect(page.locator('#profile-column')).toHaveCSS('top', '16px');
    await expect(page.locator('#profile-column')).toHaveCSS('width', '345px');
    await page.locator('#profile-column').evaluate(el => (el as HTMLElement).style.top = '-120px');
    await expect(page.locator('#profile-column')).toHaveCSS('top', '-120px');
    await page.locator('#profile-column').evaluate(el => (el as HTMLElement).style.top = '80px');
    await page.evaluate(() => document.documentElement.removeAttribute('data-vkify-static_header'));
    await expect(page.locator('#profile-tabs')).toHaveCSS('top', '64px');
    await expect(page.locator('#profile-column')).toHaveCSS('top', '80px');

    // Audio page wrapper from the supplied player HTML; controls stay intact.
    await page.evaluate(() => {
      document.querySelector('#content')!.innerHTML = `<div id="audio-wrapper" style="height: 72px; width: 912px; z-index: 3; position: fixed; top: 48px;">
        <section data-testid="AudioPage_PlayerBlock"><div data-testid="AudioPlayerBlock_LayoutGroups">
          <button data-testid="audio-player-controls-state-button">Play</button>
          <div id="audio-popover" style="position:fixed;top:120px">Popover</div>
        </div></section><div style="--vkui_internal--spacing_gap_size: 16px;"></div>
      </div>`;
      document.documentElement.setAttribute('data-vkify-static_header', '');
    });
    await expect(page.locator('#audio-wrapper')).toHaveCSS('top', '0px');
    await expect(page.locator('#audio-wrapper')).toHaveCSS('position', 'fixed');
    await expect(page.locator('#audio-wrapper')).toHaveCSS('height', '72px');
    await expect(page.locator('#audio-wrapper')).toHaveCSS('width', '912px');
    await expect(page.locator('#audio-popover')).toHaveCSS('top', '120px');
    await expect(page.getByTestId('audio-player-controls-state-button')).toBeEnabled();
    await page.locator('#audio-wrapper').evaluate(el => {
      (el as HTMLElement).style.top = '64px'; // VK may rewrite the offset.
    });
    await expect(page.locator('#audio-wrapper')).toHaveCSS('top', '0px');
    await page.evaluate(() => document.documentElement.removeAttribute('data-vkify-static_header'));
    await expect(page.locator('#audio-wrapper')).toHaveCSS('top', '64px');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-vkify-static_header', '');
      document.querySelector<HTMLElement>('#audio-wrapper')!.style.position = 'static';
    });
    await expect(page.locator('#audio-wrapper')).toHaveCSS('top', '64px');
  } finally { await browser.close(); }
});
