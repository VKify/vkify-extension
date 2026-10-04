import React from 'react';
import { useTranslation } from 'react-i18next';
import { useVKifyStore } from '@/popup/store/index.js';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import HotkeyPicker from '@/popup/components/ui/HotkeyPicker.js';
import InfoBlock from '@/popup/components/ui/InfoBlock.js';
import { KeyboardIcon, InfoIcon } from '@/popup/components/icons/Icons.js';
import { DEFAULT_VIDEO_HOTKEYS, isHotkeyCombo, type VideoAction } from '@/shared/video-hotkeys.js';

const GROUPS: { title: string; actions: VideoAction[] }[] = [
  { title: 'playback', actions: ['play_pause', 'prev', 'next', 'seek_backward', 'seek_forward'] },
  { title: 'sound', actions: ['volume_up', 'volume_down', 'mute', 'fullscreen'] },
  { title: 'speed', actions: ['rate_up', 'rate_down', 'rate_reset'] },
];

export default function VideoHotkeysPage(): React.ReactElement {
  const { t } = useTranslation('center');
  const settings = useVKifyStore(s => s.settings);
  const save = useVKifyStore(s => s.saveSetting);
  const enabled = settings.video_player_hotkeys === true;
  return <div className="space-y-5">
    <section className="dashboard-panel overflow-hidden">
      <SettingRow id="video_player_hotkeys" title={t('video_hotkeys.title')}
        description={t('video_hotkeys.description')} icon={<KeyboardIcon className="w-5 h-5" />} />
    </section>
    {GROUPS.map(group => <SettingsSection key={group.title} title={t(`video_hotkeys.groups.${group.title}`)}>
      <fieldset disabled={!enabled} className={`min-w-0 ${enabled ? '' : 'opacity-40'}`}>
        {group.actions.map(action => {
          const key = `video_hotkey_${action}`;
          const saved = settings[key];
          return <div key={action} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-sm text-[var(--text-primary)]">{t(`video_hotkeys.actions.${action}`)}</span>
            <HotkeyPicker value={isHotkeyCombo(saved) ? saved : DEFAULT_VIDEO_HOTKEYS[action]}
              defaultValue={DEFAULT_VIDEO_HOTKEYS[action]} onChange={value => { void save(key, value); }} />
          </div>;
        })}
      </fieldset>
    </SettingsSection>)}
    <InfoBlock icon={<InfoIcon className="w-4 h-4" />} title={t('video_hotkeys.hint_title')}>{t('video_hotkeys.hint')}</InfoBlock>
  </div>;
}
