import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

for (const mode of ['tile', 'edge']) {
  test(`${mode} sidebar styles native Skeleton rows and restores the default layout`, async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
    try {
      const page = await browser.newPage({ viewport: { width: 1100, height: 600 } });
      const css = await readFile(`src/content/features/appearance/sidebar/${mode}-sidebar.css`, 'utf8');
      // LeftMenuOld.Skeleton uses unmarked li/div and a stable ImageBase class.
      const rows = Array.from({ length: 14 }, (_, i) => `<li style="pointer-events:none">
        <div class="vkit-IgMYrO"><div class="vkitInternalImageBase" style="width:20px;height:20px;margin-right:10px">
        <div class="shimmer" style="width:20px;height:20px;border-radius:50%"></div></div>
        <div class="shimmer label" style="width:calc(100% * 0.${5 + i % 4});height:12px"></div></div></li>`).join('');
      await page.setContent(`<html data-vkify-${mode}_sidebar><style>
        :root{--spa-layout-sidebar-width:164px;--spa-layout-header-height:48px}
        body{margin:0}#layout_sidebar{width:164px}
        [class*="LeftMenu__root"]{width:164px}nav>ol{display:flex;flex-direction:column;padding:0;margin:0;list-style:none}
        li>div{display:flex;align-items:center;height:30px;padding:0 6px;box-sizing:border-box}
        .shimmer{background:#aaa;max-width:100%}.label{flex:1}
        ${css}</style><aside id="layout_sidebar"><div class="LeftMenu__root--fixture">
        <nav data-testid="leftmenu"><ol>${rows}</ol></nav>
        <div id="other"><div class="shimmer">Unrelated skeleton</div></div>
        </div></aside></html>`);
      const list = page.locator('ol');
      const row = page.locator('li > div').first();
      await expect(list).toHaveCSS('display', mode === 'tile' ? 'grid' : 'flex');
      await expect(row).toHaveCSS('height', mode === 'tile' ? '52px' : '38px');
      const boxes = await page.locator('li').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().x));
      expect(new Set(boxes).size).toBe(mode === 'tile' ? 2 : 1);
      const icon = (await row.locator('.vkitInternalImageBase').boundingBox())!;
      const label = (await row.locator('.label').boundingBox())!;
      const box = (await row.boundingBox())!;
      if (mode === 'tile') {
        expect(icon.x + icon.width / 2).toBeCloseTo(box.x + box.width / 2, 1);
        expect(label.y).toBeGreaterThan(icon.y + icon.height);
        expect(label.x).toBeGreaterThanOrEqual(box.x);
        expect(label.x + label.width).toBeLessThanOrEqual(box.x + box.width);
      } else {
        expect(label.x - icon.x - icon.width).toBe(12);
        expect((await page.locator('#layout_sidebar').boundingBox())!.x).toBe(0);
      }
      await expect(page.locator('#other')).toHaveCSS('display', 'block');
      if (mode === 'edge') {
        // Reproduce loading labels sized against the viewport instead of the rail.
        await page.locator('.label').evaluateAll(nodes => nodes.forEach(el => {
          (el as HTMLElement).style.width = '1600px';
          (el as HTMLElement).style.flex = '0 0 auto';
        }));
        await page.locator('nav').evaluate(nav => {
          nav.insertAdjacentHTML('afterend', `<div class="LeftMenuLegacySkeleton">
            <div class="LeftMenuLegacySkeleton__item">
            <div class="LeftMenuLegacySkeleton__icon" style="width:20px;height:20px"></div>
            <div class="LeftMenuLegacySkeleton__label" style="width:1600px;flex:none">
            <div style="width:1600px;height:12px"></div></div></div></div>`);
        });
        for (const width of [2596, 1100, 820]) {
          await page.setViewportSize({ width, height: 600 });
          const rail = (await page.locator('#layout_sidebar').boundingBox())!;
          for (const stub of await page.locator('.label, .LeftMenuLegacySkeleton__label, .LeftMenuLegacySkeleton__label > div').all()) {
            const bounds = (await stub.boundingBox())!;
            expect(bounds.x).toBeGreaterThanOrEqual(rail.x);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(rail.x + rail.width);
          }
          expect(await page.locator('#layout_sidebar').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        }
      }
      await page.evaluate(mode => document.documentElement.removeAttribute('data-vkify-' + mode + '_sidebar'), mode);
      await expect(list).toHaveCSS('display', 'flex');
      await expect(row).toHaveCSS('height', '30px');
    } finally { await browser.close(); }
  });
}

test('edge profile Skeleton fills the content area and stacks at the loaded breakpoint', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const css = await readFile('src/content/features/appearance/sidebar/edge-sidebar.css', 'utf8');
    await page.setContent(`<html data-vkify-edge_sidebar><style>
      body{margin:0}#spa_layout_content{width:100%}.ProfileSkeleton{width:912px}
      .ProfileSkeleton__layout{display:flex}
      .ProfileSkeleton__column--wide{width:550px;height:200px}
      .ProfileSkeleton__column--narrow{flex:1;width:100%;min-width:0;margin-left:16px;height:180px}
      ${css}</style><div id="spa_layout_content"><div class="ProfileSkeleton">
      <div class="ProfileSkeleton__layout">
      <div class="ProfileSkeleton__column--wide"></div><div class="ProfileSkeleton__column--narrow"></div>
      </div></div></div></html>`);
    for (const width of [1100, 820, 700]) {
      await page.setViewportSize({ width, height: 720 });
      const wide = (await page.locator('.ProfileSkeleton__column--wide').boundingBox())!;
      const narrow = (await page.locator('.ProfileSkeleton__column--narrow').boundingBox())!;
      expect(narrow.x + narrow.width).toBeCloseTo(width, 1);
      if (width > 760) expect(narrow.x - wide.x - wide.width).toBe(16);
      else {
        expect(wide.width).toBe(width);
        expect(narrow.width).toBe(width);
        expect(narrow.y).toBeGreaterThanOrEqual(wide.y + wide.height);
      }
    }
  } finally { await browser.close(); }
});
