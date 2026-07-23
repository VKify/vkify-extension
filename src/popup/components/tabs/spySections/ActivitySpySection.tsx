import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '../../ui/SettingRow.js';
import InfoBlock from '../../ui/InfoBlock.js';
import SpyLogModal from '../../modals/SpyLogModal.js';
import SpyAddUserModal from './SpyAddUserModal.js';
import SpyLogButtons from './SpyLogButtons.js';
import TrackedUserRow from './TrackedUserRow.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { useToast } from '@/popup/context/ToastContext.js';
import { useSpyTarget } from '@/popup/hooks/features/useSpyTarget.js';
import { useStorageReload } from '@/popup/hooks/core/useStorageReload.js';
import { getStorage, setStorage } from '@/popup/utils/storageClient.js';
import { downloadText } from '@/shared/utils/download.js';
import { formatSpyLog, spyLogFilename } from '@/popup/utils/spyLog.js';
import {
  EyeIcon, MessageIcon, StopIcon, PlayIcon, PlusIcon, KeyboardIcon,
  MicIcon, ImageIcon, EditIcon, TrashIcon, PhoneIcon, UserPlusIcon, EyeOffIcon,
  UsersIcon, BellIcon, FileTextIcon, ReadCheckIcon, WarningIcon,
} from '../../icons/Icons.js';
import type { SpyLists } from './types.js';
import { openTab } from '@/popup/utils/tabs.js';

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

const WATCHED_KEYS = ['spy_stats', 'activity_spy_log'];

