import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('current profile cover and empty placeholder scale with their container', async ({ page }) => {
 const css = await readFile('src/content/features/appearance/layout/widescreen.css','utf8');
 await page.setContent(`<style>.profile{width:912px}.cover{position:relative;height:326px;overflow:hidden}.empty{height:250px}.cover>button{position:absolute;right:12px;bottom:12px}.profile-image{position:relative;height:295px;background-size:cover}.profile-image::after{content:"";position:absolute;top:303px;height:303px;width:100%;background:inherit;transform:scaleY(-1)}${css}</style>
 <main id="spa_layout_content"><section class="profile"><div class="cover" id="filled"><div class="profile-image" elementtiming="HET_profile_cover" style="background-image:url(https://example.com/image?type=helpers)"></div><div style="--group-cover-avg-color:#000"></div><button>Edit</button></div></section><section class="profile"><div class="cover empty" id="placeholder"><div style="--group-cover-avg-color:#000"></div><button>Edit</button></div></section></main>`);
 for(const flag of ['content_width','edge_sidebar','sidebar_right','minimalistic_sidebar','tile_sidebar']) {
   await page.evaluate(flag=>document.documentElement.setAttribute('data-vkify-'+flag,''),flag);
   for(const width of [600,912,1400]) {
     await page.locator('.profile').evaluateAll((els,width)=>els.forEach(el=>(el as HTMLElement).style.width=width+'px'),width);
     for(const [id,height] of [['filled',326],['placeholder',250]] as const) expect(await page.locator('#'+id).evaluate(el=>el.getBoundingClientRect().height)).toBeCloseTo(id === 'filled' ? width*303/912+23 : width*height/912,1);
     const reflected = await page.locator('[elementtiming]').evaluate(el=>({height:el.getBoundingClientRect().height,top:parseFloat(getComputedStyle(el,'::after').top),reflection:parseFloat(getComputedStyle(el,'::after').height)}));
     expect(reflected.height).toBeCloseTo(width*303/912,1);
     expect(reflected.top).toBeCloseTo(reflected.height,1);
     expect(reflected.reflection).toBeCloseTo(reflected.height,1);
   }
   await page.evaluate(flag=>document.documentElement.removeAttribute('data-vkify-'+flag),flag);
   await expect(page.locator('#filled')).toHaveCSS('height','326px');
   await expect(page.locator('#placeholder')).toHaveCSS('height','250px');
 }
});

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
