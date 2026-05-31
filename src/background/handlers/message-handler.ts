import type { ExtensionSettings, ActivityDataEntry, ExtensionMessage } from '../../types/index.js';
import { VKTokenManager, callVKApi, isExpectedTokenError } from '../utils/vk-api.js';
import { TabsHelper } from '../utils/tabs.js';
import { StorageKey, SPY_SETTINGS_KEYS, PROFILE_SPY_SETTINGS_KEYS } from '../../shared/constants/storage-keys.js';
import { THEME_SHORT_EXPAND, sanitizeSettings } from '../../shared/constants/settings-schema.js';
import type { SpyTracker } from '../services/spy-tracker.js';
import type { ProfileTracker } from '../services/profile-tracker.js';
import type { AlarmManager } from '../services/alarm-manager.js';
import type { NotificationService } from '../services/notification-service.js';
import { StorageHelper } from '../utils/storage.js';

type OkResult   = { success: true };
type ErrorResult = { success: false; error: string; code?: string };

/** Точный результат применения общей темы — позволяет вызывающей стороне
 *  сузить тип по `success` без приведения типов. */
export type ApplyThemeResult = (OkResult & { applied: string[] }) | ErrorResult;

type HandlerResult =
  | OkResult
  | ErrorResult
  | (OkResult & { settings: Record<string, unknown> })
  | (OkResult & { stats: unknown; userStatus: unknown })
  | (OkResult & { data: unknown })
  | (OkResult & { applied: string[] })
  | (OkResult & { onlineLog: unknown[]; activityLog: unknown[] })
  | (OkResult & { profileLog: unknown[] })
  | (OkResult & { stats: unknown; snapshots: unknown })
  | { token: string | null; userId: string | null; expiresAt: number | null; status: string }
  | { hasVKTabs: boolean }
  | { hasVKTab: boolean; nativeApiAvailable?: boolean; hasToken?: boolean }
  | { reloaded: boolean }
  | { count: number }
  | { nativeApiAvailable: boolean; hasToken: boolean };


export class MessageHandler {
  private readonly spyTracker: SpyTracker;
  private readonly profileTracker: ProfileTracker;
  private readonly alarmManager: AlarmManager;
  private readonly notificationService: NotificationService;

  /**
   * tokenManager принимается снаружи (DI).
   */
  private readonly tokenManager: VKTokenManager;

  constructor(
    spyTracker: SpyTracker,
    profileTracker: ProfileTracker,
    alarmManager: AlarmManager,
    notificationService: NotificationService,
    tokenManager: VKTokenManager,
  ) {
    this.spyTracker = spyTracker;
    this.profileTracker = profileTracker;
    this.alarmManager = alarmManager;
    this.notificationService = notificationService;
    this.tokenManager = tokenManager;
  }

  isExpectedError(error: unknown): boolean {
    return isExpectedTokenError(error);
  }

  async handle(
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
  ): Promise<HandlerResult> {
    if (message.type !== 'VK_TOKEN_UPDATE') {
      console.log('[VKify] Background received:', message.type);
    }

    switch (message.type) {
      case 'GET_SETTINGS':
        return { success: true, settings: await chrome.storage.local.get(null) };

      case 'VK_TOKEN_UPDATE':
        return this.handleTokenUpdate(message.token, message.userId, message.expiresAt);

      case 'GET_VK_TOKEN':
        return this.handleGetToken();

      case 'CHECK_VK_TABS':
        return { hasVKTabs: await TabsHelper.hasVKTabs() };

      case 'GET_API_METHOD':
        return TabsHelper.getApiMethodInfo();

      case 'OPEN_TAB':
        await TabsHelper.openTab(message.url);
        return { success: true };

      case 'RELOAD_VK_TABS':
        await TabsHelper.reloadAllVKTabs();
        return { success: true };

      case 'RELOAD_ACTIVE_VK_TAB':
        return TabsHelper.reloadActiveVKTab();

      case 'QUERY_VK_TABS':
        return { count: await TabsHelper.countVKTabs(message.urlPattern) };

      case 'VK_API_CALL':
        return this.handleApiCall(message.method, message.params);

      case 'STORAGE_CHANGED':
        await TabsHelper.notifyAllVKTabs(message);
        return { success: true };

      case 'ENABLE_FEATURE':
      case 'DISABLE_FEATURE':
        await TabsHelper.sendToActiveVKTab(message);
        return { success: true };

      case 'RELOAD_FEATURES':
        await TabsHelper.notifyAllVKTabs(message);
        return { success: true };

      case 'GET_ONLINE_STATS':
        return { success: true, ...this.spyTracker.getStats() };

      case 'START_ONLINE_SPY':
        return this.handleStartSpy();

      case 'STOP_ONLINE_SPY':
        await this.spyTracker.stop();
        return { success: true };

      case 'GET_USER_ACTIVITY':
        return this.handleGetUserActivity(message.userId);

      case 'GET_SPY_LOG':
        return this.handleGetSpyLog();

      case 'CLEAR_SPY_LOG': {
        // Удаляем логи и все динамические ключи activity_{userId},
        // которые иначе накапливались бы бесконечно.
        const allData = await chrome.storage.local.get(null);
        const activityKeys = Object.keys(allData).filter(k => k.startsWith('activity_'));
        await chrome.storage.local.remove([
          StorageKey.ONLINE_SPY_LOG,
          StorageKey.ACTIVITY_SPY_LOG,
          ...activityKeys,
        ]);
        return { success: true };
      }

      case 'START_PROFILE_SPY':
        return this.handleStartProfileSpy();

      case 'STOP_PROFILE_SPY':
        await this.profileTracker.stop();
        return { success: true };

      case 'GET_PROFILE_SPY_STATS':
        return { success: true, ...this.profileTracker.getStats() };

      case 'GET_PROFILE_SPY_LOG':
        return { success: true, profileLog: await StorageHelper.getProfileSpyLog() };

      case 'CLEAR_PROFILE_SPY_LOG':
        await StorageHelper.clearProfileSpyLog();
        return { success: true };

      case 'SHOW_NOTIFICATION':
        await this.notificationService.show(
          message.notifId ?? `vkify-spy-${Date.now()}`,
          message.title,
          message.message,
          1,
        );
        return { success: true };

      case 'APPLY_SHARED_THEME':
        return this.handleApplySharedTheme(message.encoded);

      case 'DOWNLOAD_VIDEO':
        return this.handleDownloadVideo(message.url, message.filename);

      default:
        console.log('[VKify] Unknown message type:', (message as ExtensionMessage).type);
        return { success: false, error: 'Unknown message type' };
    }
  }


