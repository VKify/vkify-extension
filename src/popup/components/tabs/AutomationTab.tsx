import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import RangeSlider from '../ui/RangeSlider.js';
import HotkeyPicker from '../ui/HotkeyPicker.js';
import SubpageHost, { type Subpage, useSubpageNav } from '../ui/SubpageHost.js';
import Toggle from '../ui/Toggle.js';
import NestedSettings from '../ui/NestedSettings.js';
import {
  DashboardHero, DashboardHeroArtwork, DashboardNavItem, DashboardPanel, DashboardSettingCard,
  type DashboardTone,
} from '../ui/DashboardPrimitives.js';
import { useVKifyStore } from '../../store/index.js';
import { useToast } from '../../context/ToastContext.js';
import { useStorageReload } from '../../hooks/core/useStorageReload.js';
import { getStorage, setStorage } from '@/popup/utils/storageClient.js';
import { openTab } from '../../utils/tabs.js';
import {
  ConvertIcon, ExternalLinkIcon, GlobeIcon, KeyboardIcon, LinkIcon,
  PlayIcon, StopIcon, UserPlusIcon, UsersIcon, WarningIcon, ZapIcon,
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

function AutomationArtwork(): React.ReactElement {
  return <DashboardHeroArtwork name="automation" />;
}

function AutomationToggleCard({ id, title, description, icon, tone = 'primary' }: {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  tone?: DashboardTone;
}): React.ReactElement {
  const { t } = useTranslation('common');
  const checked = useVKifyStore(state => state.settings[id] === true);
  const saveSetting = useVKifyStore(state => state.saveSetting);
  const { showToast } = useToast();

  const handleChange = async (value: boolean): Promise<void> => {
    const success = await saveSetting(id, value);
    if (success) showToast(t(value ? 'toast.setting_enabled' : 'toast.setting_disabled', { title }), 'success');
  };

  return <DashboardSettingCard icon={icon} title={title} description={description} tone={tone} docsId={id}
    control={<Toggle checked={checked} onChange={value => { void handleChange(value); }} />} />;
}

function AutoAddFriendsPage(): React.ReactElement {
  const { t } = useTranslation('automation');
  const settings = useVKifyStore(state => state.settings);
  const saveSetting = useVKifyStore(state => state.saveSetting);
  const { showToast } = useToast();
  const [stats, setStats] = useState<AutoAddStats>({ added: 0, isRunning: false });

  const reloadStats = useCallback(async (): Promise<void> => {
    try {
      const result = await getStorage(['auto_add_stats']);
      if (result['auto_add_stats']) setStats(result['auto_add_stats'] as AutoAddStats);
    } catch { /* storage can be unavailable in the preview */ }
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

  return <div className="space-y-4 pb-4">
    <DashboardPanel title={t('autoadd.status_title')} description={t('autoadd.intro')}
      icon={<UsersIcon className="h-5 w-5" />} tone="success" className="pb-4">
      <div className="px-4 pt-1" data-vkify-anchor="auto_add_friends">
        <DashboardSettingCard icon={enabled ? <StopIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
          title={enabled ? t('autoadd.script_on') : t('autoadd.script_off')}
          description={stats.added > 0 ? t('autoadd.added_session', { count: stats.added }) : t('autoadd.status_hint')}
          tone={enabled ? 'warning' : 'success'}
          control={<button type="button" onClick={toggle}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${enabled ? 'bg-error/10 text-error hover:bg-error/15' : 'bg-success/10 text-success hover:bg-success/15'}`}>
            {enabled ? t('autoadd.stop') : t('autoadd.start')}
          </button>} />
      </div>
    </DashboardPanel>

    <div aria-disabled={!enabled} className={`transition-opacity duration-200 ${enabled ? '' : 'pointer-events-none select-none opacity-55'}`}>
      <DashboardPanel title={t('autoadd.params')} description={t('autoadd.params_desc')}
        icon={<ZapIcon className="h-5 w-5" />} tone="warning" className="pb-4">
        <div className="grid grid-cols-2 gap-3 px-4 pt-1 max-[650px]:grid-cols-1">
          <DashboardSettingCard icon={<UserPlusIcon className="h-5 w-5" />} tone="success" className="items-start">
            <RangeSlider id="auto_add_limit" label={t('autoadd.limit')}
              value={(settings['auto_add_limit'] as number | undefined) ?? 50} min={10} max={100} step={5}
              unit={t('autoadd.unit_requests')} onChange={value => { void saveSetting('auto_add_limit', value); }} />
          </DashboardSettingCard>
          <DashboardSettingCard icon={<PlayIcon className="h-5 w-5" />} tone="primary" className="items-start">
            <RangeSlider id="auto_add_delay_min" label={t('autoadd.delay_min')}
              value={(settings['auto_add_delay_min'] as number | undefined) ?? 20} min={10} max={60} step={5}
              unit={t('autoadd.unit_sec')} onChange={value => { void saveSetting('auto_add_delay_min', value); }} />
          </DashboardSettingCard>
          <DashboardSettingCard icon={<StopIcon className="h-5 w-5" />} tone="violet" className="items-start">
            <RangeSlider id="auto_add_delay_max" label={t('autoadd.delay_max')}
              value={(settings['auto_add_delay_max'] as number | undefined) ?? 40} min={20} max={120} step={5}
              unit={t('autoadd.unit_sec')} onChange={value => { void saveSetting('auto_add_delay_max', value); }} />
          </DashboardSettingCard>
        </div>
      </DashboardPanel>
    </div>

    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 max-[520px]:grid-cols-1">
      <DashboardSettingCard icon={<WarningIcon className="h-5 w-5" />} title={t('autoadd.warn_title')}
        description={t('autoadd.warn_body')} tone="warning" />
      <button type="button" onClick={() => openTab('https://vk.ru/friends?act=find')}
        className="flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/15">
        <GlobeIcon className="h-4 w-4" />{t('autoadd.open_search')}
      </button>
    </div>
  </div>;
}

function AutomationOverview(): React.ReactElement {
  const { t } = useTranslation('automation');
  const { open } = useSubpageNav();
  const settings = useVKifyStore(state => state.settings);
  const saveSetting = useVKifyStore(state => state.saveSetting);
  const layoutHotkey = (settings['keyboard_layout_hotkey'] as HotkeyCombo | undefined) ?? DEFAULT_LAYOUT_HOTKEY;
  const layoutEnabled = settings['keyboard_layout_switch'] === true;

  return <div className="space-y-4 pb-4">
    <DashboardHero title={t('section')} subtitle={t('hero_subtitle')} description={t('hero_description')}
      artwork={<AutomationArtwork />} />

    <DashboardPanel title={t('routines_title')} description={t('routines_description')}
      icon={<ZapIcon className="h-5 w-5" />} tone="success" className="pb-4">
      <div className="px-4 pt-1">
        <DashboardNavItem title={t('autoadd.title')} description={t('autoadd.subtitle')}
          icon={<UserPlusIcon className="h-5 w-5" />} tone="success" docsId="auto_add_friends"
          onClick={() => open('autoadd')} meta={settings['auto_add_friends'] === true ? t('on') : t('off')} />
      </div>
    </DashboardPanel>

    <DashboardPanel title={t('input_title')} description={t('input_description')}
      icon={<KeyboardIcon className="h-5 w-5" />} tone="violet" className="pb-4">
      <div className="space-y-2 px-4 pt-1">
        <div data-vkify-anchor="keyboard_layout_switch">
          <AutomationToggleCard id="keyboard_layout_switch" title={t('layout.title')} description={t('layout.desc')}
            icon={<ConvertIcon className="h-5 w-5" />} tone="violet" />
        </div>
        <NestedSettings open={layoutEnabled} className="!mx-0">
          <DashboardSettingCard icon={<KeyboardIcon className="h-5 w-5" />} title={t('layout.hotkey')}
            description={t('layout.hotkey_desc')} tone="violet"
            control={<HotkeyPicker value={layoutHotkey} defaultValue={DEFAULT_LAYOUT_HOTKEY}
              onChange={combo => { void saveSetting('keyboard_layout_hotkey', combo); }} />} />
        </NestedSettings>
      </div>
    </DashboardPanel>

    <DashboardPanel title={t('navigation_title')} description={t('navigation_description')}
      icon={<ExternalLinkIcon className="h-5 w-5" />} className="pb-4">
      <div className="px-4 pt-1" data-vkify-anchor="bypass_away_links">
        <AutomationToggleCard id="bypass_away_links" title={t('away.title')} description={t('away.desc')}
          icon={<LinkIcon className="h-5 w-5" />} />
      </div>
    </DashboardPanel>
  </div>;
}

export default function AutomationTab(): React.ReactElement {
  const { t } = useTranslation('automation');
  const subpages: Subpage[] = [{
    id: 'autoadd',
    title: t('autoadd.title'),
    subtitle: t('autoadd.subtitle'),
    icon: <UserPlusIcon className="h-5 w-5" />,
    iconColor: 'green',
    anchors: ['auto_add_friends'],
    render: () => <AutoAddFriendsPage />,
  }];

  return <SubpageHost subpages={subpages}><AutomationOverview /></SubpageHost>;
}
