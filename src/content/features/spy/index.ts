import type { FeatureManager } from '../../core/feature-manager.js';
import type { TrackedUser } from '../../../types/index.js';
import { InjectedScript } from '../../core/injected-scripts.js';
import { waitForInjectedScript } from '../../utils/injected-ready.js';

interface SpySettings {
  typing: boolean;
  voice: boolean;
  uploads: boolean;        // 65/66/67 — загрузка фото/видео/файла (v19)
  read: boolean;
  delete: boolean;
  online: boolean;
  friends: boolean;        // событие 90 (v19: только ваши действия)
  chatEvents: boolean;     // событие 52 — вступление/выход/исключение в беседах
  invisibility: boolean;   // событие 81 — изменение состояния невидимки
  browserNotify: boolean;
  saveLog: boolean;
  mode: string;
  trackedUsers: TrackedUser[];
  [key: string]: unknown;
}

interface SpyEventData {
  code: number;
  userId: number;
  userName?: string;
  action: string;
  extra?: Record<string, unknown>;
}

const EVENT_ICONS: Record<number, string> = {
  8: '🟢', 9: '⚫', 63: '⌨️', 64: '🎤',
  90: '👥', 10002: '🗑️', 10004: '💬',
  10005: '✏️', 10006: '👁️', 10007: '🗑️',
};

const EVENT_CATEGORIES: Record<number, string> = {
  63: 'typing', 64: 'voice', 10006: 'read',
  10007: 'delete', 10002: 'delete',
  8: 'online', 9: 'online', 90: 'friends',
};

const SETTING_MAP: Record<string, string> = {
  spy_typing: 'typing',
  spy_voice: 'voice',
  spy_uploads: 'uploads',
  spy_read: 'read',
  spy_delete: 'delete',
  spy_online: 'online',
  spy_friends: 'friends',
  spy_chat_events: 'chatEvents',
  spy_invisibility: 'invisibility',
  spy_browser_notify: 'browserNotify',
  spy_save_log: 'saveLog',
  spy_mode: 'mode',
  spy_tracked_users: 'trackedUsers',
};

function isContextValid(): boolean {
  try {
    return !!(chrome.runtime && chrome.runtime.id);
  } catch {
    return false;
  }
}