  private async handleTokenUpdate(
    token: string | undefined,
    userId: string | undefined,
    expiresAt: number | undefined,
  ): Promise<HandlerResult> {
    await this.tokenManager.update(token, userId, expiresAt);
    await TabsHelper.notifyPopup({ type: 'VK_TOKEN_UPDATE', token, userId, expiresAt });
    return { success: true };
  }

  private async handleGetToken(): Promise<HandlerResult> {
    const vkData = await this.tokenManager.get();

    if (!vkData.token) {
      const result = await this.tokenManager.requestFresh();
      if (result.token) {
        return this.tokenManager.get();
      }
      return { ...vkData, status: result.reason ?? 'no_token' };
    }

    return vkData;
  }

  private async handleApiCall(
    method: string,
    params: Record<string, unknown>,
  ): Promise<HandlerResult> {
    try {
      const data = await callVKApi(this.tokenManager, method, params);
      return { success: true, data };
    } catch (error) {
      const err = error as Error & { code?: string };
      return { success: false, error: err.message, code: err.code };
    }
  }

  private async handleStartSpy(): Promise<HandlerResult> {
    const settings = await chrome.storage.local.get([...SPY_SETTINGS_KEYS]) as Partial<ExtensionSettings>;
    await this.spyTracker.loadState();
    await this.spyTracker.start(settings);
    return { success: true };
  }

  private async handleStartProfileSpy(): Promise<HandlerResult> {
    const settings = await chrome.storage.local.get([...PROFILE_SPY_SETTINGS_KEYS]) as Partial<ExtensionSettings>;
    await this.profileTracker.loadState();
    await this.profileTracker.start(settings);
    return { success: true };
  }

  private async handleGetUserActivity(userId: string): Promise<HandlerResult> {
    const result = await chrome.storage.local.get([`activity_${userId}`]);
    return {
      success: true,
      data: (result[`activity_${userId}`] as ActivityDataEntry[]) ?? [],
    };
  }

  private async handleGetSpyLog(): Promise<HandlerResult> {
    const result = await chrome.storage.local.get([
      StorageKey.ONLINE_SPY_LOG,
      StorageKey.ACTIVITY_SPY_LOG,
    ]);
    return {
      success: true,
      onlineLog: result[StorageKey.ONLINE_SPY_LOG] ?? [],
      activityLog: result[StorageKey.ACTIVITY_SPY_LOG] ?? [],
    };
  }


  async handleApplySharedTheme(encoded: string): Promise<ApplyThemeResult> {
    if (!encoded || typeof encoded !== 'string') {
      return { success: false, error: 'No encoded payload' };
    }

    let themeSettings: Record<string, unknown>;
    try {
      const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      const padding = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
      // TextDecoder корректно обрабатывает multi-byte символы (в отличие от устаревшего escape()).
      const bytes = Uint8Array.from(atob(b64 + padding), c => c.charCodeAt(0));
      const json = new TextDecoder().decode(bytes);
      const payload = JSON.parse(json) as { v?: number; p?: Record<string, unknown> };

      if (!payload || typeof payload.p !== 'object') {
        return { success: false, error: 'Invalid payload structure' };
      }

      // v:2 — короткие алиасы ключей; расширяем в полные имена перед валидацией
      const rawParams = payload.p as Record<string, unknown>;
      if ((payload.v ?? 1) >= 2) {
        themeSettings = {};
        for (const [key, value] of Object.entries(rawParams)) {
          const fullKey = THEME_SHORT_EXPAND[key] ?? key;
          themeSettings[fullKey] = value;
        }
      } else {
        themeSettings = rawParams;
      }
    } catch (err) {
      console.warn('[VKify] Failed to decode shared theme:', (err as Error).message);
      return { success: false, error: 'Decode failed: ' + (err as Error).message };
    }

    // Канонический санитайзер: разрешённые в scope 'theme' ключи И корректные
    // типы значений. Та же функция используется для импорта файла и site-bridge.
    const sanitized = sanitizeSettings(themeSettings, 'theme');

    if (Object.keys(sanitized).length === 0) {
      return { success: false, error: 'No valid appearance settings in payload' };
    }

    await chrome.storage.local.set(sanitized);
    await TabsHelper.notifyAllVKTabs({ type: 'RELOAD_FEATURES' });

    console.log('[VKify] Shared theme applied:', Object.keys(sanitized));
    return { success: true, applied: Object.keys(sanitized) };
  }

  private async handleDownloadVideo(url: string, filename: string): Promise<HandlerResult> {
    try {
      await chrome.downloads.download({ url, filename, conflictAction: 'uniquify' });
      return { success: true };
    } catch (error) {
      console.error('[VKify] Download failed:', error);
      return { success: false, error: (error as Error).message };
    }
  }
}