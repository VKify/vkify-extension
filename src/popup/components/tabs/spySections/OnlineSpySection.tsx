import React, { useState, useEffect, useCallback } from 'react';
import SettingRow from '../../ui/SettingRow.js';
import RangeSlider from '../../ui/RangeSlider.js';
import WeeklyActivityChart from '../../charts/WeeklyActivityChart.js';
import SpyLogModal from '../../modals/SpyLogModal.js';
import UserActivityModal from '../../modals/UserActivityModal.js';
import ActivityComparisonModal from '../../modals/ActivityComparisonModal.js';
import OverallActivityModal from '../../modals/OverallActivityModal.js';
import SpyAddUserModal from './SpyAddUserModal.js';
import SpyLogButtons from './SpyLogButtons.js';
import { useSettings } from '../../../context/SettingsContext.js';
import { useToast } from '../../../context/ToastContext.js';
import { useOnlineSpyStats } from '../../../hooks/features/useOnlineSpyStats.js';
import { useTrackedUsers } from '../../../hooks/features/useTrackedUsers.js';
import { activityKey, StorageKey } from '../../../../shared/constants/storage-keys.js';
import { downloadText } from '../../../../shared/utils/download.js';
import { formatSpyLog, spyLogFilename } from '../../../utils/spyLog.js';
import {
  ActivityIcon, TrendingUpIcon, XIcon, PlusIcon, BellIcon, FileTextIcon,
  CalendarIcon, UsersIcon, PlayIcon, StopIcon, OnlinePulseIcon,
} from '../../icons/Icons.js';
import type { TrackedUser } from '../../../../types/index.js';
import type { OnlineStatus } from '../../../hooks/features/useOnlineSpyStats.js';
import type { SpyLists } from './types.js';

function formatLastSeen(timestamp: number | null): string {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return 'только что';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} мин назад`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ч назад`;
  return new Date(timestamp).toLocaleDateString('ru-RU');
}

// Примечание: раньше здесь был NotificationPermissionBanner, который проверял
// Web Notification API (`Notification.permission`). Он удалён: фактические
// уведомления спая показывает background через `chrome.notifications` (право
// `notifications` в манифесте, выдаётся всегда) — Web-разрешение origin'а
// попапа к этому отношения не имеет. На Firefox у extension-страниц
// `Notification.permission === 'denied'` по умолчанию, из-за чего баннер давал
// ложное «уведомления заблокированы».

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

export default function OnlineSpySection({ lists }: { lists: SpyLists }) {
  const { settings, saveSetting } = useSettings();
  const { showToast } = useToast();
  const { stats, userOnlineStatus, spyLog, clearLog, resetStats } = useOnlineSpyStats();
  const target = useTrackedUsers();
  const trackedUsers = target.trackedUsers;

  const [openModal, setOpenModal] = useState<OnlineModalKey | null>(null);
  const [selectedUser, setSelectedUser] = useState<TrackedUser | null>(null);
  const [activityPreviews, setActivityPreviews] = useState<Record<string, { timestamp: number; online: boolean }[]>>({});

  const spyOnline = settings['spy_online'] === true;
  const spySaveLog = settings['spy_save_log'] === true;
  const onlineUsersCount = trackedUsers.filter(u => userOnlineStatus[u.id]?.online).length;

  useEffect(() => {
    if (!spyOnline) return;
    const load = async (): Promise<void> => {
      const previews: typeof activityPreviews = {};
      for (const user of trackedUsers) {
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
  }, [trackedUsers, spyOnline, stats.checks]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = async (): Promise<void> => {
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

  const handleExport = (): void => {
    downloadText(formatSpyLog(spyLog), spyLogFilename('online'));
    showToast('Лог экспортирован', 'success');
  };

  const handleShowActivity = (user: TrackedUser): void => {
    setSelectedUser(user);
    setOpenModal('activity');
  };

  return (
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
                {stats.checks > 0 ? `${onlineUsersCount}/${trackedUsers.length} в сети` : 'Активно'}
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
                  Проверок: {stats.checks} • Онлайн: {onlineUsersCount}/{trackedUsers.length}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => void handleToggle()}
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
          {trackedUsers.length >= 2 && (
            <div className="mx-4 mb-3 flex gap-2">
              <button
                onClick={() => setOpenModal('overall')}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-xl transition-colors"
              >
                <CalendarIcon className="w-4 h-4" />
                Общий график
              </button>
              <button
                onClick={() => setOpenModal('compare')}
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
                Отслеживаемые пользователи ({trackedUsers.length})
              </span>
              <button
                onClick={() => setOpenModal('addUser')}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Добавить
              </button>
            </div>

            {trackedUsers.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {trackedUsers.map(user => (
                  <TrackedUserCard
                    key={user.id}
                    user={user}
                    status={userOnlineStatus[user.id] ?? { online: false, lastSeen: null }}
                    activityData={activityPreviews[user.id] ?? []}
                    onShowActivity={handleShowActivity}
                    onRemove={target.removeUser}
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

          {trackedUsers.length > 0 && (
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
              <div className="mx-4 border-t border-[var(--border-color)]" />
              <SettingRow
                id="spy_save_log"
                title="Записывать лог"
                description="Сохранять историю онлайн-событий"
                icon={<FileTextIcon className="w-5 h-5" />}
                iconColor="green"
              />

              {spySaveLog && (
                <SpyLogButtons count={spyLog.length} onOpenLog={() => setOpenModal('log')} onExport={handleExport} />
              )}
            </>
          )}
        </>
      )}

      {openModal === 'addUser' && (
        <SpyAddUserModal lists={lists} target={target} onClose={() => setOpenModal(null)} />
      )}

      {openModal === 'log' && (
        <SpyLogModal
          entries={spyLog.map(e => ({
            icon: e.icon,
            userName: e.userName,
            photo50: e.userInfo?.photo50,
            line: e.action,
            timestamp: e.timestamp,
          }))}
          onClear={clearLog}
          onExport={handleExport}
          onClose={() => setOpenModal(null)}
        />
      )}

      {openModal === 'activity' && selectedUser && (
        <UserActivityModal
          user={selectedUser}
          onClose={() => { setOpenModal(null); setSelectedUser(null); }}
        />
      )}

      {openModal === 'compare' && (
        <ActivityComparisonModal users={trackedUsers} onClose={() => setOpenModal(null)} />
      )}

      {openModal === 'overall' && (
        <OverallActivityModal users={trackedUsers} onClose={() => setOpenModal(null)} />
      )}
    </section>
  );
}
