// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { filterGamesPromos, filterRecentGroups, filterMarketRecommendations } from './catalog-visibility.js';
const games = () => ({ next_from: 'cursor', items: [
  { id: 'owned', payload: { type: 'games_horizontal_list', items: [1] } },
  { id: 'banner', payload: { type: 'app_promo_banner' } },
  { id: 'social', payload: { type: 'games_horizontal_list' }, section_info: { type_section: 'section', section_id: 'social_recommend' } },
  { id: 'new', payload: { type: 'games_horizontal_list' }, section_info: { type_section: 'section', section_id: 'new' } },
], apps: [{ id: 1 }] });
const groups = () => ({ catalog: { default_section: 'main', sections: [{ id: 'main', next_from: 'cursor', blocks: [
  { id: 'header', data_type: 'none', layout: { name: 'header_large' }, actions: [{ action: { type: 'clear_recent_groups' }, target_block_ids: ['header', 'slider', 'separator'] }] },
  { id: 'slider', data_type: 'groups_items', url: 'https://vk.ru/groups/recent_my', group_items: [{ id: 1 }] },
  { id: 'separator', layout: { name: 'separator' } }, { id: 'subscriptions', group_items: [{ id: 2 }] },
] }] }, groups: [{ id: 1 }, { id: 2 }] });
const originalFetch = window.fetch;
let payload: unknown;
const set = (values: Record<string, boolean>) => window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: values }));
beforeEach(async () => {
  vi.resetModules(); payload = { response: games() };
  window.fetch = vi.fn(async () => new Response(JSON.stringify(payload)));
  await import('./catalog-visibility-filter.js');
});
afterEach(() => {
  window.dispatchEvent(new MessageEvent('message', { source: window, data: { type: 'VKIFY_DESTROY' } }));
  window.fetch = originalFetch; Reflect.deleteProperty(window, 'cur');
});
it('removes only identified game sections, preserving entities, installed games and pagination', () => {
  const data = games(); filterGamesPromos(data);
  expect(data.items.map(i => i.id)).toEqual(['owned', 'new']); expect(data.apps).toEqual([{ id: 1 }]); expect(data.next_from).toBe('cursor');
  expect(filterGamesPromos(data)).toBe(false);
});
it('removes the complete recent group island using the server clear action targets', () => {
  const data = groups(); filterRecentGroups(data);
  expect(data.catalog.sections[0].blocks.map(b => b.id)).toEqual(['subscriptions']);
  expect(data.catalog.sections[0].next_from).toBe('cursor'); expect(data.groups).toHaveLength(2);
  expect(filterRecentGroups(data)).toBe(false);
  for (const bad of [null, {}, { catalog: { sections: [null] } }]) expect(filterRecentGroups(bad)).toBe(false);
});
it('keeps the flags independent in initial and replaced prefetch caches', () => {
  const entries = [{ method: 'apps.getWebGamesCatalog', response: games() }, { method: 'catalog.getGroups', response: groups() }];
  Reflect.set(window, 'cur', { apiPrefetchCache: entries }); set({ block_recommendations_games: true });
  expect(entries[0].response).toMatchObject({ items: [{ id: 'owned' }, { id: 'new' }] });
  expect(entries[1].response).toEqual(groups());
  set({ hide_recent_groups: true });
  Reflect.set(window, 'cur', { apiPrefetchCache: entries });
  expect(entries[1].response).toMatchObject({ catalog: { sections: [{ blocks: [{ id: 'subscriptions' }] }] } });
});
it('filters batch members by request ID and restores native fetch on disabling', async () => {
  const fetch = window.fetch;
  payload = { responses: [{ id: 'groups', body: { response: groups() } }, { id: 'games', body: { response: games() } }, { id: 'other', body: { response: games() } }] };
  set({ block_recommendations_games: true, hide_recent_groups: true });
  const body = JSON.stringify({ requests: [{ id: 'games', method: 'apps.getWebGamesCatalog' }, { id: 'groups', method: 'catalog.getGroups' }, { id: 'other', method: 'users.get' }] });
  const result = await (await window.fetch(new Request('https://web.api.vk.ru/method/batch.call', { method: 'POST', body }))).json();
  expect(result.responses[0].body.response.catalog.sections[0].blocks).toHaveLength(1);
  expect(result.responses[1].body.response.items).toHaveLength(2);
  expect(result.responses[2].body.response).toEqual(games());
  set({ block_recommendations_games: false, hide_recent_groups: false }); expect(window.fetch).toBe(fetch);
});