export default function ActivitySpySection({ lists, asPage = false }: { lists: SpyLists; asPage?: boolean }) {
  const { t } = useTranslation('spy');
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const { showToast } = useToast();
  const target = useSpyTarget('spy_tracked_users', t('suffix.watch'));

  const [stats, setStats] = useState<ActivitySpyStats>({ events: 0, isRunning: false });
  const [log, setLog] = useState<ActivitySpyLogEntry[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const result = await getStorage(['spy_stats', 'activity_spy_log']);
      if (result['spy_stats']) setStats(result['spy_stats'] as ActivitySpyStats);
      if (result['activity_spy_log']) setLog(result['activity_spy_log'] as ActivitySpyLogEntry[]);
    } catch { /* ignore */ }
  }, []);

  useStorageReload(WATCHED_KEYS, reload);

  const spyEnabled = settings['spy_enabled'] === true;
  const spyMode = (settings['spy_mode'] as string | undefined) ?? 'all';
  const spySaveLog = settings['spy_save_log'] === true;
  const trackedUsers = target.trackedUsers;

  const handleToggle = (): void => {
    const newValue = !spyEnabled;
    void saveSetting('spy_enabled', newValue);
    if (!newValue) {
      void setStorage({ spy_stats: { events: 0, isRunning: false } });
      setStats({ events: 0, isRunning: false });
    }
    showToast(newValue ? t('activity.on') : t('activity.off'), 'success');
  };

  const handleClearLog = async (): Promise<void> => {
    await setStorage({ activity_spy_log: [] });
    setLog([]);
    showToast(t('log_cleared'), 'success');
  };

  const handleExport = (): void => {
    downloadText(formatSpyLog(log), spyLogFilename('activity'));
    showToast(t('log_exported'), 'success');
  };

  const handleOpenMessages = (): void => {
    openTab('https://vk.ru/im');
  };

  return (
    <section
      {...(asPage ? {} : { 'data-vkify-anchor': 'spy_activity' })}
      className={`bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden ${asPage ? 'pt-2' : ''}`}
    >
      {!asPage && (
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <EyeIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">{t('nav.activity.title')}</h3>
              {spyEnabled && (
                <span className="flex items-center gap-1 mt-0.5 text-xs font-medium text-primary">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  {stats.events > 0 ? t('activity.events_session', { count: stats.events }) : t('active')}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-[var(--text-secondary)] px-4 pb-3 pt-1 leading-relaxed">
        {t('activity.intro')}
      </p>

      <div className="mx-4 mb-3 p-3 bg-[var(--bg-secondary)] rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-1 ring-inset ${
              spyEnabled ? 'bg-primary/10 ring-primary/20' : 'bg-[var(--bg-tertiary)] ring-[var(--border-color)]'
            }`}>
              <MessageIcon className={`w-5 h-5 ${spyEnabled ? 'text-primary' : 'text-[var(--text-tertiary)]'}`} />
            </div>
            <div className="text-sm font-medium text-[var(--text-primary)]">
              {spyEnabled ? t('activity.on') : t('activity.off')}
            </div>
          </div>
          <button
            onClick={handleToggle}
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
              <span className="text-xs font-medium text-[var(--text-secondary)]">{t('activity.whom')}</span>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                {t('add')}
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
                {t('activity.mode_all')}
              </button>
              <button
                onClick={() => void saveSetting('spy_mode', 'selected')}
                className={`flex-1 py-2 px-3 text-xs font-medium rounded-xl transition-all ${
                  spyMode === 'selected'
                    ? 'bg-primary text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                {t('activity.mode_selected', { count: trackedUsers.length })}
              </button>
            </div>

            {trackedUsers.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {trackedUsers.map(user => (
                  <TrackedUserRow key={user.id} user={user} onRemove={target.removeUser} />
                ))}
              </div>
            )}

            {trackedUsers.length === 0 && spyMode === 'selected' && (
              <div className="text-center py-4 text-xs text-[var(--text-tertiary)]">
                {t('activity.add_hint')}
              </div>
            )}
          </div>

          <div className="mx-3 border-t border-[var(--border-color)]" />

          <div className="px-4 pt-3 pb-1">
            <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">{t('activity.events_title')}</span>
          </div>

          <SettingRow id="spy_typing"   title={t('activity.events.spy_typing.title')}   description={t('activity.events.spy_typing.desc')}   icon={<KeyboardIcon  className="w-5 h-5" />} iconColor="purple" />
          <div className="mx-3 border-t border-[var(--border-color)]" />
          <SettingRow id="spy_voice"    title={t('activity.events.spy_voice.title')}    description={t('activity.events.spy_voice.desc')}    icon={<MicIcon       className="w-5 h-5" />} iconColor="pink"   />
          <div className="mx-3 border-t border-[var(--border-color)]" />
          <SettingRow id="spy_uploads"  title={t('activity.events.spy_uploads.title')}  description={t('activity.events.spy_uploads.desc')}  icon={<ImageIcon     className="w-5 h-5" />} iconColor="cyan"   />
          <div className="mx-3 border-t border-[var(--border-color)]" />
          <SettingRow id="spy_read"     title={t('activity.events.spy_read.title')}     description={t('activity.events.spy_read.desc')}     icon={<ReadCheckIcon className="w-5 h-5" />} iconColor="blue"   />
          <div className="mx-3 border-t border-[var(--border-color)]" />
          <SettingRow id="spy_edit"     title={t('activity.events.spy_edit.title')}     description={t('activity.events.spy_edit.desc')}     icon={<EditIcon      className="w-5 h-5" />} iconColor="orange" />
          <div className="mx-3 border-t border-[var(--border-color)]" />
          <SettingRow id="spy_delete"   title={t('activity.events.spy_delete.title')}   description={t('activity.events.spy_delete.desc')}   icon={<TrashIcon     className="w-5 h-5" />} iconColor="red"    />
          <div className="mx-3 border-t border-[var(--border-color)]" />
          <SettingRow id="spy_messages" title={t('activity.events.spy_messages.title')} description={t('activity.events.spy_messages.desc')} icon={<MessageIcon   className="w-5 h-5" />} iconColor="blue"   />
          <div className="mx-3 border-t border-[var(--border-color)]" />
          <SettingRow id="spy_calls"    title={t('activity.events.spy_calls.title')}    description={t('activity.events.spy_calls.desc')}    icon={<PhoneIcon     className="w-5 h-5" />} iconColor="green"  />
          <div className="mx-3 border-t border-[var(--border-color)]" />
          <SettingRow id="spy_friends"  title={t('activity.events.spy_friends.title')}  description={t('activity.events.spy_friends.desc')}  icon={<UserPlusIcon  className="w-5 h-5" />} iconColor="orange" />
          <div className="mx-3 border-t border-[var(--border-color)]" />
          <SettingRow id="spy_invisibility" title={t('activity.events.spy_invisibility.title')} description={t('activity.events.spy_invisibility.desc')} icon={<EyeOffIcon    className="w-5 h-5" />} iconColor="purple" />
          <div className="mx-3 border-t border-[var(--border-color)]" />
          <SettingRow id="spy_chat_events" title={t('activity.events.spy_chat_events.title')} description={t('activity.events.spy_chat_events.desc')} icon={<UsersIcon     className="w-5 h-5" />} iconColor="blue"   />

          <div className="mx-4 my-3 border-t-2 border-dashed border-[var(--border-color)]" />

          <div className="px-4 pb-1">
            <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">{t('notify')}</span>
          </div>

          <SettingRow id="spy_browser_notify" title={t('notify')} description={t('activity.browser_notify_desc')} icon={<BellIcon className="w-5 h-5" />} iconColor="blue" />
          <div className="mx-3 border-t border-[var(--border-color)]" />
          <SettingRow id="spy_save_log" title={t('save_log')} description={t('activity.save_log_desc')} icon={<FileTextIcon className="w-5 h-5" />} iconColor="green" />

          {spySaveLog && (
            <SpyLogButtons count={log.length} onOpenLog={() => setShowLogModal(true)} onExport={handleExport} />
          )}

          <div className="mx-4 mb-4">
            <InfoBlock variant="warning" icon={<WarningIcon className="w-4 h-4" />} title={t('activity.warn_title')}>
              {t('activity.warn_body')}
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
          {t('activity.open_messages')}
        </button>
      </div>

      {showAddModal && (
        <SpyAddUserModal lists={lists} target={target} onClose={() => setShowAddModal(false)} />
      )}

      {showLogModal && (
        <SpyLogModal
          entries={log.map(e => ({
            icon: e.icon,
            userName: e.userName,
            photo50: e.userInfo?.photo50,
            line: e.action,
            quote: e.extra?.text,
            timestamp: e.timestamp,
          }))}
          onClear={handleClearLog}
          onExport={handleExport}
          onClose={() => setShowLogModal(false)}
        />
      )}
    </section>
  );
}
