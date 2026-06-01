import { IS_FIREFOX } from '../../shared/constants/browser.js';

export class NotificationService {
  private readonly iconUrl: string;

  constructor() {
    this.iconUrl = chrome.runtime.getURL('icons/icon48.png');
  }

  /**
   * `priority` — Chrome-only поле. Firefox строго валидирует схему
   * notifications.create и БРОСАЕТ TypeError на неизвестном свойстве (в отличие
   * от Chrome, который лишние поля игнорирует) — из-за чего уведомление молча не
   * показывалось бы. Поэтому на Firefox поле опускаем; на Chromium — как было.
   */
  private buildOptions(
    title: string,
    message: string,
    priority: number,
  ): chrome.notifications.NotificationOptions<true> {
    const opts: chrome.notifications.NotificationOptions<true> = {
      type: 'basic',
      iconUrl: this.iconUrl,
      title,
      message,
    };
    if (!IS_FIREFOX) opts.priority = priority;
    return opts;
  }

  async showStatusChange(userId: string, userName: string, action: string): Promise<void> {
    try {
      await chrome.notifications.create(
        `online-spy-${userId}-${Date.now()}`,
        this.buildOptions(userName, action, 1),
      );
    } catch (err) {
      console.log('[VKify] Could not show notification:', (err as Error).message);
    }
  }

  async show(id: string, title: string, message: string, priority = 0): Promise<void> {
    try {
      await chrome.notifications.create(id, this.buildOptions(title, message, priority));
    } catch (err) {
      console.log('[VKify] Could not show notification:', (err as Error).message);
    }
  }

  async clear(id: string): Promise<void> {
    try {
      await chrome.notifications.clear(id);
    } catch {
      // Notification might not exist
    }
  }
}