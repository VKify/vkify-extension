import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { resolve } from 'node:path';

test('photo search reuses dialog export card and opens selected providers', async ({}, info) => {
  const bundle = await build({ stdin: { contents: `import { createPhotoSearchFeature } from './src/content/features/center/photo/search.ts';
    window.ready = createPhotoSearchFeature({ getAllSettings: async () => ({ photo_search_providers: ['google','yandex','ozon','wildberries','bing','tineye','saucenao','iqdb'], photo_search_default: 'google' }), observeChanges: () => () => {}, onStorageChange: () => () => {} }).enable(true);`, resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', alias: { '@': resolve('src') } });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  try {
    await page.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html', body: '<style>body{background:#111;color:#ccc;font:13px Arial}.pv_bottom_actions{position:absolute;bottom:30px;right:40px}.pv_bottom_actions > .pv_actions_more{position:relative;background:none;border:0;color:inherit}#pv_more_acts_tt{position:absolute;background:#333;color:#fff;padding:5px 0;border-radius:2px;z-index:110}#pv_more_acts_tt .pv_more_act_item{display:block;width:100%;border:0;background:transparent;color:#fff;text-align:left;padding:8px 25px 8px 10px}#pv_more_acts_tt .pv_more_act_item:hover{background:#444}.divider{margin:0 8px}</style><div id="pv_box"><div id="pv_photo"><img src="https://example.com/photo.jpg"></div><div class="pv_bottom_actions"><span class="divider">·</span><button class="pv_actions_more">Ещё<div id="pv_more_acts_tt" class="eltt eltt_top" style="display:none"><div class="eltt_arrow_back _eltt_arrow_back"><div class="eltt_arrow"></div></div><div class="eltt_content"><div class="pv_more_acts"><a class="pv_more_act_item" href="#">Original</a></div></div></div></button></div></div>' }));
    await page.goto('https://vk.ru/photo1_1');
    await page.evaluate(() => { (window as any).opened = []; window.open = (url?: string | URL) => { (window as any).opened.push(String(url)); return null; }; });
    await page.evaluate(() => { document.querySelector('.pv_actions_more')!.append(document.getElementById('pv_more_acts_tt')!); });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.evaluate(() => (window as any).ready);
    const primary = page.locator('.vkify-photo-search-primary');
    await expect(primary).toHaveAttribute('aria-label', /Google Lens/);
    await primary.click();
    expect(await page.evaluate(() => (window as any).opened[0])).toContain('lens.google.com/uploadbyurl');
    const trigger = page.locator('.vkify-photo-search-toggle');
    await expect(trigger).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(trigger).toHaveCSS('border-top-width', '0px');
    await trigger.click();
    const popup = page.locator('#vkify-photo-search-popup');
    await expect(popup).toBeVisible();
    await expect(popup).toHaveClass(/vkify-card/);
    await expect(popup.locator('.vkify-card__head')).toContainText('Найти по фото');
    await expect(popup.getByRole('menuitem')).toHaveCount(8);
    await expect(popup.locator('.vkify-card__title')).toHaveText(['Google Lens', 'Яндекс', 'Ozon', 'Wildberries', 'Bing', 'TinEye', 'SauceNAO', 'IQDB']);
    const item = popup.getByRole('menuitem').first();
    await expect(item).toHaveClass('vkify-card__item');
    await expect(item.locator('.vkify-card__status')).toHaveText('По умолчанию');
    await expect(item).toHaveCSS('border-top-width', '0px');

    await page.screenshot({ path: info.outputPath('vk-photo-search-menu.png') });
    await item.press('Escape');
    await expect(popup).not.toBeVisible();
    await expect(page.locator('.pv_bottom_actions > .pv_actions_more .pv_more_act_item')).toHaveText('Original');
    await expect(page.locator('#pv_more_acts_tt')).toHaveCount(1);
    await trigger.click();
    await popup.getByRole('menuitem', { name: /Bing/ }).click();
    expect(await page.evaluate(() => (window as any).opened[1])).toContain('bing.com/images/search');
    await expect(popup).toHaveCount(0);
    for (const name of ['Ozon', 'Wildberries']) {
      await trigger.click();
      const row = popup.getByRole('menuitem', { name: new RegExp(name) });
      await expect(row.locator('img')).toHaveJSProperty('complete', true);
      expect(await row.locator('img').evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await row.click();
      const opened = await page.evaluate(() => (window as any).opened.slice(-1)[0]);
      expect(new URL(opened).searchParams.get('q')).toBe('site:' + name.toLowerCase() + '.ru');
    }
  } finally { await browser.close(); }
});
