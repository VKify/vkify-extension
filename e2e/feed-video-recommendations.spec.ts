import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

for (const build of ['chrome', 'firefox']) for (const enabled of [true, false])
  test(`${build}: VK Video recommendations respect the feed switch before rendering (${enabled})`, async ({ page }) => {
    const blocker = await readFile(`dist/${build}/injected/feed-ad-blocker.js`, 'utf8');
    const payload = { response: { items: [
      { type: 'post', post_id: 1, text: 'Обычный пост с видео', attachments: [{ type: 'video', video: { id: 42 } }] },
      // Real initial server response: this is an async placeholder, with no title or videos.
      { type: 'videos_for_you', can_ignore: true, date: 0, is_async: true, keep_offline: false, source_id: 0, track_code: 'secret' },
    ], next_from: 'next' } };
    let asyncBlockRequests = 0;
    const settings = JSON.stringify({ block_feed_ads_api: false, block_recommendations_feed: enabled });
    await page.route('https://web.api.vk.ru/method/newsfeed.getFeed*', route => route.fulfill({
      contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, json: payload,
    }));
    await page.route('https://web.api.vk.ru/method/newsfeed.getByType*', route => {
      asyncBlockRequests++;
      return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, json: { response: {} } });
    });
    await page.route('https://web.api.vk.ru/method/batch.call*', route => route.fulfill({
      contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      json: { responses: [{ id: 'async-feed', body: payload }] },
    }));
    await page.route('https://vk.ru/feed', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body:
      `<main></main><script>window.logs=[];window.addEventListener('vkify:blocked',e=>logs.push(e.detail));window.cur={apiPrefetchCache:[{method:'newsfeed.getFeed',request:{filters:'post,videos_for_you_block'},...${JSON.stringify(payload)}}]};</script>` +
      `<script data-vkify-initial-settings='${settings}'>${blocker}</script>` +
      `<script>window.hydration=Promise.all(cur.apiPrefetchCache[0].response.items.map(async item=>{const node=document.createElement('section');if(item.type==='videos_for_you'){await fetch('https://web.api.vk.ru/method/newsfeed.getByType');node.textContent='Рекомендуем в VK Видео';}else node.textContent=item.text;document.querySelector('main').append(node);}));</script>`,
    }));
    await page.goto('https://vk.ru/feed');
    await page.evaluate(() => (window as any).hydration);
    await expect(page.getByText('Обычный пост с видео', { exact: true })).toBeVisible();
    await expect(page.getByText('Рекомендуем в VK Видео', { exact: true })).toHaveCount(enabled ? 0 : 1);
    const result = await page.evaluate(async () => ({
      data: (await (await fetch('https://web.api.vk.ru/method/batch.call', { method: 'POST',
        body: JSON.stringify({ requests: [{ id: 'async-feed', method: 'newsfeed.getByType' }] }),
      })).json()).responses[0].body,
      logs: (window as any).logs,
    }));
    expect(result.data.response.items).toEqual(enabled ? [payload.response.items[0]] : payload.response.items);
    expect(asyncBlockRequests).toBe(enabled ? 0 : 1);
    expect(result.data.response.next_from).toBe('next');
    expect(result.logs).toHaveLength(enabled ? 2 : 0);
    for (const log of result.logs) expect(log).toMatchObject({ section: 'block_recommendations_feed', trigger: 'videos_for_you' });
    await expect(page.locator('style')).toHaveCount(0);
  });
