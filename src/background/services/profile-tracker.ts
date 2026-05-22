import type {
  SpyStats,
  UserProfileSnapshot,
  ProfileSpyLogEntry,
  VKUserRaw,
  ExtensionSettings,
  TrackedUser,
} from '../../types/index.js';
import type { NotificationService } from './notification-service.js';
import { callVKApi, VKTokenManager, isExpectedTokenError } from '../utils/vk-api.js';
import { StorageHelper } from '../utils/storage.js';
import { StorageKey, PROFILE_SPY_SETTINGS_KEYS } from '../../shared/constants/storage-keys.js';
import { AlarmName } from '../../shared/constants/alarms.js';

/**
 * ProfileTracker — фоновый сервис, который периодически опрашивает VK API
 * (`users.get` с полями photo_100/status/counters) для каждого отслеживаемого
 * пользователя и фиксирует изменения:
 *   • смена аватарки (URL photo_100 поменялся);
 *   • смена статуса (поле `status`);
 *   • новые друзья / удалённые друзья (counters.friends дельта).
 *
 * Архитектура параллельна SpyTracker'у (онлайн-мониторинг), но списки
 * отслеживаемых, лог и снимки полностью независимы — это отдельная функция
 * расширения, не пересекается с онлайн-статусом и активностью в сообщениях.
 *
 * Поле `counters` в users.get приходит только если приватность пользователя
 * это разрешает; если оно отсутствует — отслеживание счётчика друзей
 * для этого юзера тихо пропускается.
 */
export class ProfileTracker {
  private _isRunning = false;
  private _stats: SpyStats = { checks: 0, isRunning: false };
  private _snapshots: Record<string, UserProfileSnapshot> = {};

  private readonly notificationService: NotificationService;
  private readonly tokenManager: VKTokenManager;

  constructor(notificationService: NotificationService, tokenManager: VKTokenManager) {
    this.notificationService = notificationService;
    this.tokenManager = tokenManager;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }


  async start(settings: Partial<ExtensionSettings>): Promise<void> {
    if (this._isRunning) return;
    if (!settings.profile_spy) return;

    console.log('[VKify] Starting profile spy...');
    this._isRunning = true;
    this._stats.isRunning = true;
    await this.saveStats();

    // Минимум 0.5 минуты — ограничение Chrome Alarms API.
    const intervalMinutes = Math.max((settings.profile_spy_interval ?? 300) / 60, 0.5);

    await this.checkUsers(settings);
    await chrome.alarms.create(AlarmName.PROFILE_SPY_CHECK, { periodInMinutes: intervalMinutes });

    console.log(`[VKify] Profile spy alarm set for every ${intervalMinutes} minutes`);
  }

  async stop(): Promise<void> {
    console.log('[VKify] Stopping profile spy...');
    this._isRunning = false;
    this._stats.isRunning = false;
    await this.saveStats();
    await chrome.alarms.clear(AlarmName.PROFILE_SPY_CHECK);
  }


