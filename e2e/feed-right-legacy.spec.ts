import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

for (const build of ['chrome', 'firefox']) for (const enabled of [true, false])
  test(`${build}: legacy right promotion is filtered before fetch/XHR consumers (${enabled})`, async ({ page }) => {
    const blocker = await readFile(`dist/${build}/injected/feed-ad-blocker.js`, 'utf8');
    const organic = '<section id="continue-apps">Continue playing</section>';
    const promo = '<div class="apps_feedRightAppsBlock_single_app--promo" data-testid="feed_apps_right_block"><a data-block-type="featured_promo_game"></a><a class="apps_feedRightAppsBlock__name">Game promotion</a></div>';
    const payload = { payload: [0, [organic + promo, 'window.legacyReady=true;']] };
    await page.route('https://vk.ru/feed', route => route.fulfill({ contentType: 'text/html', body: '<main><aside id="right"></aside></main>' }));
    await page.route('https://vk.ru/al_feed_right_block.php*', route => route.fulfill({ contentType: 'application/json', json: payload }));
    await page.route('https://vk.ru/al_feed.php*', route => route.fulfill({ contentType: 'application/json', json: payload }));
    await page.goto('https://vk.ru/feed');
    await page.addScriptTag({ content: blocker });
    const result = await page.evaluate(async enabled => {
      const logs: unknown[] = [];
      window.addEventListener('vkify:blocked', e => logs.push((e as CustomEvent).detail));
      window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: { block_recommendations_feed: enabled } }));
      const fetched = await (await fetch('/al_feed_right_block.php', { method: 'POST', body: 'act=default&response_type=simple' })).json();
      const unrelated = await (await fetch('/al_feed.php', { method: 'POST' })).json();
      const xhr = new XMLHttpRequest();
      const request = () => new Promise<any>((resolve, reject) => {
        xhr.open('POST', '/al_feed_right_block.php');
        xhr.onload = () => {
          const first = xhr.responseText, second = xhr.responseText, third = xhr.response;
          resolve({ data: JSON.parse(first), consistent: first === second && second === third });
        };
        xhr.onerror = reject; xhr.send('act=default&response_type=simple');
      });
      const first = await request(), second = await request();
      document.getElementById('right')!.innerHTML = second.data.payload[1][0];
      return { fetched, unrelated, first, second, logs };
    }, enabled);
    const expected = enabled ? { payload: [0, [organic, 'window.legacyReady=true;']] } : payload;
    expect(result.fetched).toEqual(expected);
    expect(result.unrelated).toEqual(payload);
    for (const request of [result.first, result.second]) {
      expect(request.data).toEqual(expected); expect(request.consistent).toBe(true);
    }
    await expect(page.locator('#continue-apps')).toBeVisible();
    await expect(page.getByTestId('feed_apps_right_block')).toHaveCount(enabled ? 0 : 1);
    expect(result.logs).toHaveLength(enabled ? 3 : 0);
    await expect(page.locator('style')).toHaveCount(0);
  });
