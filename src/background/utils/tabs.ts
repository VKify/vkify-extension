import type { ExtensionMessage } from '../../types/index.js';

export class TabsHelper {
  static async hasVKTabs(): Promise<boolean> {
    try {
      const tabs = await chrome.tabs.query({ url: '*://*.vk.ru/*' });
      return tabs.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Опрашивает открытые вкладки VK и возвращает метод API (native / token).
   * Вынесено в background, потому что popup в embed-режиме Firefox не имеет
   * собственного chrome.tabs (см. useApiMethod).
   */
  static async getApiMethodInfo(): Promise<{
    hasVKTab: boolean;
    nativeApiAvailable?: boolean;
    hasToken?: boolean;
  }> {
    try {
      const tabs = await chrome.tabs.query({ url: '*://*.vk.ru/*' });
      if (tabs.length === 0) return { hasVKTab: false };

      for (const tab of tabs) {
        if (!tab.id) continue;
        try {
          const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_API_METHOD_INFO' }) as
            { nativeApiAvailable?: boolean; hasToken?: boolean } | null;
          if (resp) {
            return {
              hasVKTab: true,
              nativeApiAvailable: resp.nativeApiAvailable,
              hasToken: resp.hasToken,
            };
          }
        } catch {
          // вкладка без content-script (ещё не загрузилась) — пробуем следующую
        }
      }
      return { hasVKTab: true };
    } catch {
      return { hasVKTab: false };
    }
  }

  /** Открывает URL в новой вкладке. Сообщение OPEN_TAB доступно любому
   *  контексту расширения — не даём открывать javascript:/file:/data:.
   *  Кроме http(s) разрешена ровно одна служебная страница — настройка
   *  хоткеев (кнопка в PlayerPage). */
  static async openTab(url: string): Promise<void> {
    if (!/^https?:\/\//i.test(url) && url !== 'chrome://extensions/shortcuts') {
      console.log('[VKify] Blocked non-http(s) OPEN_TAB url');
      return;
    }
    try {
      await chrome.tabs.create({ url });
    } catch (err) {
      console.log('[VKify] Could not open tab:', (err as Error).message);
    }
  }

  /** Перезагружает все открытые вкладки VK. */
  static async reloadAllVKTabs(): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({ url: ['*://*.vk.ru/*', '*://*.vkvideo.ru/*'] });
      for (const tab of tabs) {
        if (tab.id != null) {
          try { await chrome.tabs.reload(tab.id); } catch { /* tab gone */ }
        }
      }
    } catch { /* not critical */ }
  }

  /** Перезагружает активную вкладку, если это VK. */
  static async reloadActiveVKTab(): Promise<{ reloaded: boolean }> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url && /^https?:\/\/([\w-]+\.)*(vk\.ru|vkvideo\.ru)\//i.test(tab.url) && tab.id != null) {
        await chrome.tabs.reload(tab.id);
        return { reloaded: true };
      }
    } catch { /* not critical */ }
    return { reloaded: false };
  }

  /** Считает открытые вкладки VK (опц. по конкретному URL-паттерну). */
  static async countVKTabs(urlPattern?: string): Promise<number> {
    try {
      const tabs = await chrome.tabs.query({ url: urlPattern ?? '*://*.vk.ru/*' });
      return tabs.length;
    } catch {
      return 0;
    }
  }

  static async sendToActiveVKTab(message: ExtensionMessage): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
        url: ['*://*.vk.ru/*', '*://*.vkvideo.ru/*'],
      });

      if (tabs[0]?.id) {
        try {
          await chrome.tabs.sendMessage(tabs[0].id, message);
          return;
        } catch {
          // Active tab not responding, fall through to all tabs
        }
      }

      await this.notifyAllVKTabs(message);
    } catch {
      // Not critical
    }
  }

  /**
   * Как sendToActiveVKTab, но ВОЗВРАЩАЕТ ответ content-скрипта (нужно для
   * GET_PERF_TELEMETRY: popup собирает снимок через background). Пробует
   * активную VK-вкладку, затем любую отвечающую; null — если ни одна не ответила
   * (нет открытой VK-вкладки / content ещё не загрузился).
   */
  static async requestFromActiveVKTab<T>(message: ExtensionMessage): Promise<T | null> {
    try {
      const active = await chrome.tabs.query({
        active: true,
        currentWindow: true,
        url: ['*://*.vk.ru/*', '*://*.vkvideo.ru/*'],
      });
      const ordered = [...active, ...(await chrome.tabs.query({
        url: ['*://*.vk.ru/*', '*://*.vkvideo.ru/*'],
      }))];
      const seen = new Set<number>();

      for (const tab of ordered) {
        if (tab.id == null || seen.has(tab.id)) continue;
        seen.add(tab.id);
        try {
          const resp = await chrome.tabs.sendMessage(tab.id, message) as T | null;
          if (resp != null) return resp;
        } catch {
          // вкладка без content-скрипта (ещё не загрузилась) — пробуем следующую
        }
      }
    } catch {
      // chrome.tabs недоступен — не критично
    }
    return null;
  }

  static async notifyAllVKTabs(message: ExtensionMessage): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({ url: ['*://*.vk.ru/*', '*://*.vkvideo.ru/*'] });
      console.log('[VKify] Notifying', tabs.length, 'VK tabs');

      for (const tab of tabs) {
        if (!tab.id) continue;
        try {
          await chrome.tabs.sendMessage(tab.id, message);
        } catch {
          // Tab without content-script - normal
        }
      }
    } catch {
      // Not critical
    }
  }

  static async notifyPopup(message: ExtensionMessage): Promise<void> {
    try {
      await chrome.runtime.sendMessage(message);
    } catch {
      // Popup closed - normal
    }
  }
}
