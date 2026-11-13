import { normalizeFeedWords } from '@/shared/utils/feed-keywords.js';
import { isBlockStatsEntry } from '@/shared/block-stats.js';
import { dispatchPageEvent } from '../../utils/page-event.js';

export interface SharedContext {
  recordBlock(kind: 'tracker' | 'ad', domain: string, detail?: string, method?: 'dom' | 'api' | 'network', trigger?: string, payload?: string, section?: string): void;
  start(): void;
  stop(): void;
  customWords: { block: string[]; allow: string[] };
  onStorageChange(changes: Record<string, chrome.storage.StorageChange>, area: string): void;
}

export function createSharedContext(): SharedContext {
  let listening = false;
  const customWords = { block: [] as string[], allow: [] as string[] };

  function recordBlock(kind: 'tracker' | 'ad', domain: string, detail?: string,
    method?: 'dom' | 'api' | 'network', trigger?: string, payload?: string, section?: string): void {
    const entry = { kind, domain, time: Date.now(), detail, method, trigger, payload, section };
    if (!isBlockStatsEntry(entry)) return;
    // Send immediately; delayed per-tab snapshots lost events on navigation and across tabs.
    void chrome.runtime.sendMessage({ type: 'RECORD_BLOCK_STATS', entries: [entry] }).catch(() => {});
  }

  function handleBlocked(event: Event): void {
    const value = (event as CustomEvent).detail;
    if (!isBlockStatsEntry({ ...value, time: Date.now() })) return;
    recordBlock(value.kind, value.domain,
      value.kind === 'tracker' ? String(value.url ?? value.domain).slice(0, 500) : value.detail,
      value.method ?? 'api', value.trigger ?? value.detail, value.payload,
      value.kind === 'tracker' ? 'block_trackers' : value.section);
  }

  const announceReady = () => dispatchPageEvent('vkify:stats:ready');

  return {
    recordBlock, customWords,
    start() {
      if (listening) return;
      listening = true;
      window.addEventListener('vkify:blocked', handleBlocked);
      window.addEventListener('vkify:stats:ping', announceReady);
      announceReady();
    },
    stop() {
      if (!listening) return;
      listening = false;
      window.removeEventListener('vkify:blocked', handleBlocked);
      window.removeEventListener('vkify:stats:ping', announceReady);
      dispatchPageEvent('vkify:stats:disconnected');
    },
    onStorageChange(changes, area) {
      if (area !== 'local') return;
      if (changes.custom_block_words) customWords.block = normalizeFeedWords(changes.custom_block_words.newValue);
      if (changes.custom_allow_words) customWords.allow = normalizeFeedWords(changes.custom_allow_words.newValue);
    },
  };
}

/** Subscribe before any document_start interceptor can emit its first result. */
export function getAdsBlockingContext(): SharedContext {
  // Native isolated relay and full content bundle share one collector per frame.
  const slot = '__vkifyAdsBlockingContext';
  const context = (Reflect.get(window, slot) as SharedContext | undefined) ?? createSharedContext();
  Reflect.set(window, slot, context);
  context.start();
  return context;
}
