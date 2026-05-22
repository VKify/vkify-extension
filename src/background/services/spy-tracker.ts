import type {
  SpyStats,
  UserOnlineStatus,
  VKUserRaw,
  ExtensionSettings,
  ActivityDataEntry,
} from '../../types/index.js';
import type { NotificationService } from './notification-service.js';
import { callVKApi, VKTokenManager, isExpectedTokenError } from '../utils/vk-api.js';
import { StorageHelper } from '../utils/storage.js';
import { StorageKey, SPY_SETTINGS_KEYS } from '../../shared/constants/storage-keys.js';
import { AlarmName } from '../../shared/constants/alarms.js';

export class SpyTracker {

  private _isRunning = false;
  private _stats: SpyStats = { checks: 0, isRunning: false };
  private _userStatus: Record<string, UserOnlineStatus> = {};

  private readonly notificationService: NotificationService;
  private readonly tokenManager: VKTokenManager;

  /**
   * NotificationService передаётся снаружи (DI).
   */
  constructor(notificationService: NotificationService, tokenManager: VKTokenManager) {
    this.notificationService = notificationService;
    this.tokenManager = tokenManager;
  }


  get isRunning(): boolean {
    return this._isRunning;
  }


  async start(settings: Partial<ExtensionSettings>): Promise<void> {
    if (this._isRunning) return;
    if (!settings.spy_online) return;

    console.log('[VKify] Starting online spy...');
    this._isRunning = true;
    this._stats.isRunning = true;
    await this.saveStats();

    // intervalMinutes не может быть меньше 0.5 (ограничение Chrome Alarms API)
    const intervalMinutes = Math.max((settings.spy_online_interval ?? 60) / 60, 0.5);

    await this.checkUsers(settings);
    await chrome.alarms.create(AlarmName.ONLINE_SPY_CHECK, { periodInMinutes: intervalMinutes });

    console.log(`[VKify] Online spy alarm set for every ${intervalMinutes} minutes`);
  }

  async stop(): Promise<void> {
    console.log('[VKify] Stopping online spy...');
    this._isRunning = false;
    this._stats.isRunning = false;
    await this.saveStats();
    await chrome.alarms.clear(AlarmName.ONLINE_SPY_CHECK);
  }

  /**
   * Вызывается AlarmManager'ом при срабатывании тревоги.
   */
  async triggerCheck(settings: Record<string, unknown>): Promise<void> {
    if (!settings['spy_online'] || !(settings['online_tracked_users'] as unknown[])?.length) {
      console.log('[VKify] Spy disabled, clearing alarm');
      await chrome.alarms.clear(AlarmName.ONLINE_SPY_CHECK);
      this._isRunning = false;
      await this.saveStats();
      return;
    }

    await this.loadState();
    this._isRunning = true;
    await this.checkUsers(settings as Partial<ExtensionSettings>);
  }

  async handleSettingsChange(): Promise<void> {
    if (this._isRunning) await this.stop();

    const settings = await chrome.storage.local.get([...SPY_SETTINGS_KEYS]) as Partial<ExtensionSettings>;

    if (settings.spy_online && (settings.online_tracked_users?.length ?? 0) > 0) {
      await this.loadState();
      await this.start(settings);
      console.log('[VKify] Online spy started with', settings.online_tracked_users?.length, 'users');
    } else {
      console.log('[VKify] Online spy not started:',
        !settings.spy_online ? 'disabled' : 'no users to track');
    }
  }


