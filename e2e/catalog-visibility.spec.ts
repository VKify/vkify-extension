import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('catalog API filters preserve subscriptions and games, and welcome UI loads only on first run', async () => {
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true, executablePath: process.env.PW_CHROME_PATH,
    args: ['--disable-features=DisableLoadExtensionCommandLineSwitch', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('schema_version')).schema_version)).toBeTruthy();
    await worker.evaluate(() => chrome.storage.local.set({ onboarding_done: true, first_run: true, hide_recent_groups: true, block_recommendations_games: true }));
    const page = await context.newPage();
    const groups = { catalog: { default_section: 'main', sections: [{ id: 'main', blocks: [
      { id: 'recent-header', layout: { name: 'header_large' }, actions: [{ action: { type: 'clear_recent_groups' }, target_block_ids: ['recent-header', 'recent-slider', 'recent-separator'] }] },
      { id: 'recent-slider', data_type: 'groups_items', url: 'https://vk.ru/groups/recent_my', group_items: [{ id: 1 }] },
      { id: 'recent-separator', layout: { name: 'separator' } }, { id: 'subscriptions', data_type: 'groups_items', group_items: [{ id: 2 }] },
    ] }] }, groups: [{ id: 1 }, { id: 2 }] };
    const games = { next_from: 'next', items: [{ id: 'installed', payload: { type: 'games_horizontal_list', items: [1] } }, { id: 'promo', payload: { type: 'app_promo_banner' } }, { id: 'social', payload: { type: 'games_horizontal_list' }, section_info: { type_section: 'section', section_id: 'social_recommend' } }] };
    const response = { responses: [{ id: 'g', body: { response: groups } }, { id: 'a', body: { response: games } }] };
    await page.route('https://web.api.vk.ru/method/**', route => route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, json: response }));
    await page.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<main id="catalog"></main><script>window.cur={apiPrefetchCache:[{method:'catalog.getGroups',response:${JSON.stringify(groups)}},{method:'apps.getWebGamesCatalog',response:${JSON.stringify(games)}}]}</script>` }));
    await page.goto('https://vk.ru/groups');
    await expect(page.locator('#vkify-welcome')).toBeVisible();
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('first_run')).first_run)).toBe(false);
    await expect.poll(() => page.evaluate(() => (window as any).cur.apiPrefetchCache[0].response.catalog.sections[0].blocks.map((b: any) => b.id))).toEqual(['subscriptions']);
    expect(await page.evaluate(() => (window as any).cur.apiPrefetchCache[1].response.items.map((i: any) => i.id))).toEqual(['installed']);
    const request = () => page.evaluate(async () => (await (await fetch('https://web.api.vk.ru/method/batch.call', { method: 'POST', body: JSON.stringify({ requests: [{ id: 'a', method: 'apps.getWebGamesCatalog' }, { id: 'g', method: 'catalog.getGroups' }] }) })).json()));
    const filtered = await request();
    expect(filtered.responses[0].body.response.catalog.sections[0].blocks.map((b: any) => b.id)).toEqual(['subscriptions']);
    expect(filtered.responses[0].body.response.groups).toEqual(groups.groups);
    expect(filtered.responses[1].body.response.items.map((i: any) => i.id)).toEqual(['installed']);
    await page.reload();
    await expect.poll(() => page.evaluate(() => (window as any).cur.apiPrefetchCache[1].response.items.length)).toBe(1);
    await expect(page.locator('#vkify-welcome')).toHaveCount(0);
    await worker.evaluate(() => chrome.storage.local.set({ hide_recent_groups: false, block_recommendations_games: false }));
    await expect.poll(async () => (await request()).responses[0].body.response.catalog.sections[0].blocks.length).toBe(4);
    expect((await request()).responses[1].body.response).toEqual(games);
  } finally { await context.close(); }
});
