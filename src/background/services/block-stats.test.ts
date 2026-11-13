import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { BlockStatsService } from './block-stats.js';
import type { StatsLogEntry } from '@/types/index.js';
let stored: Record<string, unknown>;
const entry = (section = 'block_left_ads', time = 1): StatsLogEntry => ({ kind: 'ad', domain: 'VK API', method: 'api', section, time });
beforeEach(() => {
  stored = {};
  vi.stubGlobal('chrome', { storage: { local: {
    get: vi.fn(async () => structuredClone(stored)),
    set: vi.fn(async (values) => { stored = { ...stored, ...structuredClone(values) }; }),
  } } });
});
afterEach(() => vi.unstubAllGlobals());
it('serializes simultaneous tabs, retaining existing counters and newest-first history', async () => {
  stored = { stats_ads_blocked: 8, stats_trackers_blocked: 2, stats_ads_by_section: { block_left_ads: 8 } };
  const service = new BlockStatsService();
  await Promise.all(Array.from({ length: 30 }, (_, i) => service.record([entry(i % 2 ? 'block_left_ads' : 'block_music_ads', i + 1)])));
  expect(stored.stats_ads_blocked).toBe(38);
  expect(stored.stats_trackers_blocked).toBe(2);
  expect(stored.stats_ads_by_section).toEqual({ block_left_ads: 23, block_music_ads: 15 });
  expect((stored.stats_block_log as StatsLogEntry[]).map(e => e.time)).toEqual(Array.from({ length: 30 }, (_, i) => 30 - i));
});
it('orders reset after pending writes and does not resurrect old counters', async () => {
  const service = new BlockStatsService();
  await Promise.all([service.record([entry()]), service.record([entry()]), service.reset(), service.record([entry('block_music_ads')])]);
  expect(stored).toEqual({ stats_ads_blocked: 1, stats_trackers_blocked: 0, stats_ads_by_section: { block_music_ads: 1 }, stats_block_log: [entry('block_music_ads')] });
});
it('bounds history without losing totals, including after service-worker restart', async () => {
  await new BlockStatsService().record(Array.from({ length: 150 }, (_, i) => entry('block_recommendations_games', i)));
  await new BlockStatsService().record([{ ...entry(), kind: 'tracker', section: 'block_trackers' }]);
  expect(stored.stats_ads_blocked).toBe(150);
  expect(stored.stats_trackers_blocked).toBe(1);
  expect(stored.stats_block_log).toHaveLength(100);
});
it('rejects malformed events and resumes after storage failure', async () => {
  const service = new BlockStatsService();
  await expect(service.record([{ ...entry(), section: '__proto__' }])).rejects.toThrow();
  vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('temporary'));
  await expect(service.record([entry()])).rejects.toThrow('temporary');
  await service.record([entry()]);
  expect(stored.stats_ads_blocked).toBe(1);
});
