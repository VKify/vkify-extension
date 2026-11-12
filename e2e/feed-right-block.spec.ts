import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

for (const build of ['chrome', 'firefox']) test(`${build}: sidebar promo is removed before rendering, without CSS`, async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const promo = { type: 'promo_banner', frb_type: 'frb_featured_promo_game', title: 'Помогите Леночке', hide_hash: 'secret' };
    const organic = { type: 'continue_apps', frb_type: 'frb_continue_apps', apps: [{ id: 1 }] };
    await page.route('https://vk.ru/feed', route => route.fulfill({ contentType: 'text/html', body: '<aside id="right"></aside>' }));
    await page.route('https://web.api.vk.ru/method/newsfeed.getRightBlock*', route => route.fulfill({
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: JSON.stringify({ response: { block: new URL(route.request().url()).searchParams.has('organic') ? organic : promo, layout: { name: 'card' } } }),
    }));
    await page.goto('https://vk.ru/feed');
    await page.addScriptTag({ content: await readFile(`dist/${build}/injected/feed-ad-blocker.js`, 'utf8') });
    const result = await page.evaluate(async ({ promo }) => {
      const logs: unknown[] = [];
      window.addEventListener('vkify:blocked', e => logs.push((e as CustomEvent).detail));
      const settings = (enabled: boolean) => window.dispatchEvent(new CustomEvent('vkify-update-settings', {
        detail: { block_recommendations_feed: enabled, block_feed_ads_api: false, block_yandex_browser_promo: false },
      }));
      const request = async (extra = '') => (await fetch('https://web.api.vk.ru/method/newsfeed.getRightBlock?access_token=secret' + extra)).json();
      settings(true);
      const filtered = await request();
      // The actual VK consumer renders a card only when response.block exists.
      const host = document.getElementById('right')!;
      if (filtered.response.block) host.appendChild(document.createElement('section'));
      const rendered = host.children.length;
      const preserved = await request('&organic=1');
      (window as any).cur = { apiPrefetchCache: [{ method: 'newsfeed.getRightBlock', response: { block: promo, layout: { name: 'card' } } }] };
      const prefetch = (window as any).cur.apiPrefetchCache[0].response;
      settings(false);
      const disabled = await request();
      return { filtered, preserved, prefetch, disabled, rendered, logs };
    }, { promo });
    expect(result.filtered).toEqual({ response: { layout: { name: 'card' } } });
    expect(result.rendered).toBe(0);
    expect(await page.locator('style').count()).toBe(0);
    expect(result.preserved.response.block).toEqual(organic);
    expect(result.prefetch).toEqual({ layout: { name: 'card' } });
    expect(result.disabled.response.block).toEqual(promo);
    expect(result.logs).toHaveLength(2);
    expect(JSON.stringify(result.logs)).not.toContain('secret');
  } finally { await browser.close(); }
});
