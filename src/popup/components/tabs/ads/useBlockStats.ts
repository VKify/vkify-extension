import { useState, useCallback } from 'react';
import { useStorageReload } from '@/popup/hooks/core/useStorageReload.js';
import { getStorage, setStorage } from '@/popup/utils/storageClient.js';
import type { StatsLogEntry } from '@/types/index.js';

// ── Block stats (local state) ──────────────────────────────────────────────
// Счётчики и лог живут вне SettingsContext: контент-скрипт переписывает их
// каждые ~1.5 с во время скролла ленты, и хранение их в общем React-state
// перерисовывало бы весь попап на каждый flush.

const STATS_KEYS = ['stats_trackers_blocked', 'stats_ads_blocked', 'stats_block_log'] as const;

export interface BlockStats {
  trackersBlocked: number;
  adsBlocked: number;
  blockLog: StatsLogEntry[];
}

export function useBlockStats(): BlockStats & { reset: () => Promise<void> } {
  const [stats, setStats] = useState<BlockStats>({ trackersBlocked: 0, adsBlocked: 0, blockLog: [] });

  const reload = useCallback(async (): Promise<void> => {
    try {
      const r = await getStorage([...STATS_KEYS]);
      setStats({
        trackersBlocked: (r['stats_trackers_blocked'] as number) ?? 0,
        adsBlocked:      (r['stats_ads_blocked']      as number) ?? 0,
        blockLog:        (r['stats_block_log'] as StatsLogEntry[]) ?? [],
      });
    } catch { /* ignore */ }
  }, []);

  useStorageReload(STATS_KEYS, reload);

  const reset = useCallback(async (): Promise<void> => {
    await setStorage({ stats_trackers_blocked: 0, stats_ads_blocked: 0, stats_block_log: [] });
  }, []);

  return { ...stats, reset };
}
