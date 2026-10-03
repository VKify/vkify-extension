import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import { NestedField } from '@/popup/components/ui/NestedSettings.js';
import InfoBlock from '@/popup/components/ui/InfoBlock.js';
import HotkeyPicker from '@/popup/components/ui/HotkeyPicker.js';
import { MusicSectionIcon, InfoIcon } from '@/popup/components/icons/Icons.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { codeToLabel } from '@/popup/components/ui/Kbd.js';
import type { HotkeyCombo } from '@/types/index.js';
import { widgetFeatureIsEnabled, withWidgetVisibility } from '@/shared/widget-visibility.js';

const fallback: HotkeyCombo = { altKey: true, ctrlKey: false, shiftKey: false, code: 'KeyM', label: 'Alt+M' };

export default function MiniPlayerPage(): React.ReactElement {
  const { t } = useTranslation('center');
  const settings = useVKifyStore(s => s.settings);
  const save = useVKifyStore(s => s.saveSetting);
  const saveMultiple = useVKifyStore(s => s.saveMultiple);
  const enabled = widgetFeatureIsEnabled('music-mini-player', 'music_mini_player', settings);
  const parts = String(settings.mini_player_hotkey ?? 'Alt+M').split('+');
  const rawCode = parts[parts.length - 1];
  const code = rawCode.length === 1 ? `Key${rawCode}` : rawCode;
  const combo: HotkeyCombo = {
    altKey: parts.includes('Alt'), ctrlKey: parts.includes('Ctrl'), shiftKey: parts.includes('Shift'), code,
    label: [...parts.slice(0, -1), codeToLabel(code)].join('+'),
  };
  const row = (id: string, title: string, description: string, defaultOn = false): React.ReactElement => (
    <SettingRow id={id} title={t(`miniPlayer.${title}`)} description={t(`miniPlayer.${description}`)}
      disabled={!enabled} checked={defaultOn ? settings[id] !== false : settings[id] === true}
      onToggle={value => { void save(id, value); }} />
  );

  return (
    <div className="space-y-4">
      <section className="dashboard-panel overflow-hidden">
        <SettingRow id="music_mini_player" title={t('miniPlayer.title')} description={t('miniPlayer.description')}
          icon={<MusicSectionIcon className="w-5 h-5" />} checked={enabled}
          onToggle={value => void saveMultiple(withWidgetVisibility(useVKifyStore.getState().settings, { music_mini_player: value }))} />
      </section>
      {!enabled && <p className="px-1 text-xs text-[var(--text-secondary)]">{t('common:enable_to_configure')}</p>}
      <fieldset disabled={!enabled} aria-disabled={!enabled}
        className={`min-w-0 space-y-4 border-0 p-0 m-0 transition-opacity duration-200 ${enabled ? '' : 'settings-disabled'}`}>
        <SettingsSection title={t('miniPlayer.behaviorSection')}>
          {row('mini_player_auto_show', 'autoShow', 'autoShowDesc', true)}
          {row('mini_player_collapsed', 'collapsed', 'collapsedDesc')}
          <NestedField title={t('miniPlayer.modeTitle')} description={t('miniPlayer.modeDesc')} align="start">
            <select aria-label={t('miniPlayer.modeTitle')} value={settings.mini_player_mode === 'pill' ? 'pill' : 'compact'}
              onChange={e => { void save('mini_player_mode', e.target.value); }}
              className="text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)] cursor-pointer">
              <option value="compact">{t('miniPlayer.compactMode')}</option>
              <option value="pill">{t('miniPlayer.pillMode')}</option>
            </select>
          </NestedField>
          {row('mini_player_pinned', 'pin', 'pinDesc')}
        </SettingsSection>
        <SettingsSection title={t('miniPlayer.contentSection')}>
          {row('mini_player_download', 'download', 'downloadDesc', true)}
          {row('mini_player_visualizer', 'miniVisualizer', 'visualizerDesc', true)}
        </SettingsSection>
        <SettingsSection title={t('miniPlayer.accessSection')}>
          {row('mini_player_open', 'show', 'showDesc', true)}
          <NestedField title={t('miniPlayer.hotkey')} description={t('miniPlayer.hotkeyDesc')}>
            <HotkeyPicker value={combo} defaultValue={fallback} onChange={value => {
              void save('mini_player_hotkey', [value.ctrlKey && 'Ctrl', value.altKey && 'Alt', value.shiftKey && 'Shift', value.code].filter(Boolean).join('+'));
            }} />
          </NestedField>
        </SettingsSection>
      </fieldset>
      <InfoBlock icon={<InfoIcon className="w-4 h-4" />} title={t('miniPlayer.resizeTitle')}>
        {t('miniPlayer.resizeDesc')}
      </InfoBlock>
    </div>
  );
}
