import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('themes modal cards without painting or blurring their larger legacy mounting boxes', async ({ page }) => {
  const css = await readFile('src/content/features/appearance/theme/theme.css', 'utf8');
  // Structure observed in the community members modal. The reserved mounting
  // height is independent of the inner card, especially after switching tabs.
  await page.setContent('<html><head><style>' + css + '</style><style>' +
    ':root { --vkui--color_background_content:rgb(41,41,41); }' +
    '.popup_box_container--no-body > .box_layout { background:transparent; }' +
    '.box_layout { background:white; }' +
    '#modern .box_layout, #modern .vkui__root { min-height:700px; }' +
    '.vkitInternalModalBox { height:240px; background:var(--vkui--color_background_content); border-radius:12px; }' +
    '</style></head><body>' +
    '<div id="modern" class="popup_box_container popup_box_container--no-body popup_box_container--no-shadow">' +
    '<div class="box_layout"><div class="vkui__root"><div class="MembersListModal__modalContainer--fixture">' +
    '<section class="vkitInternalModalBox">Members</section></div></div></div></div>' +
    '<div id="legacy" class="popup_box_container"><div class="box_layout"><div class="box_title_wrap">Legacy dialog</div></div></div>' +
    '</body></html>');
  const wrapper = page.locator('#modern > .box_layout');
  const card = page.locator('.vkitInternalModalBox');
  for (const opacity of [1, 0.5]) for (const glass of [false, true]) {
    await page.evaluate(({ opacity, glass }) => {
      const root = document.documentElement;
      root.setAttribute('data-vkify-theme', '');
      root.toggleAttribute('data-vkify-glass', glass);
      root.style.setProperty('--vkify-n15', 'rgba(10, 14, 20, ' + opacity + ')');
      root.style.setProperty('--vkify-n15-solid', '#0a0e14');
      root.style.setProperty('--vkify-glass-amount', '20');
    }, { opacity, glass });
    const surface = opacity === 1 ? 'rgb(10, 14, 20)' : 'rgba(10, 14, 20, 0.5)';
    await expect(wrapper).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(page.locator('#modern .vkui__root')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(page.locator('#modern')).toHaveCSS('backdrop-filter', 'none');
    await expect(card).toHaveCSS('background-color', surface);
    await expect(card).toHaveCSS('backdrop-filter', glass ? 'blur(20px) saturate(1.6)' : 'none');
    await expect(page.locator('#legacy .box_layout')).toHaveCSS('background-color', surface);
    await expect(page.locator('#legacy')).toHaveCSS('backdrop-filter', glass ? 'blur(20px) saturate(1.6)' : 'none');
    expect((await wrapper.boundingBox())!.height).toBeGreaterThan((await card.boundingBox())!.height);
  }
  await page.evaluate(() => {
    document.documentElement.removeAttribute('data-vkify-theme');
    document.documentElement.removeAttribute('data-vkify-glass');
  });
  await expect(card).toHaveCSS('background-color', 'rgb(41, 41, 41)');
  await expect(card).toHaveCSS('backdrop-filter', 'none');
  await expect(page.locator('#legacy .box_layout')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});
