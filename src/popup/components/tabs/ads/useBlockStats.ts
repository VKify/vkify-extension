import { BLOCK_STATS_KEYS } from '@/shared/block-stats.js';
import { sendMessage } from '@/shared/messaging.js';
import { useState, useCallback, useRef } from 'react';
import { useStorageReload } from '@/popup/hooks/core/useStorageReload.js';
import { getStorage } from '@/popup/utils/storageClient.js';
import type { StatsLogEntry } from '@/types/index.js';

// ── Block stats (local state) ──────────────────────────────────────────────
// Keep frequent background statistics updates outside the global settings state.

const STATS_KEYS = BLOCK_STATS_KEYS;

export interface BlockStats {
  trackersBlocked: number;
  adsBlocked: number;
  adsBySection: Record<string, number>;
  blockLog: StatsLogEntry[];
}

export function useBlockStats(): BlockStats & { reset: () => Promise<void> } {
  const [stats, setStats] = useState<BlockStats>({ trackersBlocked: 0, adsBlocked: 0, adsBySection: {}, blockLog: [] });

  const generation = useRef(0);
  const reload = useCallback(async (): Promise<void> => {
    const request = ++generation.current;
    try {
      const r = await getStorage([...STATS_KEYS]);
      if (request !== generation.current) return;
      setStats({
        trackersBlocked: (r['stats_trackers_blocked'] as number) ?? 0,
        adsBlocked:      (r['stats_ads_blocked']      as number) ?? 0,
        adsBySection:    (r['stats_ads_by_section'] as Record<string, number>) ?? {},
        blockLog:        (r['stats_block_log'] as StatsLogEntry[]) ?? [],
      });
    } catch { /* ignore */ }
  }, []);

  useStorageReload(STATS_KEYS, reload);

  const reset = useCallback(async (): Promise<void> => {
    const result = await sendMessage({ type: 'RESET_BLOCK_STATS' });
    if (!result?.success) throw new Error(result?.error ?? 'Statistics reset failed');
    await reload();
  }, [reload]);

  return { ...stats, reset };
}
