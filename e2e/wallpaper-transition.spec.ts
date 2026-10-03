import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';

test('wallpapers fade after loading, keep the old photo on errors and discard late selections', async ({}, info) => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 600, height: 400 } });
    let releaseBlue!: () => void;
    const blueWait = new Promise<void>(resolve => { releaseBlue = resolve; });
    let releaseGreen!: () => void;
    const greenWait = new Promise<void>(resolve => { releaseGreen = resolve; });
    await page.route('http://wallpaper.test/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/blue.svg') await blueWait;
      if (path === '/green.svg') await greenWait;
      if (path === '/bad.svg') { await route.fulfill({ status: 404 }); return; }
      const color = path === '/blue.svg' ? '#185cdd' : path === '/green.svg' ? '#128d55' : '#dc3452';
      await route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="${color}"/></svg>` });
    });
    await page.setContent('<html><head></head><body style="margin:0;min-height:100vh;background:#111"></body></html>');
    const script = await build({ stdin: { resolveDir: process.cwd(), contents: `
      import { createBackgroundFeatures } from './src/content/features/appearance/background/index.ts';
      const settings = { background_type: 'image', background_dim: 0, background_opacity: 100, background_scale: 100 };
      let handlers;
      const manager = {
        getSetting: async key => settings[key], getFeatureHandler: key => handlers[key],
        injectCSS: (id, css) => { let style = document.getElementById('vkify-' + id); if (!style) { style = document.createElement('style'); style.id = 'vkify-' + id; document.head.append(style); } style.textContent = css; },
        removeCSS: id => document.getElementById('vkify-' + id)?.remove(),
      };
      handlers = createBackgroundFeatures(manager);
      window.applyWallpaper = async url => { settings.custom_background = url; await handlers.custom_background.enable(url); };
    ` }, bundle: true, write: false, format: 'iife', platform: 'browser', tsconfig: 'tsconfig.app.json' });
    await page.addScriptTag({ content: script.outputFiles[0].text });
    const apply = (name: string) => page.evaluate(async url => (window as any).applyWallpaper(url), name ? `http://wallpaper.test/${name}.svg` : '');
    await apply('red');
    await expect(page.locator('#vkify-bg-container')).toHaveCSS('opacity', '1');
    await apply('blue');
    await expect(page.locator('#vkify-image-bg-previous')).toHaveCSS('background-image', /red\.svg/);
    await expect(page.locator('#vkify-bg-container')).toHaveCSS('opacity', '0');
    releaseBlue();
    await expect.poll(async () => Number(await page.locator('#vkify-bg-container').evaluate(el => getComputedStyle(el).opacity))).toBeGreaterThan(0.05);
    expect(Number(await page.locator('#vkify-bg-container').evaluate(el => getComputedStyle(el).opacity))).toBeLessThan(1);
    await page.screenshot({ path: info.outputPath('wallpaper-crossfade.png'), animations: 'allow' });
    await expect(page.locator('#vkify-bg-container-previous')).toHaveCount(0);
    await apply('bad');
    await expect(page.locator('#vkify-bg-container')).toHaveCount(0);
    await expect(page.locator('#vkify-image-bg-previous')).toHaveCSS('background-image', /blue\.svg/);
    await apply('green');
    await apply('red');
    releaseGreen();
    await expect(page.locator('#vkify-bg-container')).toHaveCSS('opacity', '1');
    await expect(page.locator('#vkify-image-bg')).toHaveCSS('background-image', /red\.svg/);
    await expect(page.locator('#vkify-bg-container-previous')).toHaveCount(0);
    await apply('');
    await expect(page.locator('#vkify-bg-container')).toHaveCount(0);
    await expect(page.locator('#vkify-bg-container-previous')).toHaveCount(1);
    await expect(page.locator('#vkify-bg-container-previous')).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await apply('red');
    await expect(page.locator('#vkify-bg-container')).toHaveCSS('opacity', '1');
    await apply('blue');
    await expect(page.locator('#vkify-bg-container')).toHaveCSS('opacity', '1');
    await expect(page.locator('#vkify-bg-container-previous')).toHaveCount(0);
  } finally { await browser.close(); }
});
