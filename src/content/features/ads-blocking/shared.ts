import { normalizeFeedWords } from '@/shared/utils/feed-keywords.js';
import { isBlockStatsEntry } from '@/shared/block-stats.js';

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

  return {
    recordBlock, customWords,
    start() {
      if (listening) return;
      listening = true;
      window.addEventListener('vkify:blocked', handleBlocked);
    },
    stop() { listening = false; window.removeEventListener('vkify:blocked', handleBlocked); },
    onStorageChange(changes, area) {
      if (area !== 'local') return;
      if (changes.custom_block_words) customWords.block = normalizeFeedWords(changes.custom_block_words.newValue);
      if (changes.custom_allow_words) customWords.allow = normalizeFeedWords(changes.custom_allow_words.newValue);
    },
  };
}

let context: SharedContext | undefined;
/** Subscribe before any document_start interceptor can emit its first result. */
export function getAdsBlockingContext(): SharedContext {
  context ??= createSharedContext();
  context.start();
  return context;
}
