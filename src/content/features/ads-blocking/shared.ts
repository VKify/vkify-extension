/**
 * Shared context for all ads-blocking sub-modules.
 *
 * - Stats (trackers + ads counters, persistent via chrome.storage.local)
 * - vkify:blocked event listener with reference-counting (added on first
 *   consumer, removed when the last one releases its interest)
 * - Custom block/allow word bags (updated live on storage changes)
 */

import type { StatsLogEntry } from '../../../types/index.js';

const STATS_KEYS = ['stats_trackers_blocked', 'stats_ads_blocked', 'stats_block_log'] as const;
const LOG_MAX = 100;

export interface SharedContext {
  /** Load persisted stats from chrome.storage (idempotent, race-safe). */
  loadStats(): Promise<void>;

  /** Record a single blocked item and schedule a stats flush. */
  recordBlock(kind: 'tracker' | 'ad', domain: string, detail?: string, method?: 'dom' | 'api', trigger?: string, payload?: string): void;

  /**
   * Register interest in the `vkify:blocked` window event.
   * The listener is added on the very first call.
   */
  addListenerUser(): void;

  /**
   * Release interest in the `vkify:blocked` window event.
   * The listener is removed when the reference count reaches zero.
   */
  releaseListenerUser(): void;

  /**
   * Mutable bag of custom filter words, updated in-place by `onStorageChange`.
   * Sub-modules should read (not copy) these arrays so they always see fresh values.
   */
  customWords: { block: string[]; allow: string[] };

  /**
   * Forward `chrome.storage.onChanged` events here to keep custom words
   * and in-memory stats counters in sync with the popup.
   */
  onStorageChange(changes: Record<string, chrome.storage.StorageChange>, area: string): void;
}

export function createSharedContext(): SharedContext {
  // ── Stats ─────────────────────────────────────────────────────────────────
  let statsTrackers = 0;
  let statsAds      = 0;
  let statsLog: StatsLogEntry[] = [];
  let statsFlushTimer: ReturnType<typeof setTimeout> | null = null;
  let statsLoaded   = false;

  async function loadStats(): Promise<void> {
    if (statsLoaded) return;
    statsLoaded = true; // set before await to prevent parallel calls
    try {
      const data = await chrome.storage.local.get([...STATS_KEYS]);
      // += instead of = : events that fired before storage resolved are not lost
      statsTrackers += (data['stats_trackers_blocked'] as number) || 0;
      statsAds      += (data['stats_ads_blocked']      as number) || 0;
      const stored   = (data['stats_block_log']  as StatsLogEntry[]) || [];
      // in-memory entries are newer — they come first
      statsLog = [...statsLog, ...stored].slice(0, LOG_MAX);
    } catch {
      statsLoaded = false; // allow retry on next call
    }
  }

  function scheduleStatsFlush(): void {
    if (statsFlushTimer) return;
    statsFlushTimer = setTimeout(() => {
      statsFlushTimer = null;
      void chrome.storage.local.set({
        stats_trackers_blocked: statsTrackers,
        stats_ads_blocked:      statsAds,
        stats_block_log:        statsLog,
      }).catch(() => {});
    }, 1500);
  }

  function recordBlock(
    kind:     'tracker' | 'ad',
    domain:   string,
    detail?:  string,
    method?:  'dom' | 'api',
    trigger?: string,
    payload?: string,
  ): void {
    if (kind === 'tracker') statsTrackers++;
    else                    statsAds++;

    statsLog.unshift({ kind, domain, time: Date.now(), detail, method, trigger, payload });
    if (statsLog.length > LOG_MAX) statsLog.length = LOG_MAX;
    scheduleStatsFlush();
  }

  // ── vkify:blocked event listener (reference-counted) ─────────────────────
  let listenerUserCount = 0;

  function handleBlocked(e: Event): void {
    const ev = (e as CustomEvent<{
      kind:     string;
      domain:   string;
      url?:     string;
      detail?:  string;
      method?:  'dom' | 'api';
      payload?: string;
    }>).detail ?? {};

    if (ev.kind === 'tracker' && ev.domain) {
      recordBlock('tracker', ev.domain, ev.url ?? ev.domain);
    } else if (ev.kind === 'ad' && ev.domain) {
      // trigger = ad type string, e.g. "ads_easy_promote · id-123456"
      recordBlock('ad', ev.domain, ev.detail, ev.method ?? 'api', ev.detail, ev.payload);
    }
  }

  function addListenerUser(): void {
    if (listenerUserCount === 0) {
      window.addEventListener('vkify:blocked', handleBlocked);
    }
    listenerUserCount++;
  }

  function releaseListenerUser(): void {
    if (listenerUserCount <= 0) return;
    listenerUserCount--;
    if (listenerUserCount === 0) {
      window.removeEventListener('vkify:blocked', handleBlocked);
    }
  }

  // ── Custom words ──────────────────────────────────────────────────────────
  const customWords = { block: [] as string[], allow: [] as string[] };

  // ── Storage sync ──────────────────────────────────────────────────────────
  function onStorageChange(
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ): void {
    if (area !== 'local') return;

    if (changes['custom_block_words']) {
      customWords.block = (changes['custom_block_words'].newValue as string[]) || [];
    }
    if (changes['custom_allow_words']) {
      customWords.allow = (changes['custom_allow_words'].newValue as string[]) || [];
    }

    // Sync in-memory counters when the popup resets stats,
    // otherwise the next flush would overwrite the reset with stale values.
    if (changes['stats_trackers_blocked']?.newValue === 0) statsTrackers = 0;
    if (changes['stats_ads_blocked']?.newValue === 0)      statsAds = 0;
    if (
      changes['stats_block_log'] &&
      Array.isArray(changes['stats_block_log'].newValue) &&
      changes['stats_block_log'].newValue.length === 0
    ) {
      statsLog = [];
    }
  }

  return {
    loadStats,
    recordBlock,
    addListenerUser,
    releaseListenerUser,
    customWords,
    onStorageChange,
  };
}
