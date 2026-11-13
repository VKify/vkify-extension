import { BLOCK_STATS_KEYS, BLOCK_STATS_SECTIONS, isBlockStatsEntry } from '@/shared/block-stats.js';
import type { StatsLogEntry } from '@/types/index.js';

const count = (value: unknown): number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0;

/** The service worker is the sole writer: tabs never overwrite each other's totals. */
export class BlockStatsService {
  private queue: Promise<void> = Promise.resolve();

  record(entries: unknown): Promise<void> {
    if (!Array.isArray(entries) || entries.length > 300 || !entries.every(isBlockStatsEntry))
      return Promise.reject(new Error('Invalid block statistics'));
    return this.enqueue(async () => {
      const stored = await chrome.storage.local.get([...BLOCK_STATS_KEYS]);
      let ads = count(stored.stats_ads_blocked);
      let trackers = count(stored.stats_trackers_blocked);
      const sections: Record<string, number> = {};
      if (stored.stats_ads_by_section && typeof stored.stats_ads_by_section === 'object')
        for (const [key, value] of Object.entries(stored.stats_ads_by_section)) if ((BLOCK_STATS_SECTIONS as readonly string[]).includes(key) && count(value)) sections[key] = count(value);
      for (const entry of entries as StatsLogEntry[]) {
        if (entry.kind === 'tracker') trackers++;
        else {
          ads++;
          if (entry.section) sections[entry.section] = (sections[entry.section] ?? 0) + 1;
        }
      }
      const log = Array.isArray(stored.stats_block_log) ? stored.stats_block_log.filter(isBlockStatsEntry) : [];
      await chrome.storage.local.set({ stats_ads_blocked: ads, stats_trackers_blocked: trackers,
        stats_ads_by_section: sections, stats_block_log: [...entries.slice().reverse(), ...log].sort((a, b) => b.time - a.time).slice(0, 100) });
    });
  }

  reset(): Promise<void> {
    return this.enqueue(() => chrome.storage.local.set({ stats_ads_blocked: 0, stats_trackers_blocked: 0,
      stats_ads_by_section: {}, stats_block_log: [] }));
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }
}
