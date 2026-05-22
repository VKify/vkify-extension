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