  async triggerCheck(settings: Record<string, unknown>): Promise<void> {
    if (!settings['profile_spy'] || !(settings['profile_tracked_users'] as unknown[])?.length) {
      console.log('[VKify] Profile spy disabled, clearing alarm');
      await chrome.alarms.clear(AlarmName.PROFILE_SPY_CHECK);
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

    const settings = await chrome.storage.local.get([...PROFILE_SPY_SETTINGS_KEYS]) as Partial<ExtensionSettings>;

    if (settings.profile_spy && (settings.profile_tracked_users?.length ?? 0) > 0) {
      await this.loadState();
      await this.start(settings);
      console.log('[VKify] Profile spy started with', settings.profile_tracked_users?.length, 'users');
    } else {
      console.log('[VKify] Profile spy not started:',
        !settings.profile_spy ? 'disabled' : 'no users to track');
    }
  }


  async checkUsers(settings: Partial<ExtensionSettings>): Promise<void> {
    try {
      const trackedUsers = settings.profile_tracked_users ?? [];
      if (trackedUsers.length === 0) return;

      const userIds = trackedUsers.map(u => u.id).join(',');
      // `counters` приходит только если пользователь разрешил счётчики в приватности.
      // Поля photo_50 хранится только для отображения в логе/уведомлении.
      const data = await callVKApi(this.tokenManager, 'users.get', {
        user_ids: userIds,
        fields: 'photo_100,photo_50,status,counters',
      }) as VKUserRaw[] | undefined;

      if (!Array.isArray(data)) return;

      this._stats.checks++;
      await this.saveStats();

      const now = Date.now();
      for (const user of data) {
        await this.processUserProfile(user, now, settings, trackedUsers);
      }
      await this.saveSnapshots();

      console.log(`[VKify] Profile spy: checked ${data.length} users, total checks: ${this._stats.checks}`);
    } catch (error) {
      if (isExpectedTokenError(error)) {
        const e = error as { code?: string; message?: string };
        console.log(`[VKify] Profile spy: ${e.code ?? e.message}, will retry next interval`);
      } else {
        console.error('[VKify] Profile spy check failed:', error);
      }
    }
  }

  private async processUserProfile(
    user: VKUserRaw,
    now: number,
    settings: Partial<ExtensionSettings>,
    trackedUsers: TrackedUser[],
  ): Promise<void> {
    const userId = String(user.id);
    const userName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || `ID ${userId}`;

    // `photo_100` имеется почти у всех; status может быть пустой строкой; counters — опционально.
    const currentPhoto  = (user.photo_100 ?? null) as string | null;
    const currentStatus = (typeof user.status === 'string' ? user.status : '') as string;
    const currentFriendsCount =
      (user.counters && typeof user.counters === 'object' && 'friends' in user.counters)
        ? Number((user.counters as { friends?: number }).friends ?? NaN)
        : null;
    const friendsCount = currentFriendsCount !== null && Number.isFinite(currentFriendsCount)
      ? currentFriendsCount
      : null;

    const prev = this._snapshots[userId];

    const nextSnapshot: UserProfileSnapshot = {
      photoUrl: currentPhoto,
      status: currentStatus,
      friendsCount,
      lastChecked: now,
    };

    this._snapshots[userId] = nextSnapshot;

    // Первая фиксация baseline — без событий. Так не сыпем «изменения» при первом подключении.
    if (!prev) return;

    const userInfo = { photo50: (user.photo_50 ?? undefined) as string | undefined };
    const trackedMeta = trackedUsers.find(u => String(u.id) === userId);
    const displayName = trackedMeta?.name || userName;

    const changes: { type: ProfileSpyLogEntry['changeType']; description: string; icon: string; before: string | number | null; after: string | number | null }[] = [];

    if (settings.profile_spy_avatar !== false && currentPhoto && prev.photoUrl && currentPhoto !== prev.photoUrl) {
      changes.push({
        type: 'avatar',
        description: 'сменил аватарку',
        icon: '🖼️',
        before: prev.photoUrl,
        after: currentPhoto,
      });
    }

    if (settings.profile_spy_status !== false && currentStatus !== (prev.status ?? '')) {
      const shortStatus = currentStatus
        ? `«${currentStatus.slice(0, 80)}»${currentStatus.length > 80 ? '…' : ''}`
        : '(пусто)';
      changes.push({
        type: 'status',
        description: `сменил статус на ${shortStatus}`,
        icon: '💬',
        before: prev.status ?? '',
        after: currentStatus,
      });
    }

    if (settings.profile_spy_friends !== false
        && friendsCount !== null
        && prev.friendsCount !== null
        && friendsCount !== prev.friendsCount) {
      const delta = friendsCount - prev.friendsCount;
      if (delta > 0) {
        changes.push({
          type: 'friends_added',
          description: `появилось новых друзей: +${delta}`,
          icon: '👥',
          before: prev.friendsCount,
          after: friendsCount,
        });
      } else {
        changes.push({
          type: 'friends_removed',
          description: `удалил из друзей: ${delta}`, // delta уже отрицательная
          icon: '👤',
          before: prev.friendsCount,
          after: friendsCount,
        });
      }
    }

    if (changes.length === 0) return;

    if (settings.profile_spy_save_log) {
      for (const c of changes) {
        await StorageHelper.saveToProfileSpyLog({
          userId,
          userName: displayName,
          changeType: c.type,
          description: c.description,
          icon: c.icon,
          timestamp: now,
          userInfo,
          before: c.before,
          after: c.after,
        });
      }
    }

    if (settings.profile_spy_browser_notify) {
      // Одно уведомление на пользователя со всеми изменениями — не спамим.
      const message = changes.map(c => `${c.icon} ${c.description}`).join('\n');
      await this.notificationService.show(
        `profile-spy-${userId}-${now}`,
        displayName,
        message,
        1,
      );
    }

    console.log(`[VKify] 👤 ${displayName}: ${changes.map(c => c.description).join('; ')}`);
  }


  async loadState(): Promise<void> {
    try {
      const result = await chrome.storage.local.get([
        StorageKey.PROFILE_SPY_STATS,
        StorageKey.USER_PROFILE_SNAPSHOT,
      ]);

      if (result[StorageKey.PROFILE_SPY_STATS]) {
        this._stats = result[StorageKey.PROFILE_SPY_STATS] as SpyStats;
        this._isRunning = this._stats.isRunning;
      }
      if (result[StorageKey.USER_PROFILE_SNAPSHOT]) {
        this._snapshots = result[StorageKey.USER_PROFILE_SNAPSHOT] as Record<string, UserProfileSnapshot>;
      }
    } catch (err) {
      console.log('[VKify] Could not load profile spy state:', (err as Error).message);
    }
  }

  async saveStats(): Promise<void> {
    try {
      await chrome.storage.local.set({ [StorageKey.PROFILE_SPY_STATS]: this._stats });
    } catch (err) {
      console.log('[VKify] Could not save profile spy stats:', (err as Error).message);
    }
  }

  async saveSnapshots(): Promise<void> {
    try {
      await chrome.storage.local.set({ [StorageKey.USER_PROFILE_SNAPSHOT]: this._snapshots });
    } catch (err) {
      console.log('[VKify] Could not save profile snapshots:', (err as Error).message);
    }
  }


  getStats(): { stats: SpyStats; snapshots: Record<string, UserProfileSnapshot> } {
    return { stats: this._stats, snapshots: this._snapshots };
  }
}