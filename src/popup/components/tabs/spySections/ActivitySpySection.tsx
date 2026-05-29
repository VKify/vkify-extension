import React, { useState, useCallback } from 'react';
import SettingRow from '../../ui/SettingRow.js';
import InfoBlock from '../../ui/InfoBlock.js';
import SpyLogModal from '../../modals/SpyLogModal.js';
import SpyAddUserModal from './SpyAddUserModal.js';
import SpyLogButtons from './SpyLogButtons.js';
import TrackedUserRow from './TrackedUserRow.js';
import { useSettings } from '../../../context/SettingsContext.js';
import { useToast } from '../../../context/ToastContext.js';
import { useSpyTarget } from '../../../hooks/features/useSpyTarget.js';
import { useStorageReload } from '../../../hooks/core/useStorageReload.js';
import { downloadText } from '../../../../shared/utils/download.js';
import { formatSpyLog, spyLogFilename } from '../../../utils/spyLog.js';
import {
  EyeIcon, MessageIcon, StopIcon, PlayIcon, PlusIcon, KeyboardIcon,
  MicIcon, ImageIcon, EditIcon, TrashIcon, PhoneIcon, UserPlusIcon, EyeOffIcon,
  UsersIcon, BellIcon, FileTextIcon,
} from '../../icons/Icons.js';
import type { SpyLists } from './types.js';

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

export default function ActivitySpySection({ lists }: { lists: SpyLists }) {
  const { settings, saveSetting } = useSettings();
  const { showToast } = useToast();
  const target = useSpyTarget('spy_tracked_users', 'в слежку');

  const [stats, setStats] = useState<ActivitySpyStats>({ events: 0, isRunning: false });
  const [log, setLog] = useState<ActivitySpyLogEntry[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const result = await chrome.storage.local.get(['spy_stats', 'activity_spy_log']);
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
      void chrome.storage.local.set({ spy_stats: { events: 0, isRunning: false } });
      setStats({ events: 0, isRunning: false });
    }
    showToast(newValue ? 'Слежка включена' : 'Слежка выключена', 'success');
  };

  const handleClearLog = async (): Promise<void> => {
    await chrome.storage.local.set({ activity_spy_log: [] });
    setLog([]);
    showToast('Лог очищен', 'success');
  };

  const handleExport = (): void => {
    downloadText(formatSpyLog(log), spyLogFilename('activity'));
    showToast('Лог экспортирован', 'success');
  };

  const handleOpenMessages = (): void => {
    void chrome.tabs.create({ url: 'https://vk.com/im' });
  };

  return (
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
                {stats.events > 0 ? `${stats.events} событий` : 'Активно'}
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
              <span className="text-xs font-medium text-[var(--text-secondary)]">За кем следить</span>
              <button
                onClick={() => setShowAddModal(true)}
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
                Только выбранные ({trackedUsers.length})
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
            <SpyLogButtons count={log.length} onOpenLog={() => setShowLogModal(true)} onExport={handleExport} />
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
