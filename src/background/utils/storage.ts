import type { ActivityDataEntry, SpyLogEntry, ProfileSpyLogEntry } from '../../types/index.js';
import { StorageKey, activityKey } from '../../shared/constants/storage-keys.js';

const SPY_LOG_MAX_ENTRIES = 1000;
const ACTIVITY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 дней

export class StorageHelper {

  static async saveActivityData(userId: string, entry: ActivityDataEntry): Promise<void> {
    try {
      const key = activityKey(userId);
      const result = await chrome.storage.local.get([key]);
      let data: ActivityDataEntry[] = result[key] ?? [];

      data.push(entry);

      const cutoff = Date.now() - ACTIVITY_RETENTION_MS;
      data = data.filter(e => e.timestamp > cutoff);

      await chrome.storage.local.set({ [key]: data });
    } catch (err) {
      console.log('[VKify] Could not save activity data:', (err as Error).message);
    }
  }


  /**
   * Универсальный метод добавления записи в лог с ограничением размера.
   */
  private static async appendToLog(storageKey: string, entry: SpyLogEntry): Promise<void> {
    try {
      const result = await chrome.storage.local.get([storageKey]);
      const log: SpyLogEntry[] = result[storageKey] ?? [];

      log.push(entry);

      // Удаляем самые старые записи, если превышен лимит
      if (log.length > SPY_LOG_MAX_ENTRIES) {
        log.splice(0, log.length - SPY_LOG_MAX_ENTRIES);
      }

      await chrome.storage.local.set({ [storageKey]: log });
    } catch (err) {
      console.log(`[VKify] Could not save to ${storageKey}:`, (err as Error).message);
    }
  }

  static async saveToOnlineSpyLog(entry: SpyLogEntry): Promise<void> {
    return StorageHelper.appendToLog(StorageKey.ONLINE_SPY_LOG, entry);
  }

  static async saveToActivitySpyLog(entry: SpyLogEntry): Promise<void> {
    return StorageHelper.appendToLog(StorageKey.ACTIVITY_SPY_LOG, entry);
  }


  static async getOnlineSpyLog(): Promise<SpyLogEntry[]> {
    try {
      const result = await chrome.storage.local.get([StorageKey.ONLINE_SPY_LOG]);
      return result[StorageKey.ONLINE_SPY_LOG] ?? [];
    } catch {
      return [];
    }
  }

  static async getActivitySpyLog(): Promise<SpyLogEntry[]> {
    try {
      const result = await chrome.storage.local.get([StorageKey.ACTIVITY_SPY_LOG]);
      return result[StorageKey.ACTIVITY_SPY_LOG] ?? [];
    } catch {
      return [];
    }
  }


  static async clearOnlineSpyLog(): Promise<void> {
    await chrome.storage.local.remove([StorageKey.ONLINE_SPY_LOG]);
  }

  static async clearActivitySpyLog(): Promise<void> {
    await chrome.storage.local.remove([StorageKey.ACTIVITY_SPY_LOG]);
  }

  static async saveToProfileSpyLog(entry: ProfileSpyLogEntry): Promise<void> {
    try {
      const key = StorageKey.PROFILE_SPY_LOG;
      const result = await chrome.storage.local.get([key]);
      const log: ProfileSpyLogEntry[] = result[key] ?? [];
      log.push(entry);
      if (log.length > SPY_LOG_MAX_ENTRIES) {
        log.splice(0, log.length - SPY_LOG_MAX_ENTRIES);
      }
      await chrome.storage.local.set({ [key]: log });
    } catch (err) {
      console.log('[VKify] Could not save to profile_spy_log:', (err as Error).message);
    }
  }

  static async getProfileSpyLog(): Promise<ProfileSpyLogEntry[]> {
    try {
      const result = await chrome.storage.local.get([StorageKey.PROFILE_SPY_LOG]);
      return result[StorageKey.PROFILE_SPY_LOG] ?? [];
    } catch {
      return [];
    }
  }

  static async clearProfileSpyLog(): Promise<void> {
    await chrome.storage.local.remove([StorageKey.PROFILE_SPY_LOG]);
  }
}