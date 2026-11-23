import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

for (const flag of ['data-vkify-content_width', 'data-vkify-edge_sidebar', 'data-vkify-sidebar_right', 'data-vkify-minimalistic_sidebar', 'data-vkify-tile_sidebar']) test(`${flag}: wide community and profile covers retain their ratio and avatar overlap`, async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 2560, height: 1200 } });
    const css = await readFile('src/content/features/appearance/layout/widescreen.css', 'utf8');
    // Cover geometry observed on vk.ru/vkify. Personal profiles use the same
    // cover component, including a separate shorter placeholder without image.
    await page.setContent(`<style>
      body { margin:0 }
      section { width:912px }
      .cover { position:relative;overflow:hidden;height:326px }
      .image { position:relative;height:303px;background-size:cover;background-position:bottom center }
      .image::after { content:"";position:absolute;top:303px;height:303px;width:100%;background:inherit;transform:scaleY(-1) }
      .info { position:relative;margin-top:-24px;padding:20px }
      .avatar { width:96px;height:96px;margin-top:-40px }
      .empty { height:250px!important }
      ${css}
    </style><main id="spa_layout_content">${['group-header', 'profile-header'].map(header => `
      <section data-header="${header}">
        <div class="cover"><div class="image" style="background-image:url(https://example.com/bg?type=cover_group)"></div></div>
        <div class="info"><div class="avatar"></div></div>
      </section>`).join('')}
      <section data-testid="profile-header"><div class="empty cover"></div></section></main>`);
    const covers = page.locator('.image');
    await page.evaluate(flag => document.documentElement.setAttribute(flag, ''), flag);
    for (const zoom of [0.8, 1, 1.25]) for (const width of [730, 912, 1500, 1800, 2330]) {
      await page.locator('body').evaluate((el, zoom) => el.style.zoom = String(zoom), zoom);
      await page.locator('section').evaluateAll((els, w) => els.forEach(el => { el.style.width = `${w}px`; }), width);
      for (const image of await covers.all()) {
        const geometry = await image.evaluate(el => {
          const box = el.getBoundingClientRect();
          const cover = el.parentElement!.getBoundingClientRect();
          const avatar = el.parentElement!.nextElementSibling!.querySelector('.avatar')!.getBoundingClientRect();
          const reflection = getComputedStyle(el, '::after');
          return { width:box.width, height:box.height, strip:cover.height-box.height, overlap:cover.bottom-avatar.top,
            reflectionTop:parseFloat(reflection.top), reflectionHeight:parseFloat(reflection.height) };
        });
        expect(geometry.width).toBeCloseTo(width * zoom, 1);
        expect(geometry.height).toBeCloseTo(width * 303 / 912 * zoom, 1);
        expect(geometry.strip).toBeCloseTo(23 * zoom, 1);
        expect(geometry.overlap).toBeCloseTo(44 * zoom, 1);
        expect(geometry.reflectionTop).toBeCloseTo(geometry.height / zoom, 1);
        expect(geometry.reflectionHeight).toBeCloseTo(geometry.height / zoom, 1);
      }
      await expect(page.locator('.empty')).toHaveCSS('height', '250px');
      await expect(page.locator('.empty')).toHaveCSS('padding-bottom', '0px');
    }
    await page.evaluate(flag => document.documentElement.removeAttribute(flag), flag);
    for (const image of await covers.all()) await expect(image).toHaveCSS('height', '303px');
  } finally { await browser.close(); }
});
