import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('wide community and profile covers retain their ratio and avatar overlap', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 2560, height: 1200 } });
    const css = await readFile('src/content/features/appearance/layout/widescreen.css', 'utf8');
    // Cover geometry observed on vk.ru/vkify. Personal profiles use the same
    // cover component, including a separate shorter placeholder without image.
    await page.setContent(`<style>
      body { margin:0 }
      section { width:912px }
      [data-testid="communityheader_cover"] { position:relative;overflow:hidden;height:326px }
      [data-testid="communityheader_cover_image"] { position:relative;height:303px;background-size:cover;background-position:bottom center }
      [data-testid="communityheader_cover_image"]::after { content:"";position:absolute;top:303px;height:303px;width:100%;background:inherit;transform:scaleY(-1) }
      .info { position:relative;margin-top:-24px;padding:20px }
      .avatar { width:96px;height:96px;margin-top:-40px }
      .empty { height:250px!important }
      ${css}
    </style>${['group-header', 'profile-header'].map(header => `
      <section data-testid="${header}">
        <div data-testid="communityheader_cover"><div data-testid="communityheader_cover_image"></div></div>
        <div class="info"><div class="avatar"></div></div>
      </section>`).join('')}
      <section data-testid="profile-header"><div class="empty" data-testid="communityheader_cover"></div></section>`);
    const covers = page.getByTestId('communityheader_cover_image');
    await page.evaluate(() => document.documentElement.setAttribute('data-vkify-content_width', ''));
    for (const width of [730, 912, 1500, 1800, 2330]) {
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
        expect(geometry.width).toBe(width);
        expect(geometry.height).toBeCloseTo(width * 303 / 912, 1);
        expect(geometry.strip).toBeCloseTo(23, 1);
        expect(geometry.overlap).toBeCloseTo(44, 1);
        expect(geometry.reflectionTop).toBeCloseTo(geometry.height, 1);
        expect(geometry.reflectionHeight).toBeCloseTo(geometry.height, 1);
      }
      await expect(page.locator('.empty')).toHaveCSS('height', '250px');
      await expect(page.locator('.empty')).toHaveCSS('padding-bottom', '0px');
    }
    await page.evaluate(() => document.documentElement.removeAttribute('data-vkify-content_width'));
    for (const image of await covers.all()) await expect(image).toHaveCSS('height', '303px');
  } finally { await browser.close(); }
});