const market = () => ({ catalog: { default_section: 'main', sections: [{ id: 'main', next_from: 'cursor', blocks: [
  { id: 'recent', layout: { name: 'header' }, title: 'Недавно смотрели' },
  { id: 'recent-products', layout: { name: 'slider' }, market_item_ids: ['1'] },
  { id: 'gap-1', layout: { name: 'separator' } },
  { id: 'reco-header', layout: { name: 'header' }, title: 'Может заинтересовать' },
  { id: 'reco-products', layout: { name: 'slider' }, market_item_ids: ['2'] },
  { id: 'gap-2', layout: { name: 'separator' } },
  { id: 'search', layout: { name: 'header' }, title: 'Результаты поиска' },
  { id: 'search-products', layout: { name: 'list' }, market_item_ids: ['3'] },
] }] }, market_items: [{ id: '1' }, { id: '2' }, { id: '3' }] });
it('removes a complete market recommendation card and its separator while preserving products and pagination', () => {
  const data = market(); expect(filterMarketRecommendations(data)).toBe(true);
  expect(data.catalog.sections[0].blocks.map(b => b.id)).toEqual(['recent', 'recent-products', 'gap-1', 'search', 'search-products']);
  expect(data.market_items).toHaveLength(3); expect(data.catalog.sections[0].next_from).toBe('cursor');
  expect(filterMarketRecommendations(data)).toBe(false);
  for (const value of [null, {}, { catalog: { sections: [null] } }]) expect(filterMarketRecommendations(value)).toBe(false);
});
it('filters the market catalog independently and restores responses when disabled', async () => {
  payload = { response: market() }; set({ block_recommendations_market: true });
  const response = await (await window.fetch('https://web.api.vk.ru/method/catalog.getClassifieds')).json();
  expect(response.response.catalog.sections[0].blocks).toHaveLength(5);
  expect(await (await window.fetch('https://web.api.vk.ru/method/catalog.getGroups')).json()).toEqual(payload);
  set({ block_recommendations_market: false });
  expect(await (await window.fetch('https://web.api.vk.ru/method/catalog.getClassifieds')).json()).toEqual(payload);
});
it('limits paginated section filtering to explicit market context in request bodies and batches', async () => {
  const section = market().catalog.sections[0]; payload = { response: { section } }; set({ block_recommendations_market: true });
  const url = 'https://web.api.vk.ru/method/catalog.getSection';
  const request = new Request(url, { method: 'POST', body: 'catalog_context=market&section_id=main' });
  expect((await (await window.fetch(request)).json()).response.section.blocks).toHaveLength(5);
  expect(await (await window.fetch(url, { method: 'POST', body: 'catalog_context=music' })).json()).toEqual(payload);
  payload = { responses: [{ id: 1, body: { response: { section } } }, { id: 2, body: { response: { section } } }] };
  const body = JSON.stringify({ requests: [{ id: 1, method: 'catalog.getSection', params: { catalog_context: 'market' } }, { id: 2, method: 'catalog.getSection', params: { catalog_context: 'music' } }] });
  const result = await (await window.fetch('https://web.api.vk.ru/method/batch.call', { method: 'POST', body })).json();
  expect(result.responses[0].body.response.section.blocks).toHaveLength(5);
  expect(result.responses[1].body.response.section.blocks).toHaveLength(8);
});
