// @vitest-environment happy-dom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createSharedContext } from '../features/ads-blocking/shared.js';
import { BlockStatsService } from '@/background/services/block-stats.js';
import type { StatsLogEntry } from '@/types/index.js';

let payload: unknown;
let stored: Record<string, unknown>;
let pending: Promise<void>[];
let shared: ReturnType<typeof createSharedContext>;
const nativeFetch = window.fetch;
const update = (detail: Record<string, boolean>) => window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail }));
const request = async (method: string) => (await window.fetch('https://web.api.vk.ru/method/' + method)).json();
beforeEach(async () => {
  vi.resetModules(); stored = {}; pending = [];
  const service = new BlockStatsService();
  vi.stubGlobal('chrome', { runtime: { sendMessage: ({ entries }: { entries: StatsLogEntry[] }) => {
    const result = service.record(entries); pending.push(result); return result;
  } }, storage: { local: {
    get: async () => structuredClone(stored),
    set: async (values: Record<string, unknown>) => { stored = { ...stored, ...structuredClone(values) }; },
  } } });
  shared = createSharedContext(); shared.start();
  window.location.href = 'https://vk.ru/feed';
  window.fetch = vi.fn(async () => new Response(JSON.stringify(payload)));
  await import('./feed-ad-blocker.js');
  await import('./catalog-visibility-filter.js');
  await import('./community-catalog-blocker.js');
  await import('./music-catalog-blocker.js');
  await import('./tracker-blocker.js');
});
afterEach(() => {
  shared.stop();
  window.dispatchEvent(new MessageEvent('message', { source: window, data: { type: 'VKIFY_DESTROY' } }));
  window.fetch = nativeFetch; Reflect.deleteProperty(window, 'cur'); vi.unstubAllGlobals();
});
const fixtures: [string, string, unknown][] = [
  ['block_left_ads', 'account.getLeftAds', { ads_html: '<aside>Ad</aside>', ads_can_show: true }],
  ['block_recommendations_games', 'apps.getWebGamesCatalog', { items: [{ payload: { type: 'app_promo_banner' } }] }],
  ['block_recommendations_market', 'catalog.getClassifieds', { section: { blocks: [{ title: 'Может заинтересовать', layout: { name: 'header_large' } }] } }],
  ['block_music_ads', 'catalog.getAudio', { catalog_banners: [{ id: 12909, title: 'Trial', click_action: { action: { type: 'open_url', url: 'https://vk.ru/vk_music#p=musbanner-trial' } } }] }],
  ['block_recommendations_video', 'video.getUserInfo', { subscription: { is_available: true, is_active: false } }],
  ['block_recommendations_communities', 'groups.getById', { groups: [{ id: 1, has_suggestions: true, show_suggestions: 'always' }] }],
  ['block_yandex_browser_promo', 'account.getInfo', { conversations_bar: { name: 'yandex_promo' } }],
  ['block_recommendations_feed', 'newsfeed.getFeed', { items: [{ type: 'recommended_groups' }] }],
  ['block_feed_ads_api', 'newsfeed.getFeed', { items: [{ type: 'ads' }], ads: ['campaign'], feed_ids: ['ads_1'] }],
];
it.each(fixtures)('persists a real %s block under its own section with all other filters off', async (section, method, response) => {
  payload = { response: structuredClone(response) };
  update({ [section]: true });
  await request(method); await Promise.all(pending);
  expect(stored.stats_ads_blocked).toBe(1);
  expect(stored.stats_ads_by_section).toEqual({ [section]: 1 });
  expect(stored.stats_block_log).toEqual([expect.objectContaining({ section, method: 'api' })]);
});
it('records cached Premium and community filters once, without counting repeated settings reads', async () => {
  const entries = [
    { method: 'video.getSnackBarInfo', response: { can_show: true } },
    { method: 'groups.getById', response: { groups: [{ id: 1, has_suggestions: true }] } },
  ];
  Reflect.set(window, 'cur', { apiPrefetchCache: entries });
  update({ block_recommendations_video: true, block_recommendations_communities: true });
  update({ block_recommendations_video: true, block_recommendations_communities: true });
  await Promise.all(pending);
  expect(stored.stats_ads_blocked).toBe(2);
  expect(stored.stats_ads_by_section).toEqual({ block_recommendations_video: 1, block_recommendations_communities: 1 });
});
it('counts a blocked request rather than a visible ad and categorizes it as network', async () => {
  update({ block_recommendations_video: true });
  await request('video.getAds'); await Promise.all(pending);
  expect(stored.stats_ads_blocked).toBe(1);
  expect(stored.stats_block_log).toEqual([expect.objectContaining({ section: 'block_recommendations_video', method: 'network' })]);
});
it('does not count unmodified responses, configuration reads or disabled filters', async () => {
  payload = { response: { items: [{ type: 'post', id: 1 }], subscription: { is_available: false } } };
  update({ block_feed_ads_api: true, block_recommendations_video: true });
  await request('newsfeed.getFeed'); await request('video.getUserInfo');
  update({ block_feed_ads_api: false });
  payload = { response: { items: [{ type: 'ads' }] } };
  await request('newsfeed.getFeed'); await Promise.all(pending);
  expect(stored).toEqual({});
});
it('records removal of an ad collection without items and does not count its feed IDs twice', async () => {
  payload = { response: { items: [], ads: ['campaign'], feed_ids: ['ads_1'] } };
  update({ block_feed_ads_api: true });
  await request('newsfeed.getFeed'); await Promise.all(pending);
  expect(stored.stats_ads_blocked).toBe(1);
  expect(stored.stats_ads_by_section).toEqual({ block_feed_ads_api: 1 });
});
