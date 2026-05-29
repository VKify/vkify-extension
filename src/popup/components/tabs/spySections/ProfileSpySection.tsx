import React, { useState } from 'react';
import SettingRow from '../../ui/SettingRow.js';
import RangeSlider from '../../ui/RangeSlider.js';
import SpyLogModal from '../../modals/SpyLogModal.js';
import SpyAddUserModal from './SpyAddUserModal.js';
import { useSettings } from '../../../context/SettingsContext.js';
import { useToast } from '../../../context/ToastContext.js';
import { useProfileSpyStats } from '../../../hooks/features/useProfileSpyStats.js';
import { useSpyTarget } from '../../../hooks/features/useSpyTarget.js';
import { StorageKey } from '../../../../shared/constants/storage-keys.js';
import { downloadText } from '../../../../shared/utils/download.js';
import { spyLogFilename } from '../../../utils/spyLog.js';
import {
  UsersIcon, PlusIcon, XIcon, StopIcon, PlayIcon, ImageIcon,
  MessageIcon, UserPlusIcon, BellIcon, FileTextIcon, ClockIcon, DownloadIcon,
} from '../../icons/Icons.js';
import type { SpyLists } from './types.js';

export default function ProfileSpySection({ lists }: { lists: SpyLists }) {
  const { settings, saveSetting } = useSettings();
  const { showToast } = useToast();
  const { stats, profileLog, clearLog, resetStats } = useProfileSpyStats();
  const target = useSpyTarget(StorageKey.PROFILE_TRACKED_USERS, 'в отслеживание');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);

  const profileSpyOn = settings['profile_spy'] === true;
  const profileSaveLog = settings['profile_spy_save_log'] !== false;
  const trackedUsers = target.trackedUsers;

  const handleToggle = async (): Promise<void> => {
    const enabling = !profileSpyOn;
    await saveSetting('profile_spy', enabling);
    if (enabling) {
      await chrome.runtime.sendMessage({ type: 'START_PROFILE_SPY' });
      showToast('Отслеживание профилей включено', 'success');
    } else {
      await chrome.runtime.sendMessage({ type: 'STOP_PROFILE_SPY' });
      await chrome.storage.local.set({ [StorageKey.PROFILE_SPY_STATS]: { checks: 0, isRunning: false } });
      resetStats();
      showToast('Отслеживание профилей выключено', 'success');
    }
  };

  const handleExport = (): void => {
    const text = profileLog
      .map(e => `[${new Date(e.timestamp).toLocaleString()}] ${e.icon} ${e.userName} (${e.userId}): ${e.description}`)
      .join('\n');
    downloadText(text, spyLogFilename('profile'));
    showToast('Лог экспортирован', 'success');
  };

  return (
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
                {stats.checks > 0 ? `Проверок: ${stats.checks}` : 'Активно'}
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
              {stats.checks > 0 && (
                <div className="text-xs text-[var(--text-secondary)]">
                  Проверок: {stats.checks} • Пользователей: {trackedUsers.length}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => void handleToggle()}
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
                Отслеживаемые пользователи ({trackedUsers.length})
              </span>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Добавить
              </button>
            </div>

            {trackedUsers.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {trackedUsers.map(user => (
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
                      onClick={() => target.removeUser(user.id)}
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

          {trackedUsers.length > 0 && (
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
                    onClick={() => setShowLogModal(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-xl transition-colors"
                  >
                    <ClockIcon className="w-4 h-4" />
                    История ({profileLog.length})
                  </button>
                  <button
                    onClick={handleExport}
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

      {showAddModal && (
        <SpyAddUserModal
          lists={lists}
          target={target}
          title="Добавить в отслеживание профилей"
          onClose={() => setShowAddModal(false)}
        />
      )}

      {showLogModal && (
        <SpyLogModal
          title="История изменений профилей"
          emptyText="Изменений пока нет"
          tone="purple"
          entries={profileLog.map(e => ({
            icon: e.icon,
            userName: e.userName,
            photo50: e.userInfo?.photo50,
            line: e.description,
            timestamp: e.timestamp,
          }))}
          onClear={() => void clearLog().then(() => showToast('Лог очищен', 'success'))}
          onClose={() => setShowLogModal(false)}
        />
      )}
    </section>
  );
}
