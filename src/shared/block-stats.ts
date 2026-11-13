import type { StatsLogEntry } from '@/types/index.js';
import { ADS_CONTENT_SETTINGS } from './constants/ads-content.js';

export const BLOCK_STATS_SECTIONS = ['block_left_ads', 'block_feed_ads_api', 'block_feed_ads_dom', 'block_trackers', ...ADS_CONTENT_SETTINGS] as const;
export const BLOCK_STATS_KEYS = ['stats_trackers_blocked', 'stats_ads_blocked', 'stats_ads_by_section', 'stats_block_log'] as const;

export function isBlockStatsEntry(value: unknown): value is StatsLogEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as StatsLogEntry;
  return (entry.kind === 'ad' || entry.kind === 'tracker') && Number.isFinite(entry.time)
    && typeof entry.domain === 'string' && entry.domain.length > 0 && entry.domain.length <= 160
    && (entry.method === undefined || ['api', 'dom', 'network'].includes(entry.method))
    && (entry.section === undefined || (BLOCK_STATS_SECTIONS as readonly string[]).includes(entry.section))
    && (['detail', 'trigger', 'payload'] as const).every(key => entry[key] === undefined
      || typeof entry[key] === 'string' && entry[key]!.length <= (key === 'payload' ? 4096 : 500));
}
