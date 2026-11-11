// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { filterMusicCatalog } from './music-catalog.js';

const api = 'https://web.api.vk.ru/method/';
const promo = { id: 12909, title: 'Trial', click_action: { action: { type: 'open_url', url: 'https://vk.ru/vk_music#p=musbanner-trial' } } };
const ordinary = { id: 2, buttons: [{ action: { type: 'open_url', url: 'https://vk.ru/vk_music' } }] };
const fixture = () => ({
  catalog: { default_section: 'main', header: { blocks: [{ data_type: 'catalog_banners', catalog_banner_ids: [12909] }] },
    sections: [{ id: 'main', next_from: 'cursor', blocks: [{ data_type: 'music_recommended_playlists', playlists_ids: ['1_2'] }] }],
    buttons: [{ action: { type: 'upload_audio' } }] },
  catalog_banners: structuredClone([promo, ordinary]), audios: [{ id: 7, ads: { content_id: '7' } }],
  playlists: [{ id: 2 }], subscription: { active: false },
});
let payload: unknown;
const nativeFetch = window.fetch;
const enabled = (value: boolean) => window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: { block_music_ads: value } }));
beforeEach(async () => {
  vi.resetModules(); payload = { response: fixture() };
  window.fetch = vi.fn(async () => new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json', 'content-length': '999' } }));
  await import('./music-catalog-blocker.js');
});
afterEach(() => {
  window.dispatchEvent(new MessageEvent('message', { source: window, data: { type: 'VKIFY_DESTROY' } }));
  window.fetch = nativeFetch; Reflect.deleteProperty(window, 'cur'); vi.restoreAllMocks();
});

it('removes the real header reference and preserves music, controls and subscription data', () => {
  const data = fixture(); const original = structuredClone(data);
  expect(filterMusicCatalog(data)).toEqual([promo]);
  expect(data).toEqual({ ...original, catalog_banners: [ordinary], catalog: { ...original.catalog, header: { blocks: [] } } });
  expect(filterMusicCatalog(data)).toEqual([]);
});

it('retains ordinary banners in mixed blocks, including sections and paginated blocks', () => {
  const data = { ...fixture(), section: { blocks: [{ data_type: 'catalog_banners', catalog_banner_ids: ['12909', 2] }] }, block: { data_type: 'catalog_banners', catalog_banner_ids: [12909] } };
  filterMusicCatalog(data);
  expect(data.section.blocks[0].catalog_banner_ids).toEqual([2]);
  expect(data.block.catalog_banner_ids).toEqual([]);
  for (const value of [null, {}, { catalog_banners: [ordinary] }, { catalog_banners: [null, {}] }]) expect(filterMusicCatalog(value)).toEqual([]);
});

it('filters direct responses and restores fetch when disabled', async () => {
  const original = window.fetch; enabled(true);
  const response = await window.fetch(api + 'catalog.getAudio');
  expect((await response.json()).response.catalog.header.blocks).toEqual([]);
  expect(response.headers.has('content-length')).toBe(false);
  enabled(false); expect(window.fetch).toBe(original);
  expect((await (await window.fetch(api + 'catalog.getAudio')).json()).response.catalog_banners).toHaveLength(2);
});

it('matches batch response IDs regardless of order and leaves unrelated members intact', async () => {
  payload = { responses: [{ id: 'other', body: { response: fixture() } }, { id: 'music', body: { response: fixture() } }] };
  const body = JSON.stringify({ requests: [{ id: 'music', method: 'catalog.getAudio' }, { id: 'other', method: 'users.get' }] });
  enabled(true);
  for (const input of [api + 'batch.call', new Request(api + 'batch.call', { method: 'POST', body })]) {
    const result = await (await window.fetch(input, typeof input === 'string' ? { method: 'POST', body } : undefined)).json();
    expect(result.responses[0]).toEqual((payload as { responses: unknown[] }).responses[0]);
    expect(result.responses[1].body.response.catalog.header.blocks).toEqual([]);
  }
});

it('skips cloning unrelated batches and fails open on malformed responses', async () => {
  enabled(true);
  const clone = vi.spyOn(Response.prototype, 'clone');
  await window.fetch(api + 'batch.call', { method: 'POST', body: JSON.stringify({ requests: [{ id: 'a', method: 'users.get' }] }) });
  expect(clone).not.toHaveBeenCalled();
  payload = { error: { error_code: 5 } };
  expect(await (await window.fetch(api + 'catalog.getAudio')).json()).toEqual(payload);
});

it('filters initial and replaced SPA caches once and respects disabling', () => {
  const first = { method: 'catalog.getAudio', response: fixture() };
  Reflect.set(window, 'cur', { apiPrefetchCache: [first] });
  enabled(true); expect(first.response.catalog.header.blocks).toEqual([]);
  const later = { method: 'catalog.getSection', response: fixture() };
  Reflect.set(window, 'cur', { apiPrefetchCache: [later] });
  expect(later.response.catalog_banners).toEqual([ordinary]);
  enabled(false);
  const disabled = { method: 'catalog.getAudio', response: fixture() };
  Reflect.set(window, 'cur', { apiPrefetchCache: [disabled] });
  expect(disabled.response.catalog_banners).toHaveLength(2);
});
