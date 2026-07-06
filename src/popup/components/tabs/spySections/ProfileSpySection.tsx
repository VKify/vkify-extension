import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '../../ui/SettingRow.js';
import RangeSlider from '../../ui/RangeSlider.js';
import SpyLogModal from '../../modals/SpyLogModal.js';
import SpyAddUserModal from './SpyAddUserModal.js';
import SpyLogButtons from './SpyLogButtons.js';
import TrackedUserRow from './TrackedUserRow.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { sendMessage } from '@/shared/messaging.js';
import { useToast } from '@/popup/context/ToastContext.js';
import { useProfileSpyStats } from '@/popup/hooks/features/useProfileSpyStats.js';
import { useSpyTarget } from '@/popup/hooks/features/useSpyTarget.js';
import { StorageKey } from '@/shared/constants/storage-keys.js';
import { downloadText } from '@/shared/utils/download.js';
import { spyLogFilename } from '@/popup/utils/spyLog.js';
import { setStorage } from '@/popup/utils/storageClient.js';
import {
  UsersIcon, PlusIcon, StopIcon, PlayIcon, ImageIcon,
  MessageIcon, UserPlusIcon, BellIcon, FileTextIcon,
} from '../../icons/Icons.js';
import type { SpyLists } from './types.js';

export default function ProfileSpySection({ lists, asPage = false }: { lists: SpyLists; asPage?: boolean }) {
  const { t } = useTranslation('spy');
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const { showToast } = useToast();
  const { stats, profileLog, clearLog, resetStats } = useProfileSpyStats();
  const target = useSpyTarget(StorageKey.PROFILE_TRACKED_USERS, t('suffix.profile'));

  const [showAddModal, setShowAddModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);

  const profileSpyOn = settings['profile_spy'] === true;
  const profileSaveLog = settings['profile_spy_save_log'] !== false;
  const trackedUsers = target.trackedUsers;

  const handleToggle = async (): Promise<void> => {
    const enabling = !profileSpyOn;
    await saveSetting('profile_spy', enabling);
    if (enabling) {
      await sendMessage({ type: 'START_PROFILE_SPY' });
      showToast(t('profile.toast_on'), 'success');
    } else {
      await sendMessage({ type: 'STOP_PROFILE_SPY' });
      await setStorage({ [StorageKey.PROFILE_SPY_STATS]: { checks: 0, isRunning: false } });
      resetStats();
      showToast(t('profile.toast_off'), 'success');
    }
  };

  const handleExport = (): void => {
    const text = profileLog
      .map(e => `[${new Date(e.timestamp).toLocaleString()}] ${e.icon} ${e.userName} (${e.userId}): ${e.description}`)
      .join('\n');
    downloadText(text, spyLogFilename('profile'));
    showToast(t('log_exported'), 'success');
  };

  return (
    <section
      {...(asPage ? {} : { 'data-vkify-anchor': 'profile_spy' })}
      className={`bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden ${asPage ? 'pt-2' : ''}`}
    >
      {!asPage && (
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
              <UsersIcon className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">{t('nav.profile.title')}</h3>
              {profileSpyOn && (
                <span className="flex items-center gap-1 mt-0.5 text-xs font-medium text-purple-500">
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
                  {stats.checks > 0 ? t('profile.checks_only', { count: stats.checks }) : t('active')}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-[var(--text-secondary)] px-4 pb-3 pt-1 leading-relaxed">
        {t('profile.intro')}
      </p>

      <div className="mx-4 mb-3 p-3 bg-[var(--bg-secondary)] rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-1 ring-inset ${
              profileSpyOn ? 'bg-purple-500/10 ring-purple-500/20' : 'bg-[var(--bg-tertiary)] ring-[var(--border-color)]'
            }`}>
              <UsersIcon className={`w-5 h-5 ${profileSpyOn ? 'text-purple-500' : 'text-[var(--text-tertiary)]'}`} />
            </div>
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">
                {profileSpyOn ? t('profile.on') : t('profile.off')}
              </div>
              {stats.checks > 0 && (
                <div className="text-xs text-[var(--text-secondary)]">
                  {t('profile.stats', { checks: stats.checks, count: trackedUsers.length })}
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
                {t('tracked_users', { count: trackedUsers.length })}
              </span>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                {t('add')}
              </button>
            </div>

            {trackedUsers.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {trackedUsers.map(user => (
                  <TrackedUserRow key={user.id} user={user} onRemove={target.removeUser} tone="purple" />
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-[var(--bg-secondary)] rounded-xl">
                <UsersIcon className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-2" />
                <p className="text-xs text-[var(--text-tertiary)]">{t('profile.add_hint')}</p>
              </div>
            )}
          </div>

          {trackedUsers.length > 0 && (
            <>
              <div className="mx-4 border-t border-[var(--border-color)]" />
              <div className="px-4 pt-3 pb-1">
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  {t('profile.what')}
                </span>
              </div>

              <SettingRow id="profile_spy_avatar"
                          title={t('profile.avatar.title')}
                          description={t('profile.avatar.desc')}
                          icon={<ImageIcon className="w-5 h-5" />} iconColor="cyan" />
              <div className="mx-3 border-t border-[var(--border-color)]" />
              <SettingRow id="profile_spy_status"
                          title={t('profile.status.title')}
                          description={t('profile.status.desc')}
                          icon={<MessageIcon className="w-5 h-5" />} iconColor="blue" />
              <div className="mx-3 border-t border-[var(--border-color)]" />
              <SettingRow id="profile_spy_friends"
                          title={t('profile.friends.title')}
                          description={t('profile.friends.desc')}
                          icon={<UserPlusIcon className="w-5 h-5" />} iconColor="purple" />

              <div className="mx-4 border-t border-[var(--border-color)]" />

              <div className="mx-4 my-3">
                <RangeSlider
                  id="profile_spy_interval"
                  label={t('interval')}
                  value={(settings['profile_spy_interval'] as number | undefined) ?? 300}
                  min={60}
                  max={1800}
                  step={60}
                  unit={t('unit_sec')}
                  onChange={value => void saveSetting('profile_spy_interval', value)}
                />
                <p className="text-xs text-[var(--text-tertiary)] mt-1 text-center">
                  {t('profile.interval_hint')}
                </p>
              </div>

              <div className="mx-4 border-t border-[var(--border-color)]" />
              <SettingRow
                id="profile_spy_browser_notify"
                title={t('notify')}
                description={t('profile.notify_desc')}
                icon={<BellIcon className="w-5 h-5" />}
                iconColor="blue"
              />
              <div className="mx-4 border-t border-[var(--border-color)]" />
              <SettingRow
                id="profile_spy_save_log"
                title={t('save_log')}
                description={t('profile.save_log_desc')}
                icon={<FileTextIcon className="w-5 h-5" />}
                iconColor="green"
              />

              {profileSaveLog && (
                <SpyLogButtons count={profileLog.length} onOpenLog={() => setShowLogModal(true)} onExport={handleExport} />
              )}
            </>
          )}
        </>
      )}

      {showAddModal && (
        <SpyAddUserModal
          lists={lists}
          target={target}
          title={t('profile.modal_title')}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {showLogModal && (
        <SpyLogModal
          title={t('profile.log_title')}
          emptyText={t('profile.log_empty')}
          tone="purple"
          entries={profileLog.map(e => ({
            icon: e.icon,
            userName: e.userName,
            photo50: e.userInfo?.photo50,
            line: e.description,
            timestamp: e.timestamp,
          }))}
          onClear={() => void clearLog().then(() => showToast(t('log_cleared'), 'success'))}
          onExport={handleExport}
          onClose={() => setShowLogModal(false)}
        />
      )}
    </section>
  );
}
