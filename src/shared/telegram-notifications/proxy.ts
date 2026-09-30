import { isValidTelegramBotToken, isValidTelegramChatId, type NotificationPayload, type SendResult, type TelegramNotifier } from './types.js';

/** Content-side bridge. Sending remains centralized in the background worker. */
export class TelegramNotifierProxy implements TelegramNotifier {
  private configured = false;

  constructor() {
    void chrome.storage.local.get(['telegram_bot_token', 'telegram_chat_id']).then((raw) => {
      this.configured = isValidTelegramBotToken(String(raw.telegram_bot_token ?? ''))
        && isValidTelegramChatId(String(raw.telegram_chat_id ?? ''));
    }).catch(() => {});
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || (!changes.telegram_bot_token && !changes.telegram_chat_id)) return;
      void chrome.storage.local.get(['telegram_bot_token', 'telegram_chat_id']).then((raw) => {
        this.configured = isValidTelegramBotToken(String(raw.telegram_bot_token ?? ''))
          && isValidTelegramChatId(String(raw.telegram_chat_id ?? ''));
      }).catch(() => {});
    });
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async send(payload: NotificationPayload): Promise<SendResult> {
    try {
      return await chrome.runtime.sendMessage({ type: 'TELEGRAM_SEND', payload }) as SendResult;
    } catch {
      return { success: false, status: 'error', error: 'BACKGROUND_UNAVAILABLE' };
    }
  }
}

