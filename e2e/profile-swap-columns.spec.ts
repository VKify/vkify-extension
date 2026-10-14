import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('profile columns swap with current VK classes and retain one gap', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const css = await readFile('src/content/features/center/profile/swap-columns.css', 'utf8');
    // Pair observed on vk.ru/00x69; the header also uses the new SplitCol class.
    await page.setContent(`<style>
      :root{--page-block-offset:16px}body{margin:0}
      .row{display:flex;width:912px}.Profile__column{width:550px;height:200px}
      .row>.ScrollStickyWrapper{width:345px;margin-left:16px;height:200px}
      ${css}
      </style><div id="react_rootprofile"><main id="profile_redesigned">
      <div id="header" class="vkuiInternalSplitCol--viewWidth-tabletPlus">Header</div>
      <div class="row"><div class="Profile__column H7Tgz2 vkuiInternalSplitCol--viewWidth-tabletPlus">
      <div id="nested" class="ScrollStickyWrapper">Nested sticky content</div></div>
      <div id="side" class="ScrollStickyWrapper"><div style="width:345px">
      <aside data-testid="profile-narrow-column-empty">Side</aside></div></div></div>
      </main></div><div id="unrelated" class="ScrollStickyWrapper">Unrelated sticky</div>`);
    const wide = page.locator('.Profile__column');
    const side = page.locator('#side');
    expect((await wide.boundingBox())!.x).toBe(0);
    await page.evaluate(() => document.documentElement.setAttribute('data-vkify-profile_swap_columns', ''));
    expect((await side.boundingBox())!.x).toBe(0);
    expect((await wide.boundingBox())!.x - (await side.boundingBox())!.width).toBe(16);
    for (const id of ['header', 'nested', 'unrelated']) {
      await expect(page.locator('#' + id)).toHaveCSS('order', '0');
      await expect(page.locator('#' + id)).toHaveCSS('margin-right', '0px');
    }
    await page.getByTestId('profile-narrow-column-empty').evaluate(el => el.setAttribute('data-testid', 'profile-narrow-column'));
    await side.evaluate(el => el.replaceWith(el.cloneNode(true)));
    expect((await side.boundingBox())!.x).toBe(0);
    // Edge menu already defines a gap: there must still be exactly one.
    await page.addStyleTag({ content: await readFile('src/content/features/appearance/sidebar/edge-sidebar.css', 'utf8') });
    await page.evaluate(() => document.documentElement.setAttribute('data-vkify-edge_sidebar', ''));
    expect((await wide.boundingBox())!.x - (await side.boundingBox())!.width).toBe(16);
    await page.evaluate(() => {
      document.documentElement.removeAttribute('data-vkify-edge_sidebar');
      document.documentElement.removeAttribute('data-vkify-profile_swap_columns');
    });
    expect((await wide.boundingBox())!.x).toBe(0);
    expect((await side.boundingBox())!.x - (await wide.boundingBox())!.width).toBe(16);
  } finally { await browser.close(); }
});

test('profile Skeleton swaps before react_rootprofile mounts and keeps the loaded order', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const css = await readFile('src/content/features/center/profile/swap-columns.css', 'utf8');
    // Skeleton markup and CSS from VK core_spa; it does not need the loaded root.
    await page.setContent(`<style>
      :root{--page-block-offset:16px}body{margin:0}
      #spa_layout_content{width:912px}
      .ProfileSkeleton__layout{display:flex;margin-top:var(--page-block-offset,16px)}
      .ProfileSkeleton__column+.ProfileSkeleton__column{margin-left:var(--page-block-offset,16px)}
      .ProfileSkeleton__column--wide{width:550px;height:200px}
      .ProfileSkeleton__column--narrow{flex:1;width:100%;min-width:0;height:200px}
      ${css}
      </style><div id="spa_layout_content"><div class="ProfileSkeleton ProfileBase">
      <div id="skeleton-header" style="height:120px">Header</div>
      <div class="ProfileSkeleton__layout">
      <div class="ProfileSkeleton__column ProfileSkeleton__column--wide"></div>
      <div class="ProfileSkeleton__column ProfileSkeleton__column--narrow"></div>
      </div></div></div>
      <div id="other" class="ProfileSkeleton__column--narrow">Unrelated</div>`);
    const wide = page.locator('.ProfileSkeleton__layout > .ProfileSkeleton__column--wide');
    const narrow = page.locator('.ProfileSkeleton__layout > .ProfileSkeleton__column--narrow');
    expect((await wide.boundingBox())!.x).toBe(0);
    await page.evaluate(() => document.documentElement.setAttribute('data-vkify-profile_swap_columns', ''));
    expect((await narrow.boundingBox())!.x).toBe(0);
    expect((await wide.boundingBox())!.x - (await narrow.boundingBox())!.width).toBe(16);
    expect((await wide.boundingBox())!.y).toBe(136);
    await expect(page.locator('#skeleton-header')).toHaveCSS('order', '0');
    await expect(page.locator('#other')).toHaveCSS('order', '0');
    await page.evaluate(() => document.documentElement.removeAttribute('data-vkify-profile_swap_columns'));
    expect((await wide.boundingBox())!.x).toBe(0);
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-vkify-profile_swap_columns', '');
      document.querySelector('#spa_layout_content')!.innerHTML = `<div id="react_rootprofile">
        <main id="profile_redesigned"><div style="display:flex">
        <div class="Profile__column" style="width:550px;height:200px"></div>
        <div class="ScrollStickyWrapper" style="width:345px;height:200px;margin-left:16px"></div>
        </div></main></div>`;
    });
    const loadedSide = page.locator('.ScrollStickyWrapper');
    const loadedWide = page.locator('.Profile__column');
    expect((await loadedSide.boundingBox())!.x).toBe(0);
    expect((await loadedWide.boundingBox())!.x - (await loadedSide.boundingBox())!.width).toBe(16);
  } finally { await browser.close(); }
});
