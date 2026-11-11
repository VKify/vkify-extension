// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { filterGamesPromos, filterRecentGroups } from './catalog-visibility.js';
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
