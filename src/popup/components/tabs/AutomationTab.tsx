import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import RangeSlider from '../ui/RangeSlider.js';
import InfoBlock from '../ui/InfoBlock.js';
import SettingRow from '../ui/SettingRow.js';
import NestedSettings, { NestedField } from '../ui/NestedSettings.js';
import HotkeyPicker from '../ui/HotkeyPicker.js';
import SubpageHost, { type Subpage } from '../ui/SubpageHost.js';
import NavRow from '../ui/NavRow.js';
import SettingsSection from '../ui/SettingsSection.js';
import { useVKifyStore } from '../../store/index.js';
import { useToast } from '../../context/ToastContext.js';
import { useStorageReload } from '../../hooks/core/useStorageReload.js';
import { getStorage, setStorage } from '@/popup/utils/storageClient.js';
import { openTab } from '../../utils/tabs.js';
import {
  UserPlusIcon, UsersIcon, PlayIcon, StopIcon,
  GlobeIcon, KeyboardIcon, ConvertIcon,
  ExternalLinkIcon, LinkIcon, WarningIcon,
} from '../icons/Icons.js';
import type { HotkeyCombo } from '@/types/index.js';

const DEFAULT_LAYOUT_HOTKEY: HotkeyCombo = {
  ctrlKey: false, shiftKey: true, altKey: true, code: 'KeyQ', label: 'Alt+Shift+Q',
};

interface AutoAddStats {
  added: number;
  isRunning: boolean;
}

const AUTO_ADD_KEYS = ['auto_add_stats'];

// ── Подстраница: авто-добавление друзей (функция с большим числом опций) ─────

function AutoAddFriendsPage(): React.ReactElement {
  const { t } = useTranslation('automation');
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const { showToast } = useToast();
  const [stats, setStats] = useState<AutoAddStats>({ added: 0, isRunning: false });

  const reloadStats = useCallback(async (): Promise<void> => {
    try {
      const result = await getStorage(['auto_add_stats']);
      if (result['auto_add_stats']) setStats(result['auto_add_stats'] as AutoAddStats);
    } catch { /* ignore */ }
  }, []);
  useStorageReload(AUTO_ADD_KEYS, reloadStats);

  const enabled = settings['auto_add_friends'] === true;

  const toggle = (): void => {
    const next = !enabled;
    void saveSetting('auto_add_friends', next);
    if (!next) {
      void setStorage({ auto_add_stats: { added: 0, isRunning: false } });
      setStats({ added: 0, isRunning: false });
    }
    showToast(next ? t('autoadd.toast_on') : t('autoadd.toast_off'), 'success');
  };

  return (
    <div className="space-y-5">
      <p className="px-1 text-xs text-[var(--text-secondary)] leading-relaxed">
        {t('autoadd.intro')} <span className="text-primary font-medium">vk.com/friends?act=find</span>.
      </p>

      {/* Master-управление — старт/стоп */}
      <section className="rounded-2xl shadow-card overflow-hidden ring-1 ring-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-1 ring-inset ${
              enabled ? 'bg-success/10 ring-success/20' : 'bg-[var(--bg-tertiary)] ring-[var(--border-color)]'
            }`}>
              <UsersIcon className={`w-5 h-5 ${enabled ? 'text-success' : 'text-[var(--text-tertiary)]'}`} />
            </div>
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">
                {enabled ? t('autoadd.script_on') : t('autoadd.script_off')}
              </div>
              {stats.added > 0 && (
                <div className="text-xs text-[var(--text-secondary)]">
                  {t('autoadd.added_session', { count: stats.added })}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={toggle}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
              enabled ? 'bg-error text-white' : 'bg-success text-white'
            }`}
          >
            {enabled ? <StopIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
          </button>
        </div>
      </section>

      {/* Параметры — гаснут, пока скрипт выключен */}
      <div
        aria-disabled={!enabled}
        className={`transition-opacity duration-200 ${enabled ? '' : 'opacity-40 pointer-events-none select-none grayscale'}`}
      >
        <SettingsSection title={t('autoadd.params')}>
          <div className="px-4 pb-4 pt-1 space-y-4">
            <RangeSlider
              id="auto_add_limit"
              label={t('autoadd.limit')}
              value={(settings['auto_add_limit'] as number | undefined) ?? 50}
              min={10} max={100} step={5} unit={t('autoadd.unit_requests')}
              onChange={(value) => void saveSetting('auto_add_limit', value)}
            />
            <RangeSlider
              id="auto_add_delay_min"
              label={t('autoadd.delay_min')}
              value={(settings['auto_add_delay_min'] as number | undefined) ?? 20}
              min={10} max={60} step={5} unit={t('autoadd.unit_sec')}
              onChange={(value) => void saveSetting('auto_add_delay_min', value)}
            />
            <RangeSlider
              id="auto_add_delay_max"
              label={t('autoadd.delay_max')}
              value={(settings['auto_add_delay_max'] as number | undefined) ?? 40}
              min={20} max={120} step={5} unit={t('autoadd.unit_sec')}
              onChange={(value) => void saveSetting('auto_add_delay_max', value)}
            />
          </div>
        </SettingsSection>
      </div>

      <button
        onClick={() => openTab('https://vk.com/friends?act=find')}
        className="w-full flex items-center justify-center gap-2 py-3 bg-primary/10 hover:bg-primary/15 text-primary font-medium rounded-xl transition-colors active:scale-[0.98]"
      >
        <GlobeIcon className="w-5 h-5" />
        {t('autoadd.open_search')}
      </button>

      <InfoBlock variant="warning" icon={<WarningIcon className="w-4 h-4" />} title={t('autoadd.warn_title')}>
        {t('autoadd.warn_body')}
      </InfoBlock>
    </div>
  );
}

