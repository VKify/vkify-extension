import { useState, useCallback } from 'react';
import { StorageKey } from '@/shared/constants/storage-keys.js';
import { getStorage, setStorage } from '../../utils/storageClient.js';
import { useStorageReload } from '../core/useStorageReload.js';

export interface OnlineStatus {
  online: boolean;
  lastSeen: number | null;
}

export interface SpyStats {
  checks: number;
  isRunning: boolean;
}

export interface SpyLogEntry {
  icon: string;
  userName: string;
  userId: string;
  action: string;
  timestamp: number;
  userInfo?: { photo50?: string };
}

const WATCHED_KEYS = [
  StorageKey.ONLINE_SPY_STATS,
  StorageKey.USER_ONLINE_STATUS,
  StorageKey.ONLINE_SPY_LOG,
];

export function useOnlineSpyStats() {
  const [stats, setStats] = useState<SpyStats>({ checks: 0, isRunning: false });
  const [userOnlineStatus, setUserOnlineStatus] = useState<Record<string, OnlineStatus>>({});
  const [spyLog, setSpyLog] = useState<SpyLogEntry[]>([]);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const result = await getStorage([
        StorageKey.ONLINE_SPY_STATS,
        StorageKey.USER_ONLINE_STATUS,
        StorageKey.ONLINE_SPY_LOG,
      ]);

      if (result[StorageKey.ONLINE_SPY_STATS]) {
        setStats(result[StorageKey.ONLINE_SPY_STATS] as SpyStats);
      }
      if (result[StorageKey.USER_ONLINE_STATUS]) {
        setUserOnlineStatus(result[StorageKey.USER_ONLINE_STATUS] as Record<string, OnlineStatus>);
      }
      if (result[StorageKey.ONLINE_SPY_LOG]) {
        setSpyLog(result[StorageKey.ONLINE_SPY_LOG] as SpyLogEntry[]);
      }
    } catch { /* ignore */ }
  }, []);

  useStorageReload(WATCHED_KEYS, reload);

  const clearLog = useCallback(async (): Promise<void> => {
    await setStorage({ [StorageKey.ONLINE_SPY_LOG]: [] });
    setSpyLog([]);
  }, []);

  const resetStats = useCallback((): void => {
    setStats({ checks: 0, isRunning: false });
  }, []);

  return { stats, userOnlineStatus, spyLog, reload, clearLog, resetStats };
}