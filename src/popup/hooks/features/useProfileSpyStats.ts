import { useState, useCallback } from 'react';
import { StorageKey } from '../../../shared/constants/storage-keys.js';
import { useStorageReload } from '../core/useStorageReload.js';
import type { SpyStats, UserProfileSnapshot, ProfileSpyLogEntry } from '../../../types/index.js';
import { sendMessage } from '../../../shared/messaging.js';

/**
 * Подписка popup'а на состояние ProfileTracker'а (фон):
 * статистика, последний снимок профилей, лог изменений.
 * Симметрично useOnlineSpyStats, но для секции «Отслеживание профилей».
 *
 * Сам polling раз в 2 секунды — компромисс между свежестью UI и нагрузкой на
 * chrome.storage. Onchange-подписка тоже сработает (через SettingsContext),
 * но лог и снимки в state-контекст не попадают (см. isNonUiStateKey),
 * поэтому здесь читаем напрямую.
 */
const WATCHED_KEYS = [
  StorageKey.PROFILE_SPY_STATS,
  StorageKey.USER_PROFILE_SNAPSHOT,
  StorageKey.PROFILE_SPY_LOG,
];

export function useProfileSpyStats() {
  const [stats, setStats] = useState<SpyStats>({ checks: 0, isRunning: false });
  const [snapshots, setSnapshots] = useState<Record<string, UserProfileSnapshot>>({});
  const [profileLog, setProfileLog] = useState<ProfileSpyLogEntry[]>([]);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const result = await chrome.storage.local.get([
        StorageKey.PROFILE_SPY_STATS,
        StorageKey.USER_PROFILE_SNAPSHOT,
        StorageKey.PROFILE_SPY_LOG,
      ]);

      if (result[StorageKey.PROFILE_SPY_STATS]) {
        setStats(result[StorageKey.PROFILE_SPY_STATS] as SpyStats);
      }
      if (result[StorageKey.USER_PROFILE_SNAPSHOT]) {
        setSnapshots(result[StorageKey.USER_PROFILE_SNAPSHOT] as Record<string, UserProfileSnapshot>);
      }
      if (result[StorageKey.PROFILE_SPY_LOG]) {
        setProfileLog(result[StorageKey.PROFILE_SPY_LOG] as ProfileSpyLogEntry[]);
      }
    } catch { /* ignore */ }
  }, []);

  useStorageReload(WATCHED_KEYS, reload);

  const clearLog = useCallback(async (): Promise<void> => {
    await sendMessage({ type: 'CLEAR_PROFILE_SPY_LOG' });
    setProfileLog([]);
  }, []);

  const resetStats = useCallback((): void => {
    setStats({ checks: 0, isRunning: false });
  }, []);

  return { stats, snapshots, profileLog, reload, clearLog, resetStats };
}