export function registerSpyFeatures(manager: FeatureManager): void {
  let spySettings: SpySettings | null = null;
  let spyEventHandler: ((e: Event) => void) | null = null;
  let storageUnsubscribe: (() => void) | null = null;
  const spyData = { eventCount: 0 };

  function checkSpyFilter(userId: number): boolean {
    if (!spySettings) return false;
    if (spySettings.mode === 'all') return true;
    if (spySettings.mode === 'selected') {
      const trackedIds = spySettings.trackedUsers.map(u => String(u.id));
      return trackedIds.includes(String(userId));
    }
    return true;
  }

  function isSpyEventEnabled(code: number): boolean {
    if (!spySettings) return false;
    const cat = EVENT_CATEGORIES[code];
    return cat ? !!spySettings[cat] : true;
  }

  // StorageHelper живёт в background/ — импортировать оттуда нельзя (Rollup shared chunk).
  const ACTIVITY_LOG_MAX_ENTRIES = 1000;

  async function saveSpyLogEntry(entry: Record<string, unknown>): Promise<void> {
    if (!isContextValid()) return;

    try {
      const result = await chrome.storage.local.get(['activity_spy_log']);
      const log: unknown[] = result['activity_spy_log'] ?? [];
      log.push(entry);
      if (log.length > ACTIVITY_LOG_MAX_ENTRIES) {
        log.splice(0, log.length - ACTIVITY_LOG_MAX_ENTRIES);
      }
      await chrome.storage.local.set({ activity_spy_log: log });
    } catch (e) {
      const err = e as Error;
      if (!err.message?.includes('Extension context invalidated')) {
        console.error('[VKify] Failed to save activity spy log:', e);
      }
    }
  }

  async function handleSpyEvent(data: SpyEventData): Promise<void> {
    if (!isContextValid()) return;

    const { code, userId, userName, action, extra } = data;

    if (!checkSpyFilter(userId)) return;
    if (!isSpyEventEnabled(code)) return;

    spyData.eventCount++;

    try {
      if (isContextValid()) {
        await chrome.storage.local.set({
          spy_stats: { events: spyData.eventCount, isRunning: true },
        });
      }
    } catch { /* ignore */ }

    const icon = EVENT_ICONS[code] || '📨';
    const displayName = userName || `ID ${userId}`;

    console.log(`[VKify Spy] ${icon} ${displayName} ${action}`);

    // Уведомление показывает background через chrome.notifications — ему не нужно
    // разрешение уведомлений у самого сайта vk.com (в отличие от page-context
    // `new Notification()`, который из-за этого молча не срабатывал).
    if (spySettings?.browserNotify) {
      chrome.runtime.sendMessage({
        type: 'SHOW_NOTIFICATION',
        title: `${icon} ${displayName}`,
        message: action,
        notifId: `vkify-spy-${code}-${userId}`,
      }).catch(() => { /* context invalidated */ });
    }

    if (spySettings?.saveLog) {
      await saveSpyLogEntry({
        timestamp: Date.now(),
        icon,
        userId,
        userName: userName || `ID ${userId}`,
        action,
        code,
        extra,
      });
    }
  }

  function updateSpySettings(key: string, value: unknown): void {
    if (!spySettings) return;

    const mappedKey = SETTING_MAP[key];
    if (mappedKey) {
      spySettings[mappedKey] = value;

      manager.sendEvent('vkify-spy-control', {
        action: 'updateSettings',
        settings: spySettings,
      });
    }
  }

  function cleanup(): void {
    if (spyEventHandler) {
      window.removeEventListener('vkify-spy-data', spyEventHandler);
      spyEventHandler = null;
    }

    if (storageUnsubscribe) {
      storageUnsubscribe();
      storageUnsubscribe = null;
    }

    spySettings = null;
  }

  manager.registerMultiple({
    spy_enabled: {
      enable: async () => {
        if (!isContextValid()) return;

        try {
          const settings = await manager.getAllSettings();

          spySettings = {
            typing: settings['spy_typing'] !== false,
            voice: settings['spy_voice'] !== false,
            uploads: settings['spy_uploads'] !== false,
            read: settings['spy_read'] !== false,
            delete: settings['spy_delete'] !== false,
            online: settings['spy_online'] !== false,
            friends: settings['spy_friends'] !== false,
            // По умолчанию ВЫКЛ — события беседы (вход/выход) шумны в больших чатах.
            chatEvents: settings['spy_chat_events'] === true,
            invisibility: settings['spy_invisibility'] !== false,
            browserNotify: settings['spy_browser_notify'] === true,
            saveLog: settings['spy_save_log'] === true,
            mode: (settings['spy_mode'] as string) || 'all',
            trackedUsers: (settings['spy_tracked_users'] as TrackedUser[]) || [],
          };

          if (spySettings.browserNotify && Notification.permission === 'default') {
            Notification.requestPermission();
          }

          manager.injectScript(InjectedScript.SPY);

          // Ждём ready-события от инжектированного скрипта, затем передаём настройки.
          waitForInjectedScript(InjectedScript.SPY).then(() => {
            if (isContextValid()) {
              manager.sendEvent('vkify-spy-control', {
                action: 'enable',
                settings: spySettings,
              });
            }
          });

          spyEventHandler = (event: Event) => {
            if (!isContextValid()) {
              cleanup();
              return;
            }
            const customEvent = event as CustomEvent;
            if (customEvent.detail?.type === 'vkify-spy-event') {
              handleSpyEvent(customEvent.detail.data as SpyEventData);
            }
          };

          window.addEventListener('vkify-spy-data', spyEventHandler);

          storageUnsubscribe = manager.onStorageChange((key, value) => {
            if (!isContextValid()) {
              cleanup();
              return;
            }
            if (key.startsWith('spy_') && key !== 'spy_enabled') {
              updateSpySettings(key, value);
            }
          });

          if (isContextValid()) {
            chrome.storage.local.set({
              spy_stats: { events: 0, isRunning: true },
            }).catch(() => {});
          }

          console.log('[VKify] Spy enabled');
        } catch (e) {
          const err = e as Error;
          if (!err.message?.includes('Extension context invalidated')) {
            console.error('[VKify] Failed to enable spy:', e);
          }
        }
      },

      disable: () => {
        cleanup();

        manager.sendEvent('vkify-spy-control', { action: 'disable' });

        if (isContextValid()) {
          chrome.storage.local.set({
            spy_stats: { events: spyData.eventCount, isRunning: false },
          }).catch(() => {});
        }

        console.log('[VKify] Spy disabled');
      },
    },

    spy_typing: {
      enable: (v) => updateSpySettings('spy_typing', v),
      disable: () => updateSpySettings('spy_typing', false),
    },
    spy_voice: {
      enable: (v) => updateSpySettings('spy_voice', v),
      disable: () => updateSpySettings('spy_voice', false),
    },
    spy_uploads: {
      enable: (v) => updateSpySettings('spy_uploads', v),
      disable: () => updateSpySettings('spy_uploads', false),
    },
    spy_chat_events: {
      enable: (v) => updateSpySettings('spy_chat_events', v),
      disable: () => updateSpySettings('spy_chat_events', false),
    },
    spy_invisibility: {
      enable: (v) => updateSpySettings('spy_invisibility', v),
      disable: () => updateSpySettings('spy_invisibility', false),
    },
    spy_read: {
      enable: (v) => updateSpySettings('spy_read', v),
      disable: () => updateSpySettings('spy_read', false),
    },
    spy_delete: {
      enable: (v) => updateSpySettings('spy_delete', v),
      disable: () => updateSpySettings('spy_delete', false),
    },
    spy_online: {
      enable: (v) => updateSpySettings('spy_online', v),
      disable: () => updateSpySettings('spy_online', false),
    },
    spy_friends: {
      enable: (v) => updateSpySettings('spy_friends', v),
      disable: () => updateSpySettings('spy_friends', false),
    },
    spy_browser_notify: {
      enable: () => {
        if (Notification.permission === 'default') {
          Notification.requestPermission();
        }
        updateSpySettings('spy_browser_notify', true);
      },
      disable: () => updateSpySettings('spy_browser_notify', false),
    },
    spy_save_log: {
      enable: (v) => updateSpySettings('spy_save_log', v),
      disable: () => updateSpySettings('spy_save_log', false),
    },
    spy_mode: {
      enable: (v) => updateSpySettings('spy_mode', v),
      disable: () => {},
    },
    spy_tracked_users: {
      enable: (v) => updateSpySettings('spy_tracked_users', v),
      disable: () => {},
    },
  });
}