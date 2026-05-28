import React, { useState, useEffect, useCallback } from 'react';
import RangeSlider from '../ui/RangeSlider.js';
import InfoBlock from '../ui/InfoBlock.js';
import SettingRow from '../ui/SettingRow.js';
import HotkeyPicker from '../ui/HotkeyPicker.js';
import { useSettings } from '../../context/SettingsContext.js';
import { useToast } from '../../context/ToastContext.js';
import {
  UserPlusIcon, UsersIcon, PlayIcon, StopIcon,
  GlobeIcon, KeyboardIcon, RefreshIcon,
  ExternalLinkIcon, ZapIcon,
  CopyIcon, DownloadIcon, MessageIcon, BookmarkIcon,
} from '../icons/Icons.js';
import type { HotkeyCombo } from '../../../types/index.js';

const DEFAULT_LAYOUT_HOTKEY: HotkeyCombo = {
  ctrlKey: false, shiftKey: true, altKey: true, code: 'KeyQ', label: 'Alt+Shift+Q',
};

interface AutoAddStats {
  added: number;
  isRunning: boolean;
}

export default function AutomationTab(): React.ReactElement {
  const { settings, saveSetting } = useSettings();
  const { showToast } = useToast();

  const [autoAddStats, setAutoAddStats] = useState<AutoAddStats>({ added: 0, isRunning: false });

  useEffect(() => {
    const getStats = async (): Promise<void> => {
      try {
        const result = await chrome.storage.local.get(['auto_add_stats']);
        if (result['auto_add_stats']) setAutoAddStats(result['auto_add_stats'] as AutoAddStats);
      } catch { /* ignore */ }
    };

    void getStats();
    const interval = setInterval(() => { void getStats(); }, 2000);
    return () => clearInterval(interval);
  }, []);

  const autoAddEnabled = settings['auto_add_friends'] === true;
  const layoutHotkey = (settings['keyboard_layout_hotkey'] as HotkeyCombo | undefined) ?? DEFAULT_LAYOUT_HOTKEY;

  const handleLayoutHotkeyChange = useCallback((combo: HotkeyCombo): void => {
    void saveSetting('keyboard_layout_hotkey', combo);
  }, [saveSetting]);

  const handleOpenFriendsPage = (): void => {
    void chrome.tabs.create({ url: 'https://vk.com/friends?act=find' });
  };

  return (
    <div className="space-y-4">

      <section data-vkify-anchor="auto_add_friends" className="bg-[var(--bg-primary)] rounded-2xl shadow-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Секция: UserPlusIcon — добавление в друзья */}
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
              <UserPlusIcon className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Авто-добавление друзей</h3>
              {autoAddStats.isRunning && (
                <span className="flex items-center gap-1 mt-0.5 text-xs font-medium text-green-500">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  Активно
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed">
          Автоматически отправляет заявки в друзья случайным пользователям на странице поиска друзей.
          Работает только на странице <span className="text-primary font-medium">vk.com/friends?act=find</span>
        </p>

        {/* Статус: UsersIcon — аудитория/список людей (отличается от UserPlus) */}
        <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-xl mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              autoAddEnabled ? 'bg-success/10' : 'bg-[var(--bg-tertiary)]'
            }`}>
              <UsersIcon className={`w-5 h-5 ${autoAddEnabled ? 'text-success' : 'text-[var(--text-tertiary)]'}`} />
            </div>
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">
                {autoAddEnabled ? 'Скрипт включён' : 'Скрипт выключен'}
              </div>
              {autoAddStats.added > 0 && (
                <div className="text-xs text-[var(--text-secondary)]">
                  Добавлено за сессию: {autoAddStats.added}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              const newValue = !autoAddEnabled;
              void saveSetting('auto_add_friends', newValue);
              if (!newValue) {
                void chrome.storage.local.set({ auto_add_stats: { added: 0, isRunning: false } });
                setAutoAddStats({ added: 0, isRunning: false });
              }
              showToast(newValue ? 'Авто-добавление включено' : 'Авто-добавление выключено', 'success');
            }}
            className={`
              w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-95
              ${autoAddEnabled ? 'bg-error text-white' : 'bg-success text-white'}
            `}
          >
            {autoAddEnabled ? <StopIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
          </button>
        </div>

        {autoAddEnabled && (
          <div className="space-y-4 pt-4 border-t border-[var(--border-color)]">
            <RangeSlider
              id="auto_add_limit"
              label="Лимит в час"
              value={(settings['auto_add_limit'] as number | undefined) ?? 50}
              min={10}
              max={100}
              step={5}
              unit=" заявок"
              onChange={(value) => void saveSetting('auto_add_limit', value)}
            />
            <RangeSlider
              id="auto_add_delay_min"
              label="Мин. задержка"
              value={(settings['auto_add_delay_min'] as number | undefined) ?? 20}
              min={10}
              max={60}
              step={5}
              unit=" сек"
              onChange={(value) => void saveSetting('auto_add_delay_min', value)}
            />
            <RangeSlider
              id="auto_add_delay_max"
              label="Макс. задержка"
              value={(settings['auto_add_delay_max'] as number | undefined) ?? 40}
              min={20}
              max={120}
              step={5}
              unit=" сек"
              onChange={(value) => void saveSetting('auto_add_delay_max', value)}
            />
          </div>
        )}

        {/* Кнопка: GlobeIcon — переход на страницу VK (открыть в интернете) */}
        <button
          onClick={handleOpenFriendsPage}
          className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-primary/10 hover:bg-primary/15 text-primary font-medium rounded-xl transition-colors active:scale-[0.98]"
        >
          <GlobeIcon className="w-5 h-5" />
          Открыть страницу поиска друзей
        </button>
      </section>

      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          {/* Секция: KeyboardIcon — управление клавиатурой */}
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
            <KeyboardIcon className="w-5 h-5 text-purple-500" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Клавиатура</h3>
        </div>
        {/* Пункт: RefreshIcon — конвертация/смена раскладки (цикличное переключение) */}
        <SettingRow
          id="keyboard_layout_switch"
          title="Смена раскладки"
          description="Конвертирует текст между русской и латинской раскладками"
          icon={<RefreshIcon className="w-5 h-5" />}
          iconColor="purple"
        />
        {settings['keyboard_layout_switch'] === true && (
          <div className="px-4 pb-4 pt-1 flex items-center justify-between">
            <span className="text-xs text-[var(--text-tertiary)]">Горячая клавиша</span>
            <HotkeyPicker
              value={layoutHotkey}
              defaultValue={DEFAULT_LAYOUT_HOTKEY}
              onChange={handleLayoutHotkeyChange}
            />
          </div>
        )}
      </section>

      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          {/* Секция: ExternalLinkIcon — работа со ссылками */}
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <ExternalLinkIcon className="w-5 h-5 text-blue-500" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Ссылки</h3>
        </div>
        {/* Пункт: ZapIcon — мгновенный обход редиректа (быстро/напрямую) */}
        <SettingRow
          id="bypass_away_links"
          title="Обход away.php"
          description="Открывает внешние ссылки напрямую, минуя редирект-трекер VK"
          icon={<ZapIcon className="w-5 h-5" />}
          iconColor="blue"
        />
      </section>

      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
            <MessageIcon className="w-5 h-5 text-cyan-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Работа с сообщениями</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Быстрое копирование и экспорт диалогов в файл
            </p>
          </div>
        </div>

        <SettingRow
          id="message_quick_copy"
          title="Быстрое копирование"
          description="Кнопка «копировать» в каждом сообщении ВК — всегда видна, не нужно наводить мышь"
          icon={<CopyIcon className="w-5 h-5" />}
          iconColor="blue"
        />

        <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />

        <SettingRow
          id="dialog_export_enabled"
          title="Экспорт диалога"
          description="Кнопка в шапке чата: скачать всю переписку в JSON, TXT, HTML или ZIP-архив с фото"
          icon={<DownloadIcon className="w-5 h-5" />}
          iconColor="cyan"
        />

        <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />

        <SettingRow
          id="message_pin_notes"
          title="Заметки из сообщений"
          description="Кнопка-закладка у каждого сообщения сохраняет его в локальный архив. Все заметки — во вкладке «Заметки»"
          icon={<BookmarkIcon className="w-5 h-5" />}
          iconColor="orange"
        />
      </section>

      <InfoBlock variant="warning" icon="⚠️" title="Внимание">
        Злоупотребление авто-добавлением может привести к временной блокировке аккаунта.
        Используйте умеренные настройки.
      </InfoBlock>

    </div>
  );
}
