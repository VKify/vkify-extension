import type { ExtensionMessage } from '../../types/index.js';

export class TabsHelper {
  static async hasVKTabs(): Promise<boolean> {
    try {
      const tabs = await chrome.tabs.query({ url: '*://*.vk.com/*' });
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
      const tabs = await chrome.tabs.query({ url: '*://*.vk.com/*' });
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

  static async sendToActiveVKTab(message: ExtensionMessage): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
        url: '*://*.vk.com/*',
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

  static async notifyAllVKTabs(message: ExtensionMessage): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({ url: '*://*.vk.com/*' });
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
