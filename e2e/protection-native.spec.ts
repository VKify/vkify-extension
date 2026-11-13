import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { PROTECTION_SETTING_KEYS, PROTECTION_MAIN_ID, protectionSettingFile } from '../src/shared/constants/protection-startup';

for (const enabled of [true, false]) test('native protection precedes the first inline script, enabled=' + enabled, async () => {
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true, executablePath: process.env.PW_CHROME_PATH,
    args: ['--disable-features=DisableLoadExtensionCommandLineSwitch', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('schema_version')).schema_version)).toBeTruthy();
    await worker.evaluate(async ({ keys, enabled }) => {
      await chrome.storage.local.set({ onboarding_done: true, first_run: false,
        ...Object.fromEntries(keys.map(key => [key, key === 'hide_recent_groups' ? false : enabled])),
        stats_trackers_blocked: 0, stats_ads_blocked: 0, stats_ads_by_section: {}, stats_block_log: [],
      });
    }, { keys: [...PROTECTION_SETTING_KEYS], enabled });
    await expect.poll(() => worker.evaluate(async ({ id, file, enabled }) => {
      const [registration] = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
      return !!registration && registration.world === 'MAIN' && registration.js!.includes(file) === enabled;
    }, { id: PROTECTION_MAIN_ID, file: protectionSettingFile('block_trackers'), enabled })).toBe(true);

    const page = await context.newPage();
    let networkTrackers = 0;
    await page.route('https://mc.yandex.ru/**', route => {
      networkTrackers++;
      return route.fulfill({ contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: '' });
    });
    await page.routeWebSocket('wss://mc.yandex.ru/**', socket => { networkTrackers++; socket.close(); });
    await page.route('https://web.api.vk.ru/method/**', route => route.fulfill({ contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' }, json: route.request().url().includes('account.getInfo')
        ? { response: { conversations_bar: { name: 'yandex_promo' }, other: true } }
        : { response: { items: [{ type: 'ads', id: 1 }, { type: 'post', id: 2 }] } },
    }));
    await page.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html',
      headers: route.request().url().includes('sel=1') ? { 'content-security-policy': "script-src 'nonce-protection'; connect-src https: wss:; img-src https: data:; frame-src 'self'" } : {}, body: `
      <script nonce="protection">
        window.startup={native:document.documentElement.hasAttribute('data-vkify-native-protection')};
        window.cur={apiPrefetchCache:[{method:'newsfeed.get',response:{items:[{type:'ads',id:1},{type:'post',id:2}]}}]};
        startup.cached=cur.apiPrefetchCache[0].response.items;
        startup.responses=Promise.all(['newsfeed.get','account.getInfo'].map(async method=>(await fetch('https://web.api.vk.ru/method/'+method)).json()));
        startup.tracker=fetch('https://mc.yandex.ru/watch/fetch').catch(()=>null);
        navigator.sendBeacon('https://mc.yandex.ru/watch/beacon','test');
        const xhr=new XMLHttpRequest();xhr.open('POST','https://mc.yandex.ru/watch/xhr');xhr.send('test');
        window.socket=new WebSocket('wss://mc.yandex.ru/socket');
        const image=new Image();image.src='https://mc.yandex.ru/watch/pixel';
        const script=document.createElement('script');script.src='https://mc.yandex.ru/metrika/tag.js';document.documentElement.append(script);
        const frame=document.createElement('iframe');frame.src='https://mc.yandex.ru/watch/frame';document.documentElement.append(frame);
      </script><main>VK fixture</main>` }));
    // Repeat full loads as well as SPA transitions; startup must never need a manual reload.
    for (let iteration = 0; iteration < 3; iteration++) {
      await page.goto('https://vk.ru/im?sel=' + iteration);
      const data = await page.evaluate(async () => {
        const startup = (window as any).startup;
        return { native: startup.native, cached: startup.cached, responses: await startup.responses };
      });
      expect(data.native).toBe(true);
      expect(data.cached).toHaveLength(enabled ? 1 : 2);
      expect(data.responses[0].response.items).toHaveLength(enabled ? 1 : 2);
      expect(Boolean(data.responses[1].response.conversations_bar)).toBe(!enabled);
      if (enabled) {
        await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('stats_trackers_blocked')).stats_trackers_blocked)).toBe((iteration + 1) * 7);
        await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('stats_ads_blocked')).stats_ads_blocked)).toBe((iteration + 1) * 3);
        expect(networkTrackers).toBe(0);
      }
    }
    // VK-owned embedded pages need protection before their own first script too.
    await page.evaluate(() => {
      const frame = document.createElement('iframe'); frame.id = 'protection-child';
      frame.src = '/video_ext.php?oid=1&id=2'; document.body.append(frame);
    });
    const child = page.frameLocator('#protection-child');
    await expect(child.locator('main')).toBeVisible();
    const childData = await child.locator('main').evaluate(async () => {
      const startup = (window as any).startup;
      return { native: startup.native, cached: startup.cached, responses: await startup.responses };
    });
    expect(childData.native).toBe(true);
    expect(childData.cached).toHaveLength(enabled ? 1 : 2);
    expect(childData.responses[0].response.items).toHaveLength(enabled ? 1 : 2);
    if (enabled) {
      await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('stats_trackers_blocked')).stats_trackers_blocked)).toBe(28);
      await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('stats_ads_blocked')).stats_ads_blocked)).toBe(12);
      expect(networkTrackers).toBe(0);
    }
    if (!enabled) expect(networkTrackers).toBeGreaterThan(0);
  } finally { await context.close(); }
});
