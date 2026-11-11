import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('the hidden-post notice stays suppressed with feed API and browser promo filters off', async () => {
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true, executablePath: process.env.PW_CHROME_PATH,
    args: ['--disable-features=DisableLoadExtensionCommandLineSwitch', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('schema_version')).schema_version)).toBeTruthy();
    await worker.evaluate(() => chrome.storage.local.set({ onboarding_done: true, first_run: false, block_feed_ads_api: false, block_yandex_browser_promo: false }));
    const page = await context.newPage();
    const payload = { response: { items: [{ type: 'ads', id: 1 }, { type: 'post', id: 2 }] } };
    await page.route('https://web.api.vk.ru/method/**', route => route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, json: payload }));
    await page.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `
      <main><article>Обычный пост</article><div role="dialog" id="other">Другое окно</div><button id="show">Показать уведомление</button></main>
      <script>
      window.vk={pe:{'frontend.feed_replaced_item_notify':true,'frontend.feed_replaced_items_stats':true},toggles:{feed_replaced_item_notify:true}};
      document.querySelector('#show').onclick=()=>{
        const layer=document.createElement('div'); layer.style.zIndex='var(--vkui--z_index_popout)';
        layer.innerHTML='<div data-testid="feed_replaced_item_notify_modal"><h2>Вам видны не все посты</h2><div data-testid="modalfooter"><button>Закрыть</button></div></div>';
        document.body.style.overflow='hidden'; document.body.append(layer);
        layer.querySelector('button').onclick=()=>{layer.remove();document.body.style.removeProperty('overflow');};
      };
      </script>` }));
    await page.goto('https://vk.ru/feed');
    await expect.poll(() => page.evaluate(() => (window as any).vk.pe['frontend.feed_replaced_item_notify'])).toBe(false);
    await expect.poll(() => page.locator('#vkify-vkify-feed-adblock-notice').count()).toBe(1);
    const showAndCheck = async () => {
      await page.locator('#show').click();
      await expect(page.locator('[data-testid="feed_replaced_item_notify_modal"]')).toHaveCount(0);
      await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
      await expect(page.locator('#other')).toBeVisible();
    };
    await showAndCheck();
    expect(await page.evaluate(async () => (await (await fetch('https://web.api.vk.ru/method/newsfeed.get')).json()))).toEqual(payload);
    for (const enabled of [true, false]) {
      await worker.evaluate(value => chrome.storage.local.set({ block_feed_ads_api: value }), enabled);
      await expect.poll(async () => (await page.evaluate(async () => (await (await fetch('https://web.api.vk.ru/method/newsfeed.get')).json()))).response.items.length).toBe(enabled ? 1 : 2);
      await showAndCheck();
      expect(await page.evaluate(() => (window as any).vk.toggles.feed_replaced_item_notify)).toBe(false);
    }
  } finally { await context.close(); }
});
