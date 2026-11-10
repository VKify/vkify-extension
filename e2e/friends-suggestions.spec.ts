import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('friends suggestions are filtered from prefetch and requests without CSS or missing friends', async () => {
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true, executablePath: process.env.PW_CHROME_PATH,
    args: ['--disable-features=DisableLoadExtensionCommandLineSwitch', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('schema_version')).schema_version)).toBeTruthy();
    await worker.evaluate(() => chrome.storage.local.set({ onboarding_done: true, first_run: false, hide_friends_suggestions: true }));
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const payload = { response: { count: 1, title: 'Возможные друзья', track_code: 'metadata', items: [{ id: 3, first_name: 'Suggested' }] } };
    let serverRequests = 0;
    await page.route('https://web.api.vk.ru/method/**', route => {
      serverRequests++;
      return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, json: payload });
    });
    await page.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `
      <div id="friends"></div><aside id="recommendations"></aside><button id="render">Render</button>
      <script>
        window.cachedSuggestions = () => ({ method: 'friends.getRecommendations',
          request: { count: 10, need_description: 1, ref: 'friends_main_recommended_friends_right_block' },
          ...${JSON.stringify(payload)} });
        window.cur = { apiPrefetchCache: [
          { method: 'friends.get', response: { count: 1, items: [{ id: 9, first_name: 'Friend' }] } },
          window.cachedSuggestions()
        ] };
        document.querySelector('#render').onclick = () => {
          const cache = window.cur.apiPrefetchCache;
          document.querySelector('#friends').textContent = cache[0].response.items.map(p => p.first_name).join();
          document.querySelector('#recommendations').innerHTML = cache[1].response.items.length
            ? '<section>Возможные друзья</section>' : '';
        };
      </script>` }));
    await page.goto('https://vk.ru/friends?section=all');
    await expect.poll(() => page.evaluate(() => (window as any).cur.apiPrefetchCache[1].response.count)).toBe(0);
    await page.locator('#render').click();
    await expect(page.locator('#friends')).toHaveText('Friend');
    await expect(page.locator('#recommendations section')).toHaveCount(0);
    expect(await page.evaluate(() => document.querySelector('style[data-vkify="hide_friends_suggestions"]') === null)).toBe(true);
    const request = async (ref: string) => page.evaluate(async ref => {
      const response = await fetch('https://web.api.vk.ru/method/friends.getRecommendations?v=5.289', {
        method: 'POST', body: new URLSearchParams({ ref }),
      });
      return response.json();
    }, ref);
    expect(await request('friends_main_recommended_friends_right_block')).toEqual({ response: { count: 0, items: [] } });
    expect(serverRequests).toBe(0);
    expect(await request('friends_search')).toEqual(payload);
    expect(serverRequests).toBe(1);

    // A later SPA cache also gets filtered, without altering regular friends.
    await page.evaluate(() => {
      const w = window as any;
      history.pushState({}, '', '/friends?section=online');
      window.cur = { apiPrefetchCache: [w.cur.apiPrefetchCache[0], w.cachedSuggestions()] } as any;
    });
    await page.locator('#render').click();
    await expect(page.locator('#friends')).toHaveText('Friend');
    await expect(page.locator('#recommendations section')).toHaveCount(0);

    await worker.evaluate(() => chrome.storage.local.set({ hide_friends_suggestions: false }));
    await expect.poll(async () => (await request('friends_main_recommended_friends_right_block')).response.count).toBe(1);
    await page.evaluate(() => {
      const w = window as any;
      w.cur.apiPrefetchCache = [w.cur.apiPrefetchCache[0], w.cachedSuggestions()];
    });
    await page.locator('#render').click();
    await expect(page.locator('#recommendations section')).toHaveText('Возможные друзья');
    await expect(page.locator('#friends')).toHaveText('Friend');
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
