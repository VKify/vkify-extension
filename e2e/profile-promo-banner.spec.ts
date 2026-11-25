import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

for (const browser of ['chrome', 'firefox']) for (const enabled of [true, false]) {
  test(`${browser}: profile giveaway is filtered before rendering and network dispatch (${enabled})`, async ({ page }) => {
    const blocker = await readFile(`dist/${browser}/injected/feed-ad-blocker.js`, 'utf8');
    let promoRequests = 0, normalRequests = 0;
    await page.route('https://web.api.vk.ru/method/owners.getBanner*', route => {
      if (new URL(route.request().url()).searchParams.get('banner_type') === '26') promoRequests++;
      else normalRequests++;
      return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, json: { response: { banner: { title: 'Network banner' } } } });
    });
    await page.route('https://vk.ru/binaryghost', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `
      <main></main><script>window.logs=[];addEventListener('vkify:blocked',e=>logs.push(e.detail));
      window.cur={apiPrefetchCache:[
        {method:'owners.getBanner',request:{banner_type:26},response:{banner:{title:'Розыгрыш призов'}}},
        {method:'owners.getBanner',request:{banner_type:25},response:{banner:{title:'Regular owner banner'}}}
      ]};</script>
      <script data-vkify-initial-settings='${JSON.stringify({ block_recommendations_profile: enabled })}'>${blocker}</script>
      <script>for(const entry of cur.apiPrefetchCache){if(entry.response.banner){const node=document.createElement('section');node.textContent=entry.response.banner.title;document.querySelector('main').append(node);}}</script>
    ` }));
    await page.goto('https://vk.ru/binaryghost');
    await expect(page.getByText('Розыгрыш призов', { exact: true })).toHaveCount(enabled ? 0 : 1);
    await expect(page.getByText('Regular owner banner')).toBeVisible();
    const data = await page.evaluate(async () => {
      const url = 'https://web.api.vk.ru/method/owners.getBanner?banner_type=';
      return [await (await fetch(url+'26')).json(), await (await fetch(url+'25')).json()];
    });
    expect(data[0]).toEqual(enabled ? { response: {} } : { response: { banner: { title: 'Network banner' } } });
    expect(data[1].response.banner.title).toBe('Network banner');
    expect(promoRequests).toBe(enabled ? 0 : 1); expect(normalRequests).toBe(1);
    if (enabled) {
      expect(await page.evaluate(() => (window as any).logs)).toEqual([
        expect.objectContaining({ section: 'block_recommendations_profile' }),
        expect.objectContaining({ section: 'block_recommendations_profile' }),
      ]);
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: { block_recommendations_profile: false } })));
      await page.evaluate(() => fetch('https://web.api.vk.ru/method/owners.getBanner?banner_type=26'));
      expect(promoRequests).toBe(1);
    }
    await expect(page.locator('style')).toHaveCount(0);
  });
}