export default function AutomationTab(): React.ReactElement {
  const { t } = useTranslation('automation');
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const layoutHotkey = (settings['keyboard_layout_hotkey'] as HotkeyCombo | undefined) ?? DEFAULT_LAYOUT_HOTKEY;

  const handleLayoutHotkeyChange = useCallback((combo: HotkeyCombo): void => {
    void saveSetting('keyboard_layout_hotkey', combo);
  }, [saveSetting]);

  const subpages: Subpage[] = [
    {
      id: 'autoadd',
      title: t('autoadd.title'),
      subtitle: t('autoadd.subtitle'),
      icon: <UserPlusIcon className="w-5 h-5" />,
      iconColor: 'green',
      anchors: ['auto_add_friends'],
      render: () => <div data-vkify-anchor="auto_add_friends"><AutoAddFriendsPage /></div>,
    },
  ];

  return (
    <SubpageHost subpages={subpages}>
      <div className="space-y-4">
        {/* Авто-добавление — отдельная страница */}
        <SettingsSection
          title={t('section')}
          description={t('section_desc')}
          icon={<UserPlusIcon className="w-5 h-5" />}
          iconColor="green"
        >
          <NavRow
            subpage="autoadd"
            title={t('autoadd.title')}
            description={t('autoadd.subtitle')}
            icon={<UserPlusIcon className="w-5 h-5" />}
            iconColor="green"
            meta={settings['auto_add_friends'] === true ? t('on') : t('off')}
          />
        </SettingsSection>

        <SettingsSection
          title={t('keyboard')}
          icon={<KeyboardIcon className="w-5 h-5" />}
          iconColor="purple"
        >
          <SettingRow
            id="keyboard_layout_switch"
            title={t('layout.title')}
            description={t('layout.desc')}
            icon={<ConvertIcon className="w-5 h-5" />}
            iconColor="purple"
          />
          {settings['keyboard_layout_switch'] === true && (
            <NestedSettings accent="purple">
              <NestedField title={t('layout.hotkey')}>
                <HotkeyPicker
                  value={layoutHotkey}
                  defaultValue={DEFAULT_LAYOUT_HOTKEY}
                  onChange={handleLayoutHotkeyChange}
                />
              </NestedField>
            </NestedSettings>
          )}
        </SettingsSection>

        <SettingsSection
          title={t('links')}
          icon={<ExternalLinkIcon className="w-5 h-5" />}
          iconColor="blue"
        >
          <SettingRow
            id="bypass_away_links"
            title={t('away.title')}
            description={t('away.desc')}
            icon={<LinkIcon className="w-5 h-5" />}
            iconColor="blue"
          />
        </SettingsSection>
      </div>
    </SubpageHost>
  );
}
