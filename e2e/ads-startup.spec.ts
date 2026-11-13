import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

for (const browser of ['chrome', 'firefox']) for (const enabled of [true, false])
  test(browser + ': first response, initial cache and repeated IM transitions respect startup settings (' + enabled + ')', async ({ page }) => {
    const blocker = await readFile('dist/' + browser + '/injected/feed-ad-blocker.js', 'utf8');
    const seed = JSON.stringify({ block_feed_ads_api: enabled, block_yandex_browser_promo: enabled, block_recommendations_feed: enabled });
    await page.route('https://web.api.vk.ru/method/**', route => route.fulfill({
      contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      json: new URL(route.request().url()).pathname.endsWith('batch.call')
        ? { responses: [{ id: 'im', body: { response: { config: { conversation_bar: { name: 'yandex_promo' }, other: true } } } }] }
        : { response: { conversations_bar: { name: 'yandex_promo' }, other: true } },
    }));
    await page.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html', body:
      '<script>window.cur={apiPrefetchCache:[{method:"account.getInfo",response:{conversations_bar:{name:"yandex_promo"},other:true}}]};</script>' +
      "<script data-vkify-initial-settings='" + seed + "'>" + blocker + '</script>' +
      '<main id="result"></main><script>' +
      'window.readPromo=async()=>{ const response=await fetch("https://web.api.vk.ru/method/account.getInfo");return (await response.json()).response; };' +
      'window.first=readPromo();window.cached=cur.apiPrefetchCache[0].response;' +
      '</script>',
    }));
    await page.goto('https://vk.ru/feed');
    const initial = await page.evaluate(async () => ({ response: await (window as any).first, cache: (window as any).cached }));
    for (const data of [initial.response, initial.cache]) {
      expect(Boolean(data.conversations_bar)).toBe(!enabled); expect(data.other).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      const data = await page.evaluate(async index => {
        history.pushState({}, '', '/im?sel=' + index);
        const body = JSON.stringify({ requests: [{ id: 'im', method: 'messages.getConfig' }] });
        return (await (await fetch(new Request('https://web.api.vk.ru/method/batch.call', { method: 'POST', body }))).json()).responses[0].body.response.config;
      }, i);
      expect(Boolean(data.conversation_bar)).toBe(!enabled); expect(data.other).toBe(true);
    }
  });

test('loaded extension keeps API protection enabled across VK SPA navigation', async () => {
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true, executablePath: process.env.PW_CHROME_PATH,
    args: ['--disable-features=DisableLoadExtensionCommandLineSwitch', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('schema_version')).schema_version)).toBeTruthy();
    await worker.evaluate(() => chrome.storage.local.set({ onboarding_done: true, first_run: false,
      block_feed_ads_api: true, block_yandex_browser_promo: true }));
    const page = await context.newPage();
    await page.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html', body: '<main>VK fixture</main><script>window.filterUpdates=[];window.addEventListener("vkify-update-settings",e=>filterUpdates.push(e.detail));</script>' }));
    await page.route('https://web.api.vk.ru/method/**', route => route.fulfill({ contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' }, json: { response: { conversations_bar: { name: 'yandex_promo' }, other: true } } }));
    await page.goto('https://vk.ru/feed');
    // This module loads after normal feature initialization (production drops console logs).
    await expect.poll(() => page.evaluate(() => (window as any).__vkifyPrivacyModule)).toBe(true);
    for (const pathname of ['/im?sel=223083701', '/feed', '/im?sel=1', '/feed', '/im?sel=2']) {
      await page.evaluate(async path => {
        history.pushState({}, '', path);
        window.dispatchEvent(new PopStateEvent('popstate'));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }, pathname);
      await expect.poll(() => page.evaluate(async () => {
        const data = await (await fetch('https://web.api.vk.ru/method/account.getInfo')).json();
        return data.response;
      })).toEqual({ other: true });
    }
    const updates = await page.evaluate(() => (window as any).filterUpdates);
    expect(updates.some((update: any) => update.block_feed_ads_api === false || update.block_yandex_browser_promo === false)).toBe(false);
  } finally { await context.close(); }
});
