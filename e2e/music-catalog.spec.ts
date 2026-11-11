import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('music promotions disappear from API data without hiding playlists or subscription controls', async () => {
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true, executablePath: process.env.PW_CHROME_PATH,
    args: ['--disable-features=DisableLoadExtensionCommandLineSwitch', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('schema_version')).schema_version)).toBeTruthy();
    await worker.evaluate(() => chrome.storage.local.set({ onboarding_done: true, first_run: false, block_music_ads: true }));
    const page = await context.newPage();
    const data = {
      catalog: { header: { blocks: [{ data_type: 'catalog_banners', catalog_banner_ids: [12909] }] }, sections: [{ id: 'main', blocks: [{ data_type: 'music_recommended_playlists', playlists_ids: ['1_2'] }] }] },
      catalog_banners: [{ id: 12909, click_action: { action: { type: 'open_url', url: 'https://vk.ru/vk_music#utm_campaign=musbanner1m0r199trial&p=musbanner1m0r199' } } }],
      audios: [{ id: 7 }], playlists: [{ id: 2 }], buttons: [{ action: { type: 'open_url', url: 'https://vk.ru/vk_music' } }],
    };
    await page.route('https://web.api.vk.ru/method/**', route => route.fulfill({
      contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      json: { responses: [{ id: 'permissions', body: { response: { audio_permissions: { audio_meta_info: false } } } }, { id: 'music', body: { response: data } }] },
    }));
    await page.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<main><div id="banner"></div><div data-testid="AudioCatalog_SectionListenEachOther">Playlists</div><a href="/vk_music">Subscription</a></main><script>window.cur={apiPrefetchCache:[{method:'catalog.getAudio',response:${JSON.stringify(data)}}]}</script>` }));
    await page.goto('https://vk.ru/audios1');
    await expect.poll(() => page.evaluate(() => (window as any).cur.apiPrefetchCache[0].response.catalog_banners.length)).toBe(0);
    const request = () => page.evaluate(async () => (await (await fetch('https://web.api.vk.ru/method/batch.call', { method: 'POST', body: JSON.stringify({ requests: [{ id: 'music', method: 'catalog.getAudio' }, { id: 'permissions', method: 'audio.getConfig' }] }) })).json()));
    const result = await request();
    expect(result.responses[1].body.response).toEqual({ ...data, catalog_banners: [], catalog: { ...data.catalog, header: { blocks: [] } } });
    expect(result.responses[0].body.response.audio_permissions.audio_meta_info).toBe(false);
    await expect(page.locator('[data-testid="AudioCatalog_SectionListenEachOther"]')).toBeVisible();
    await expect(page.locator('a[href="/vk_music"]')).toBeVisible();
    expect(await page.locator('style[data-vkify="block_music_ads"]').count()).toBe(0);
    await worker.evaluate(() => chrome.storage.local.set({ block_music_ads: false }));
    await expect.poll(async () => (await request()).responses[1].body.response.catalog_banners.length).toBe(1);
  } finally { await context.close(); }
});
