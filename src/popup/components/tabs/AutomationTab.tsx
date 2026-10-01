import React from 'react';
import { useTranslation } from 'react-i18next';
import HotkeyPicker from '../ui/HotkeyPicker.js';
import Toggle from '../ui/Toggle.js';
import NestedSettings from '../ui/NestedSettings.js';
import {
  DashboardHero, DashboardHeroArtwork, DashboardPanel, DashboardSettingCard,
  type DashboardTone,
} from '../ui/DashboardPrimitives.js';
import { useVKifyStore } from '../../store/index.js';
import { useToast } from '../../context/ToastContext.js';
import {
  ConvertIcon, ExternalLinkIcon, KeyboardIcon, LinkIcon,
} from '../icons/Icons.js';
import type { HotkeyCombo } from '@/types/index.js';

const DEFAULT_LAYOUT_HOTKEY: HotkeyCombo = {
  ctrlKey: false, shiftKey: true, altKey: true, code: 'KeyQ', label: 'Alt+Shift+Q',
};

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

function AutomationOverview(): React.ReactElement {
  const { t } = useTranslation('automation');
  const settings = useVKifyStore(state => state.settings);
  const saveSetting = useVKifyStore(state => state.saveSetting);
  const layoutHotkey = (settings['keyboard_layout_hotkey'] as HotkeyCombo | undefined) ?? DEFAULT_LAYOUT_HOTKEY;
  const layoutEnabled = settings['keyboard_layout_switch'] === true;

  return <div className="space-y-4 pb-4">
    <DashboardHero title={t('section')} subtitle={t('hero_subtitle')} description={t('hero_description')}
      artwork={<AutomationArtwork />} />

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
  return <AutomationOverview />;
}
