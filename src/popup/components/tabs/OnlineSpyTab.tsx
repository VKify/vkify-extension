import React, { useState, useEffect, useCallback } from 'react';
import SettingRow from '../ui/SettingRow.js';
import RangeSlider from '../ui/RangeSlider.js';
import InfoBlock from '../ui/InfoBlock.js';
import WeeklyActivityChart from '../charts/WeeklyActivityChart.js';
import AddUserModal from '../modals/AddUserModal.js';
import SpyLogModal from '../modals/SpyLogModal.js';
import OverallActivityModal from '../modals/OverallActivityModal.js';
import UserActivityModal from '../modals/UserActivityModal.js';
import ActivityComparisonModal from '../modals/ActivityComparisonModal.js';
import { useSettings } from '../../context/SettingsContext.js';
import { useToast } from '../../context/ToastContext.js';
import { useVKApi } from '../../hooks/core/useVKApi.js';
import { useOnlineSpyStats } from '../../hooks/features/useOnlineSpyStats.js';
import { useProfileSpyStats } from '../../hooks/features/useProfileSpyStats.js';
import { useTrackedUsers } from '../../hooks/features/useTrackedUsers.js';
import { useFriends } from '../../hooks/features/useFriends.js';
import { useConversations } from '../../hooks/features/useConversations.js';
import {
  ActivityIcon, TrendingUpIcon, XIcon, PlusIcon,
  BellIcon, FileTextIcon, DownloadIcon, ClockIcon,
  CalendarIcon, UsersIcon, PlayIcon, StopIcon,
  EyeIcon, EyeOffIcon, KeyboardIcon, MicIcon, MessageIcon, TrashIcon,
  EditIcon, PhoneIcon, UserPlusIcon, ImageIcon, OnlinePulseIcon,
} from '../icons/Icons.js';
import { activityKey, StorageKey } from '../../../shared/constants/storage-keys.js';
import type { TrackedUser, ProfileSpyLogEntry } from '../../../types/index.js';
import type { OnlineStatus } from '../../hooks/features/useOnlineSpyStats.js';
import type { FriendItem } from '../../hooks/features/useFriends.js';
import type { ConversationItem } from '../../hooks/features/useConversations.js';


interface ActivitySpyLogEntry {
  icon: string;
  userName: string;
  userId: string;
  action: string;
  timestamp: number;
  userInfo?: { photo50?: string };
  extra?: { text?: string };
}

interface ActivitySpyStats {
  events: number;
  isRunning: boolean;
}


function formatLastSeen(timestamp: number | null): string {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return 'только что';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} мин назад`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ч назад`;
  return new Date(timestamp).toLocaleDateString('ru-RU');
}

function exportOnlineLogToFile(log: { timestamp: number; icon: string; userName: string; userId: string; action: string }[]): void {
  const text = log
    .map(e => `[${new Date(e.timestamp).toLocaleString()}] ${e.icon} ${e.userName} (${e.userId}): ${e.action}`)
    .join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: `vk-online-spy-log-${new Date().toISOString().split('T')[0]}.txt`,
  });
  a.click();
  URL.revokeObjectURL(url);
}

function exportActivityLogToFile(log: ActivitySpyLogEntry[]): void {
  const text = log
    .map(e => `[${new Date(e.timestamp).toLocaleString()}] ${e.icon} ${e.userName} (${e.userId}): ${e.action}`)
    .join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: `vk-activity-spy-log-${new Date().toISOString().split('T')[0]}.txt`,
  });
  a.click();
  URL.revokeObjectURL(url);
}


