export class NotificationService {
  private readonly iconUrl: string;

  constructor() {
    this.iconUrl = chrome.runtime.getURL('icons/icon48.png');
  }

  async showStatusChange(userId: string, userName: string, action: string): Promise<void> {
    try {
      await chrome.notifications.create(`online-spy-${userId}-${Date.now()}`, {
        type: 'basic',
        iconUrl: this.iconUrl,
        title: userName,
        message: action,
        priority: 1,
      });
    } catch (err) {
      console.log('[VKify] Could not show notification:', (err as Error).message);
    }
  }

  async show(id: string, title: string, message: string, priority = 0): Promise<void> {
    try {
      await chrome.notifications.create(id, {
        type: 'basic',
        iconUrl: this.iconUrl,
        title,
        message,
        priority,
      });
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