  async checkUsers(settings: Partial<ExtensionSettings>): Promise<void> {
    try {
      const trackedUsers = settings.online_tracked_users ?? [];
      if (trackedUsers.length === 0) return;

      const userIds = trackedUsers.map(u => u.id).join(',');
      const data = await callVKApi(this.tokenManager, 'users.get', {
        user_ids: userIds,
        fields: 'online,last_seen,online_mobile,online_app,photo_50',
      }) as VKUserRaw[] | undefined;

      if (!Array.isArray(data)) return;

      this._stats.checks++;
      await this.saveStats();

      const now = Date.now();
      for (const user of data) {
        await this.processUserStatus(user, now, settings);
      }
      await this.saveUserStatus();

      console.log(`[VKify] Checked ${data.length} users, total checks: ${this._stats.checks}`);
    } catch (error) {
      if (isExpectedTokenError(error)) {
        const e = error as { code?: string; message?: string };
        console.log(`[VKify] Online spy: ${e.code ?? e.message}, will retry next interval`);
      } else {
        console.error('[VKify] Online spy check failed:', error);
      }
    }
  }

  private async processUserStatus(
    user: VKUserRaw,
    now: number,
    settings: Partial<ExtensionSettings>,
  ): Promise<void> {
    const userId = String(user.id);
    const isOnline = user.online === 1;
    const platform = user.online_mobile ?? user.online_app ?? (isOnline ? 7 : null);
    const lastSeen = user.last_seen?.time ? user.last_seen.time * 1000 : null;

    const prevStatus = this._userStatus[userId];

    this._userStatus[userId] = {
      online: isOnline,
      lastSeen: isOnline ? now : lastSeen,
      platform,
      lastChecked: now,
    };

    const entry: ActivityDataEntry = { timestamp: now, online: isOnline, platform };
    await StorageHelper.saveActivityData(userId, entry);

    if (prevStatus && prevStatus.online !== isOnline) {
      await this.handleStatusChange(userId, isOnline, user, settings);
    }
  }

  private async handleStatusChange(
    userId: string,
    isOnline: boolean,
    userInfo: VKUserRaw,
    settings: Partial<ExtensionSettings>,
  ): Promise<void> {
    const userName = `${userInfo.first_name} ${userInfo.last_name}`;
    const action = isOnline ? 'Зашёл в сеть' : 'Вышел из сети';
    const icon = isOnline ? '🟢' : '⚫';

    console.log(`[VKify] ${icon} ${userName} ${action}`);

    if (settings.spy_browser_notify) {
      this.notificationService.showStatusChange(userId, userName, action);
    }

    if (settings.spy_save_log) {
      await StorageHelper.saveToOnlineSpyLog({
        userId,
        userName,
        action,
        icon,
        timestamp: Date.now(),
        userInfo: { photo50: userInfo.photo_50 },
      });
    }
  }


  async loadState(): Promise<void> {
    try {
      const result = await chrome.storage.local.get([
        StorageKey.ONLINE_SPY_STATS,
        StorageKey.USER_ONLINE_STATUS,
      ]);

      if (result[StorageKey.ONLINE_SPY_STATS]) {
        this._stats = result[StorageKey.ONLINE_SPY_STATS] as SpyStats;
        // Без этой строки _isRunning всегда false после перезапуска service worker,
        // что приводило к рассинхронизации с alarm-состоянием.
        this._isRunning = this._stats.isRunning;
      }
      if (result[StorageKey.USER_ONLINE_STATUS]) {
        this._userStatus = result[StorageKey.USER_ONLINE_STATUS] as Record<string, UserOnlineStatus>;
      }
    } catch (err) {
      console.log('[VKify] Could not load stats:', (err as Error).message);
    }
  }

  async saveStats(): Promise<void> {
    try {
      await chrome.storage.local.set({ [StorageKey.ONLINE_SPY_STATS]: this._stats });
    } catch (err) {
      console.log('[VKify] Could not save stats:', (err as Error).message);
    }
  }

  async saveUserStatus(): Promise<void> {
    try {
      await chrome.storage.local.set({ [StorageKey.USER_ONLINE_STATUS]: this._userStatus });
    } catch (err) {
      console.log('[VKify] Could not save user status:', (err as Error).message);
    }
  }


  getStats(): { stats: SpyStats; userStatus: Record<string, UserOnlineStatus> } {
    return { stats: this._stats, userStatus: this._userStatus };
  }
}