function NotificationPermissionBanner() {
  const [permission, setPermission] = useState<NotificationPermission>(
    () => ('Notification' in window ? Notification.permission : 'denied'),
  );

  const handleRequest = useCallback(async (): Promise<void> => {
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  if (permission === 'granted') return null;

  return (
    <div className="mx-4 mb-3 p-3 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]">
      {permission === 'denied' ? (
        <p className="text-xs text-error leading-relaxed">
          Уведомления заблокированы браузером. Разрешите их в настройках браузера для этого сайта.
        </p>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Нужно разрешить уведомления браузера для получения оповещений
          </p>
          <button
            onClick={() => void handleRequest()}
            className="flex-shrink-0 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors active:scale-95"
          >
            Разрешить
          </button>
        </div>
      )}
    </div>
  );
}


interface TrackedUserCardProps {
  user: TrackedUser;
  status: OnlineStatus;
  activityData: { timestamp: number; online: boolean }[];
  onShowActivity: (user: TrackedUser) => void;
  onRemove: (id: string) => void;
}

function TrackedUserCard({ user, status, activityData, onShowActivity, onRemove }: TrackedUserCardProps) {
  return (
    <div className="p-3 bg-[var(--bg-secondary)] rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="relative flex-shrink-0">
            {user.photo ? (
              <img src={user.photo} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-medium text-primary">{user.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
            {status.online && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-success border-2 border-[var(--bg-secondary)] rounded-full" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-[var(--text-primary)] truncate">{user.name}</div>
            <div className="text-xs text-[var(--text-tertiary)]">
              {status.online ? (
                <span className="text-success font-medium">В сети</span>
              ) : (
                <span>Был(а) {formatLastSeen(status.lastSeen)}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onShowActivity(user)}
            className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
            title="Подробная статистика"
          >
            <TrendingUpIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onRemove(user.id)}
            className="p-2 text-[var(--text-tertiary)] hover:text-error hover:bg-error/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      {activityData.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[var(--border-color)]/50">
          <WeeklyActivityChart data={activityData} height={40} />
        </div>
      )}
    </div>
  );
}


type OnlineModalKey = 'addUser' | 'log' | 'activity' | 'compare' | 'overall';

export default function OnlineSpyTab() {
  const { settings, saveSetting } = useSettings();
  const { showToast } = useToast();
  const { hasToken, call } = useVKApi();

  const { stats, userOnlineStatus, spyLog: onlineSpyLog, clearLog, resetStats } = useOnlineSpyStats();
  const {
    stats: profileStats,
    profileLog,
    clearLog: clearProfileLog,
    resetStats: resetProfileStats,
  } = useProfileSpyStats();
  const { trackedUsers: onlineTrackedUsers, trackedIds: onlineTrackedIds, addUser, toggleUser, removeUser } = useTrackedUsers();
  const { friends, filtered: filteredFriends, loading: friendsLoading, search: friendsSearch, setSearch, load: loadFriends } = useFriends(hasToken, call);
  const {
    filtered: filteredConversations,
    loading: conversationsLoading,
    search: conversationsSearch,
    setSearch: setConversationsSearch,
    load: loadConversations,
  } = useConversations(hasToken, call);

  const [openOnlineModal, setOpenOnlineModal] = useState<OnlineModalKey | null>(null);
  const [selectedUser, setSelectedUser] = useState<TrackedUser | null>(null);
  const [activityPreviews, setActivityPreviews] = useState<Record<string, { timestamp: number; online: boolean }[]>>({});

  const [activitySpyStats, setActivitySpyStats] = useState<ActivitySpyStats>({ events: 0, isRunning: false });
  const [activitySpyLog, setActivitySpyLog] = useState<ActivitySpyLogEntry[]>([]);
  const [showActivityLogModal, setShowActivityLogModal] = useState(false);
  const [showActivityAddModal, setShowActivityAddModal] = useState(false);

  const [showProfileAddModal, setShowProfileAddModal] = useState(false);
  const [showProfileLogModal, setShowProfileLogModal] = useState(false);

  const profileSpyOn = settings['profile_spy'] === true;
  const profileSaveLog = settings['profile_spy_save_log'] !== false;
  const profileTrackedUsers = (settings['profile_tracked_users'] as TrackedUser[] | undefined) ?? [];
  const profileTrackedIds = new Set(profileTrackedUsers.map(u => String(u.id)));

  const spyOnline = settings['spy_online'] === true;
  const spyEnabled = settings['spy_enabled'] === true;
  const spyMode = (settings['spy_mode'] as string | undefined) ?? 'all';
  const spySaveLog = settings['spy_save_log'] === true;

  const activityTrackedUsers = (settings['spy_tracked_users'] as TrackedUser[] | undefined) ?? [];
  const activityTrackedIds = new Set(activityTrackedUsers.map(u => String(u.id)));
  const onlineUsersCount = onlineTrackedUsers.filter(u => userOnlineStatus[u.id]?.online).length;

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const result = await chrome.storage.local.get(['spy_stats', 'activity_spy_log']);
        if (result['spy_stats']) setActivitySpyStats(result['spy_stats'] as ActivitySpyStats);
        if (result['activity_spy_log']) setActivitySpyLog(result['activity_spy_log'] as ActivitySpyLogEntry[]);
      } catch { /* ignore */ }
    };
    void load();
    const interval = setInterval(() => { void load(); }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!spyOnline) return;
    const load = async (): Promise<void> => {
      const previews: typeof activityPreviews = {};
      for (const user of onlineTrackedUsers) {
        try {
          const result = await chrome.storage.local.get([activityKey(user.id)]);
          previews[user.id] = (result[activityKey(user.id)] as typeof previews[string] | undefined) ?? [];
        } catch {
          previews[user.id] = [];
        }
      }
      setActivityPreviews(previews);
    };
    void load();
  }, [onlineTrackedUsers, spyOnline, stats.checks]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOnlineSpyToggle = async (): Promise<void> => {
    const enabling = !spyOnline;
    await saveSetting('spy_online', enabling);
    if (enabling) {
      await chrome.runtime.sendMessage({ type: 'START_ONLINE_SPY' });
      showToast('Онлайн-слежка включена', 'success');
    } else {
      await chrome.runtime.sendMessage({ type: 'STOP_ONLINE_SPY' });
      await chrome.storage.local.set({ [StorageKey.ONLINE_SPY_STATS]: { checks: 0, isRunning: false } });
      resetStats();
      showToast('Онлайн-слежка выключена', 'success');
    }
  };

  const handleExportOnlineLog = (): void => {
    exportOnlineLogToFile(onlineSpyLog);
    showToast('Лог экспортирован', 'success');
  };

  const handleShowActivity = (user: TrackedUser): void => {
    setSelectedUser(user);
    setOpenOnlineModal('activity');
  };

  const handleToggleOnlineFriend = (friend: FriendItem): void => {
    toggleUser(String(friend.id), friend.name, friend.photo);
  };

  const handleToggleOnlineConversation = (conv: ConversationItem): void => {
    toggleUser(String(conv.id), conv.name, conv.photo);
  };

  const handleActivitySpyToggle = (): void => {
    const newValue = !spyEnabled;
    void saveSetting('spy_enabled', newValue);
    if (!newValue) {
      void chrome.storage.local.set({ spy_stats: { events: 0, isRunning: false } });
      setActivitySpyStats({ events: 0, isRunning: false });
    }
    showToast(newValue ? 'Слежка включена' : 'Слежка выключена', 'success');
  };

  const handleAddActivityUser = (userId: string, name?: string): boolean => {
    const cleanId = userId.trim().replace(/\D/g, '');
    if (!cleanId) { showToast('Некорректный ID', 'error'); return false; }
    if (activityTrackedIds.has(cleanId)) { showToast('Пользователь уже добавлен', 'error'); return false; }
    const newUser: TrackedUser = { id: cleanId, name: name?.trim() || `ID ${cleanId}`, addedAt: Date.now() };
    void saveSetting('spy_tracked_users', [...activityTrackedUsers, newUser]);
    showToast(`${newUser.name} добавлен в слежку`, 'success');
    return true;
  };

  const handleToggleActivityFriend = (friend: FriendItem): void => {
    const friendId = String(friend.id);
    if (activityTrackedIds.has(friendId)) {
      void saveSetting('spy_tracked_users', activityTrackedUsers.filter(u => String(u.id) !== friendId));
    } else {
      const newUser: TrackedUser = { id: friendId, name: friend.name, photo: friend.photo, addedAt: Date.now() };
      void saveSetting('spy_tracked_users', [...activityTrackedUsers, newUser]);
    }
  };

  const handleToggleActivityConversation = (conv: ConversationItem): void => {
    const convId = String(conv.id);
    if (activityTrackedIds.has(convId)) {
      void saveSetting('spy_tracked_users', activityTrackedUsers.filter(u => String(u.id) !== convId));
    } else {
      const newUser: TrackedUser = { id: convId, name: conv.name, photo: conv.photo, addedAt: Date.now() };
      void saveSetting('spy_tracked_users', [...activityTrackedUsers, newUser]);
    }
  };

  const handleRemoveActivityUser = (userId: string): void => {
    void saveSetting('spy_tracked_users', activityTrackedUsers.filter(u => String(u.id) !== String(userId)));
    showToast('Пользователь удалён', 'success');
  };

  const handleClearActivityLog = async (): Promise<void> => {
    await chrome.storage.local.set({ activity_spy_log: [] });
    setActivitySpyLog([]);
    showToast('Лог очищен', 'success');
  };

  const handleExportActivityLog = (): void => {
    exportActivityLogToFile(activitySpyLog);
    showToast('Лог экспортирован', 'success');
  };

  const handleOpenMessages = (): void => {
    void chrome.tabs.create({ url: 'https://vk.com/im' });
  };


  // ── Profile spy: handlers ───────────────────────────────────────────────
  const handleProfileSpyToggle = async (): Promise<void> => {
    const enabling = !profileSpyOn;
    await saveSetting('profile_spy', enabling);
    if (enabling) {
      await chrome.runtime.sendMessage({ type: 'START_PROFILE_SPY' });
      showToast('Отслеживание профилей включено', 'success');
    } else {
      await chrome.runtime.sendMessage({ type: 'STOP_PROFILE_SPY' });
      await chrome.storage.local.set({ [StorageKey.PROFILE_SPY_STATS]: { checks: 0, isRunning: false } });
      resetProfileStats();
      showToast('Отслеживание профилей выключено', 'success');
    }
  };

  const handleAddProfileUser = (userId: string, name?: string): boolean => {
    const cleanId = userId.trim().replace(/\D/g, '');
    if (!cleanId) { showToast('Некорректный ID', 'error'); return false; }
    if (profileTrackedIds.has(cleanId)) { showToast('Пользователь уже добавлен', 'error'); return false; }
    const newUser: TrackedUser = { id: cleanId, name: name?.trim() || `ID ${cleanId}`, addedAt: Date.now() };
    void saveSetting('profile_tracked_users', [...profileTrackedUsers, newUser]);
    showToast(`${newUser.name} добавлен в отслеживание`, 'success');
    return true;
  };

  const handleToggleProfileFriend = (friend: FriendItem): void => {
    const friendId = String(friend.id);
    if (profileTrackedIds.has(friendId)) {
      void saveSetting('profile_tracked_users', profileTrackedUsers.filter(u => String(u.id) !== friendId));
    } else {
      const newUser: TrackedUser = { id: friendId, name: friend.name, photo: friend.photo, addedAt: Date.now() };
      void saveSetting('profile_tracked_users', [...profileTrackedUsers, newUser]);
    }
  };

  const handleToggleProfileConversation = (conv: ConversationItem): void => {
    const convId = String(conv.id);
    if (profileTrackedIds.has(convId)) {
      void saveSetting('profile_tracked_users', profileTrackedUsers.filter(u => String(u.id) !== convId));
    } else {
      const newUser: TrackedUser = { id: convId, name: conv.name, photo: conv.photo, addedAt: Date.now() };
      void saveSetting('profile_tracked_users', [...profileTrackedUsers, newUser]);
    }
  };

  const handleRemoveProfileUser = (userId: string): void => {
    void saveSetting('profile_tracked_users', profileTrackedUsers.filter(u => String(u.id) !== String(userId)));
    showToast('Пользователь удалён', 'success');
  };

  const handleExportProfileLog = (): void => {
    const text = profileLog
      .map(e => `[${new Date(e.timestamp).toLocaleString()}] ${e.icon} ${e.userName} (${e.userId}): ${e.description}`)
      .join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `vk-profile-spy-log-${new Date().toISOString().split('T')[0]}.txt`,
    });
    a.click();
    URL.revokeObjectURL(url);
    showToast('Лог экспортирован', 'success');
  };

  return (
    <div className="space-y-4">

      <section data-vkify-anchor="spy_activity" className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <EyeIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Активность в сообщениях</h3>
              {spyEnabled && (
                <span className="flex items-center gap-1 mt-0.5 text-xs font-medium text-primary">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  {activitySpyStats.events > 0 ? `${activitySpyStats.events} событий` : 'Активно'}
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="text-xs text-[var(--text-secondary)] px-4 pb-3 leading-relaxed">
          Отслеживает активность в переписках: печать, голосовые, прочтение, редактирование и удаление сообщений
        </p>

        <div className="mx-4 mb-3 p-3 bg-[var(--bg-secondary)] rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                spyEnabled ? 'bg-primary/10' : 'bg-[var(--bg-tertiary)]'
              }`}>
                <MessageIcon className={`w-5 h-5 ${spyEnabled ? 'text-primary' : 'text-[var(--text-tertiary)]'}`} />
              </div>
              <div className="text-sm font-medium text-[var(--text-primary)]">
                {spyEnabled ? 'Слежка включена' : 'Слежка выключена'}
              </div>
            </div>
            <button
              onClick={handleActivitySpyToggle}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
                spyEnabled ? 'bg-error text-white' : 'bg-primary text-white'
              }`}
            >
              {spyEnabled ? <StopIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {spyEnabled && (
          <>
            <div className="mx-4 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[var(--text-secondary)]">За кем следить</span>
                <button
                  onClick={() => setShowActivityAddModal(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  Добавить
                </button>
              </div>

              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => void saveSetting('spy_mode', 'all')}
                  className={`flex-1 py-2 px-3 text-xs font-medium rounded-xl transition-all ${
                    spyMode === 'all'
                      ? 'bg-primary text-white'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  За всеми
                </button>
                <button
                  onClick={() => void saveSetting('spy_mode', 'selected')}
                  className={`flex-1 py-2 px-3 text-xs font-medium rounded-xl transition-all ${
                    spyMode === 'selected'
                      ? 'bg-primary text-white'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  Только выбранные ({activityTrackedUsers.length})
                </button>
              </div>

              {activityTrackedUsers.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {activityTrackedUsers.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-2 bg-[var(--bg-secondary)] rounded-xl">
                      <div className="flex items-center gap-2 min-w-0">
                        {user.photo ? (
                          <img src={user.photo} alt={user.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-primary">{user.name.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[var(--text-primary)] truncate">{user.name}</div>
                          <div className="text-xs text-[var(--text-tertiary)]">ID: {user.id}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveActivityUser(user.id)}
                        className="p-1.5 text-[var(--text-tertiary)] hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {activityTrackedUsers.length === 0 && spyMode === 'selected' && (
                <div className="text-center py-4 text-xs text-[var(--text-tertiary)]">
                  Добавьте пользователей для слежки
                </div>
              )}
            </div>

            <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />

            <div className="px-4 pt-3 pb-1">
              <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Типы событий</span>
            </div>

            <SettingRow id="spy_typing"   title="Печатает сообщение"       description="Уведомлять когда пользователь печатает"           icon={<KeyboardIcon  className="w-5 h-5" />} iconColor="purple" />
            <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />
            <SettingRow id="spy_voice"    title="Записывает голосовое"      description="Уведомлять о записи голосового сообщения"          icon={<MicIcon       className="w-5 h-5" />} iconColor="pink"   />
            <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />
            <SettingRow id="spy_uploads"  title="Загружает медиа"           description="Уведомлять о загрузке фото, видео и файлов"        icon={<ImageIcon     className="w-5 h-5" />} iconColor="cyan"   />
            <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />
            <SettingRow id="spy_read"     title="Прочитал сообщение"        description="Уведомлять когда прочитали ваше сообщение"         icon={<EyeIcon       className="w-5 h-5" />} iconColor="blue"   />
            <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />
            <SettingRow id="spy_edit"     title="Редактирование сообщения"  description="Уведомлять когда сообщение отредактировано"        icon={<EditIcon      className="w-5 h-5" />} iconColor="orange" />
            <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />
            <SettingRow id="spy_delete"   title="Удалил сообщение"          description="Уведомлять об удалении сообщений"                  icon={<TrashIcon     className="w-5 h-5" />} iconColor="red"    />
            <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />
            <SettingRow id="spy_messages" title="Новые сообщения"           description="Уведомлять о входящих сообщениях"                  icon={<MessageIcon   className="w-5 h-5" />} iconColor="blue"   />
            <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />
            <SettingRow id="spy_calls"    title="Входящие звонки"           description="Уведомлять о звонках"                              icon={<PhoneIcon     className="w-5 h-5" />} iconColor="green"  />
            <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />
            <SettingRow id="spy_friends"  title="События друзей"            description="Ваши действия с друзьями (приняли заявку, удалили)" icon={<UserPlusIcon  className="w-5 h-5" />} iconColor="orange" />
            <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />
            <SettingRow id="spy_invisibility" title="Включил невидимку"     description="Уведомлять об изменении состояния невидимки друга" icon={<EyeOffIcon    className="w-5 h-5" />} iconColor="purple" />
            <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />
            <SettingRow id="spy_chat_events" title="События в беседах"      description="Вступление, выход и исключение участников беседы" icon={<UsersIcon     className="w-5 h-5" />} iconColor="blue"   />

            <div className="mx-4 my-3 border-t-2 border-dashed border-[var(--border-color)]" />

            <div className="px-4 pb-1">
              <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Уведомления</span>
            </div>

            <SettingRow id="spy_browser_notify" title="Браузерные уведомления" description="Показывать системные уведомления" icon={<BellIcon className="w-5 h-5" />} iconColor="blue" />
            <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />
            <SettingRow id="spy_save_log" title="Записывать лог" description="Сохранять историю событий" icon={<FileTextIcon className="w-5 h-5" />} iconColor="green" />

            {spySaveLog && (
              <div className="mx-4 mb-4 flex gap-2">
                <button
                  onClick={() => setShowActivityLogModal(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-xl transition-colors"
                >
                  <ClockIcon className="w-4 h-4" />
                  История ({activitySpyLog.length})
                </button>
                <button
                  onClick={handleExportActivityLog}
                  disabled={activitySpyLog.length === 0}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  <DownloadIcon className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="mx-4 mb-4">
              <InfoBlock variant="warning" icon="⚠️" title="Важно знать">
                Слежка работает только пока открыта вкладка VK в вашем браузере.
                При закрытии вкладки отслеживание событий прекратится.
              </InfoBlock>
            </div>
          </>
        )}

        <div className="p-4 pt-2">
          <button
            onClick={handleOpenMessages}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary/10 hover:bg-primary/15 text-primary font-medium rounded-xl transition-colors active:scale-[0.98]"
          >
            <MessageIcon className="w-5 h-5" />
            Открыть сообщения
          </button>
        </div>
      </section>

      <section data-vkify-anchor="spy_online" className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <ActivityIcon className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Онлайн-мониторинг</h3>
              {spyOnline && (
                <span className="flex items-center gap-1 mt-0.5 text-xs font-medium text-emerald-500">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  {stats.checks > 0 ? `${onlineUsersCount}/${onlineTrackedUsers.length} в сети` : 'Активно'}
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="text-xs text-[var(--text-secondary)] px-4 pb-3 leading-relaxed">
          Отслеживает когда пользователи заходят в сеть и выходят из неё.
          Собирает статистику активности и показывает графики.
        </p>

        <div className="mx-4 mb-3 p-3 bg-[var(--bg-secondary)] rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                spyOnline ? 'bg-emerald-500/10' : 'bg-[var(--bg-tertiary)]'
              }`}>
                <OnlinePulseIcon className={`w-5 h-5 ${spyOnline ? 'text-emerald-500' : 'text-[var(--text-tertiary)]'}`} />
              </div>
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  {spyOnline ? 'Слежка включена' : 'Слежка выключена'}
                </div>
                {stats.checks > 0 && (
                  <div className="text-xs text-[var(--text-secondary)]">
                    Проверок: {stats.checks} • Онлайн: {onlineUsersCount}/{onlineTrackedUsers.length}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => void handleOnlineSpyToggle()}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
                spyOnline ? 'bg-error text-white' : 'bg-emerald-500 text-white'
              }`}
            >
              {spyOnline ? <StopIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {spyOnline && (
          <>
            {onlineTrackedUsers.length >= 2 && (
              <div className="mx-4 mb-3 flex gap-2">
                <button
                  onClick={() => setOpenOnlineModal('overall')}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-xl transition-colors"
                >
                  <CalendarIcon className="w-4 h-4" />
                  Общий график
                </button>
                <button
                  onClick={() => setOpenOnlineModal('compare')}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-xl transition-colors"
                >
                  <UsersIcon className="w-4 h-4" />
                  Сравнить
                </button>
              </div>
            )}

            <div className="mx-4 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Отслеживаемые пользователи ({onlineTrackedUsers.length})
                </span>
                <button
                  onClick={() => setOpenOnlineModal('addUser')}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  Добавить
                </button>
              </div>

              {onlineTrackedUsers.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {onlineTrackedUsers.map(user => (
                    <TrackedUserCard
                      key={user.id}
                      user={user}
                      status={userOnlineStatus[user.id] ?? { online: false, lastSeen: null }}
                      activityData={activityPreviews[user.id] ?? []}
                      onShowActivity={handleShowActivity}
                      onRemove={removeUser}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-[var(--bg-secondary)] rounded-xl">
                  <ActivityIcon className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-2" />
                  <p className="text-sm text-[var(--text-tertiary)] mb-1">Нет отслеживаемых пользователей</p>
                  <p className="text-xs text-[var(--text-tertiary)]">Добавьте друзей для отслеживания их активности</p>
                </div>
              )}
            </div>

            {onlineTrackedUsers.length > 0 && (
              <>
                <div className="mx-4 border-t border-[var(--border-color)]" />
                <div className="px-4 pt-3 pb-1">
                  <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                    Настройки отслеживания
                  </span>
                </div>

                <div className="mx-4 mb-3">
                  <RangeSlider
                    id="spy_online_interval"
                    label="Интервал проверки"
                    value={(settings['spy_online_interval'] as number | undefined) ?? 60}
                    min={30}
                    max={300}
                    step={30}
                    unit=" сек"
                    onChange={value => void saveSetting('spy_online_interval', value)}
                  />
                  <p className="text-xs text-[var(--text-tertiary)] mt-1 text-center">
                    Рекомендуется 60 секунд или больше
                  </p>
                </div>

                <div className="mx-4 border-t border-[var(--border-color)]" />
                <SettingRow
                  id="spy_browser_notify"
                  title="Уведомления"
                  description="Показывать когда пользователь в сети"
                  icon={<BellIcon className="w-5 h-5" />}
                  iconColor="blue"
                />
                {settings['spy_browser_notify'] === true && <NotificationPermissionBanner />}
                <div className="mx-4 border-t border-[var(--border-color)]" />
                <SettingRow
                  id="spy_save_log"
                  title="Записывать лог"
                  description="Сохранять историю онлайн-событий"
                  icon={<FileTextIcon className="w-5 h-5" />}
                  iconColor="green"
                />

                {spySaveLog && (
                  <div className="mx-4 mb-4 flex gap-2">
                    <button
                      onClick={() => setOpenOnlineModal('log')}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-xl transition-colors"
                    >
                      <ClockIcon className="w-4 h-4" />
                      История ({onlineSpyLog.length})
                    </button>
                    <button
                      onClick={handleExportOnlineLog}
                      disabled={onlineSpyLog.length === 0}
                      className="flex items-center justify-center gap-2 py-2.5 px-4 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                    >
                      <DownloadIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>

      <section data-vkify-anchor="profile_spy" className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
              <UsersIcon className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Отслеживание профилей</h3>
              {profileSpyOn && (
                <span className="flex items-center gap-1 mt-0.5 text-xs font-medium text-purple-500">
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
                  {profileStats.checks > 0 ? `Проверок: ${profileStats.checks}` : 'Активно'}
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="text-xs text-[var(--text-secondary)] px-4 pb-3 leading-relaxed">
          Отслеживает изменения профиля через VK API: смена аватарки,
          смена статуса и появление новых друзей.
        </p>

        <div className="mx-4 mb-3 p-3 bg-[var(--bg-secondary)] rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                profileSpyOn ? 'bg-purple-500/10' : 'bg-[var(--bg-tertiary)]'
              }`}>
                <UsersIcon className={`w-5 h-5 ${profileSpyOn ? 'text-purple-500' : 'text-[var(--text-tertiary)]'}`} />
              </div>
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  {profileSpyOn ? 'Отслеживание включено' : 'Отслеживание выключено'}
                </div>
                {profileStats.checks > 0 && (
                  <div className="text-xs text-[var(--text-secondary)]">
                    Проверок: {profileStats.checks} • Пользователей: {profileTrackedUsers.length}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => void handleProfileSpyToggle()}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
                profileSpyOn ? 'bg-error text-white' : 'bg-purple-500 text-white'
              }`}
            >
              {profileSpyOn ? <StopIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {profileSpyOn && (
          <>
            <div className="mx-4 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Отслеживаемые пользователи ({profileTrackedUsers.length})
                </span>
                <button
                  onClick={() => setShowProfileAddModal(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  Добавить
                </button>
              </div>

              {profileTrackedUsers.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {profileTrackedUsers.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-2 bg-[var(--bg-secondary)] rounded-xl">
                      <div className="flex items-center gap-2 min-w-0">
                        {user.photo ? (
                          <img src={user.photo} alt={user.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-purple-500">{user.name.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[var(--text-primary)] truncate">{user.name}</div>
                          <div className="text-xs text-[var(--text-tertiary)]">ID: {user.id}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveProfileUser(user.id)}
                        className="p-1.5 text-[var(--text-tertiary)] hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 bg-[var(--bg-secondary)] rounded-xl">
                  <UsersIcon className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-2" />
                  <p className="text-xs text-[var(--text-tertiary)]">Добавьте пользователей для отслеживания</p>
                </div>
              )}
            </div>

            {profileTrackedUsers.length > 0 && (
              <>
                <div className="mx-4 border-t border-[var(--border-color)]" />
                <div className="px-4 pt-3 pb-1">
                  <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                    Что отслеживать
                  </span>
                </div>

                <SettingRow id="profile_spy_avatar"
                            title="Смена аватарки"
                            description="Уведомлять, когда пользователь сменил аватарку"
                            icon={<ImageIcon className="w-5 h-5" />} iconColor="cyan" />
                <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />
                <SettingRow id="profile_spy_status"
                            title="Смена статуса"
                            description="Уведомлять об изменении строки статуса"
                            icon={<MessageIcon className="w-5 h-5" />} iconColor="blue" />
                <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />
                <SettingRow id="profile_spy_friends"
                            title="Новые друзья"
                            description="Уведомлять, когда счётчик друзей изменился"
                            icon={<UserPlusIcon className="w-5 h-5" />} iconColor="purple" />

                <div className="mx-4 border-t border-[var(--border-color)]" />

                <div className="mx-4 my-3">
                  <RangeSlider
                    id="profile_spy_interval"
                    label="Интервал проверки"
                    value={(settings['profile_spy_interval'] as number | undefined) ?? 300}
                    min={60}
                    max={1800}
                    step={60}
                    unit=" сек"
                    onChange={value => void saveSetting('profile_spy_interval', value)}
                  />
                  <p className="text-xs text-[var(--text-tertiary)] mt-1 text-center">
                    Рекомендуется 5–15 минут — VK API ограничивает частоту запросов
                  </p>
                </div>

                <div className="mx-4 border-t border-[var(--border-color)]" />
                <SettingRow
                  id="profile_spy_browser_notify"
                  title="Уведомления"
                  description="Показывать системные уведомления об изменениях"
                  icon={<BellIcon className="w-5 h-5" />}
                  iconColor="blue"
                />
                <div className="mx-4 border-t border-[var(--border-color)]" />
                <SettingRow
                  id="profile_spy_save_log"
                  title="Записывать лог"
                  description="Сохранять историю изменений профилей"
                  icon={<FileTextIcon className="w-5 h-5" />}
                  iconColor="green"
                />

                {profileSaveLog && (
                  <div className="mx-4 mb-4 flex gap-2">
                    <button
                      onClick={() => setShowProfileLogModal(true)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-xl transition-colors"
                    >
                      <ClockIcon className="w-4 h-4" />
                      История ({profileLog.length})
                    </button>
                    <button
                      onClick={handleExportProfileLog}
                      disabled={profileLog.length === 0}
                      className="flex items-center justify-center gap-2 py-2.5 px-4 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                    >
                      <DownloadIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>

      <InfoBlock variant="info" icon="ℹ️" title="Как это работает">
        Онлайн-мониторинг проверяет статус пользователей через VK API с выбранным интервалом.
        Данные о посещениях сохраняются в течение 7 дней для построения графиков активности.
      </InfoBlock>

      {showActivityAddModal && (
        <AddUserModal
          trackedIds={activityTrackedIds}
          hasToken={hasToken}
          friends={friends}
          friendsLoading={friendsLoading}
          friendsSearch={friendsSearch}
          filteredFriends={filteredFriends}
          trackedUsersCount={activityTrackedUsers.length}
          onSearchChange={setSearch}
          onLoadFriends={() => void loadFriends()}
          onToggleFriend={handleToggleActivityFriend}
          onAddManual={handleAddActivityUser}
          onClose={() => setShowActivityAddModal(false)}
          conversations={filteredConversations}
          conversationsLoading={conversationsLoading}
          conversationsSearch={conversationsSearch}
          filteredConversations={filteredConversations}
          onConversationSearchChange={setConversationsSearch}
          onLoadConversations={() => void loadConversations()}
          onToggleConversation={handleToggleActivityConversation}
        />
      )}

      {showActivityLogModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-md shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">История событий</h3>
              <button onClick={() => setShowActivityLogModal(false)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {activitySpyLog.length === 0 ? (
                <div className="text-center py-8 text-sm text-[var(--text-tertiary)]">Событий пока нет</div>
              ) : (
                <div className="space-y-2">
                  {activitySpyLog.slice().reverse().map((entry, index) => (
                    <div key={index} className="p-3 bg-[var(--bg-secondary)] rounded-xl">
                      <div className="flex items-start gap-3">
                        {entry.userInfo?.photo50 ? (
                          <img src={entry.userInfo.photo50} alt={entry.userName} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-primary">{entry.userName?.charAt(0)?.toUpperCase() ?? '?'}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{entry.icon}</span>
                            <span className="text-sm font-medium text-[var(--text-primary)] truncate">{entry.userName}</span>
                          </div>
                          <div className="text-xs text-[var(--text-secondary)] mt-0.5">{entry.action}</div>
                          {entry.extra?.text && (
                            <div className="text-xs text-[var(--text-tertiary)] mt-1.5 p-2 bg-[var(--bg-tertiary)] rounded-lg italic line-clamp-2">
                              &ldquo;{entry.extra.text}&rdquo;
                            </div>
                          )}
                          <div className="text-xs text-[var(--text-tertiary)] mt-1.5 opacity-60">
                            {new Date(entry.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3 p-4 border-t border-[var(--border-color)]">
              <button
                onClick={() => void handleClearActivityLog()}
                disabled={activitySpyLog.length === 0}
                className="flex-1 py-2.5 text-sm font-medium text-error bg-error/10 hover:bg-error/20 rounded-xl transition-colors disabled:opacity-50"
              >
                Очистить
              </button>
              <button
                onClick={() => setShowActivityLogModal(false)}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {openOnlineModal === 'addUser' && (
        <AddUserModal
          trackedIds={onlineTrackedIds}
          hasToken={hasToken}
          friends={friends}
          friendsLoading={friendsLoading}
          friendsSearch={friendsSearch}
          filteredFriends={filteredFriends}
          trackedUsersCount={onlineTrackedUsers.length}
          onSearchChange={setSearch}
          onLoadFriends={() => void loadFriends()}
          onToggleFriend={handleToggleOnlineFriend}
          onAddManual={addUser}
          onClose={() => setOpenOnlineModal(null)}
          conversations={filteredConversations}
          conversationsLoading={conversationsLoading}
          conversationsSearch={conversationsSearch}
          filteredConversations={filteredConversations}
          onConversationSearchChange={setConversationsSearch}
          onLoadConversations={() => void loadConversations()}
          onToggleConversation={handleToggleOnlineConversation}
        />
      )}

      {openOnlineModal === 'log' && (
        <SpyLogModal
          log={onlineSpyLog}
          onClear={clearLog}
          onExport={handleExportOnlineLog}
          onClose={() => setOpenOnlineModal(null)}
        />
      )}

      {openOnlineModal === 'activity' && selectedUser && (
        <UserActivityModal
          user={selectedUser}
          onClose={() => { setOpenOnlineModal(null); setSelectedUser(null); }}
        />
      )}

      {openOnlineModal === 'compare' && (
        <ActivityComparisonModal
          users={onlineTrackedUsers}
          onClose={() => setOpenOnlineModal(null)}
        />
      )}

      {openOnlineModal === 'overall' && (
        <OverallActivityModal
          users={onlineTrackedUsers}
          onClose={() => setOpenOnlineModal(null)}
        />
      )}

      {showProfileAddModal && (
        <AddUserModal
          title="Добавить в отслеживание профилей"
          trackedIds={profileTrackedIds}
          hasToken={hasToken}
          friends={friends}
          friendsLoading={friendsLoading}
          friendsSearch={friendsSearch}
          filteredFriends={filteredFriends}
          trackedUsersCount={profileTrackedUsers.length}
          onSearchChange={setSearch}
          onLoadFriends={() => void loadFriends()}
          onToggleFriend={handleToggleProfileFriend}
          onAddManual={handleAddProfileUser}
          onClose={() => setShowProfileAddModal(false)}
          conversations={filteredConversations}
          conversationsLoading={conversationsLoading}
          conversationsSearch={conversationsSearch}
          filteredConversations={filteredConversations}
          onConversationSearchChange={setConversationsSearch}
          onLoadConversations={() => void loadConversations()}
          onToggleConversation={handleToggleProfileConversation}
        />
      )}

      {showProfileLogModal && (
        <ProfileLogModal
          log={profileLog}
          onClear={() => void clearProfileLog().then(() => showToast('Лог очищен', 'success'))}
          onClose={() => setShowProfileLogModal(false)}
        />
      )}

    </div>
  );
}


function ProfileLogModal({
  log,
  onClear,
  onClose,
}: {
  log: ProfileSpyLogEntry[];
  onClear: () => void;
  onClose: () => void;
}): React.ReactElement {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-md shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">История изменений профилей</h3>
          <button onClick={onClose} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {log.length === 0 ? (
            <div className="text-center py-8 text-sm text-[var(--text-tertiary)]">Изменений пока нет</div>
          ) : (
            <div className="space-y-2">
              {log.slice().reverse().map((entry, index) => (
                <div key={index} className="p-3 bg-[var(--bg-secondary)] rounded-xl">
                  <div className="flex items-start gap-3">
                    {entry.userInfo?.photo50 ? (
                      <img src={entry.userInfo.photo50} alt={entry.userName} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-medium text-purple-500">{entry.userName?.charAt(0)?.toUpperCase() ?? '?'}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{entry.icon}</span>
                        <span className="text-sm font-medium text-[var(--text-primary)] truncate">{entry.userName}</span>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5">{entry.description}</div>
                      <div className="text-xs text-[var(--text-tertiary)] mt-1.5 opacity-60">
                        {new Date(entry.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-3 p-4 border-t border-[var(--border-color)]">
          <button
            onClick={onClear}
            disabled={log.length === 0}
            className="flex-1 py-2.5 text-sm font-medium text-error bg-error/10 hover:bg-error/20 rounded-xl transition-colors disabled:opacity-50"
          >
            Очистить
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}