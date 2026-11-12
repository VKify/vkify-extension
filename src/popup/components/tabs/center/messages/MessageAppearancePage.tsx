import React from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardPanel, SegmentedControl } from '@/popup/components/ui/DashboardPrimitives.js';
import ColorPickerField from '@/popup/components/ui/ColorPickerField.js';
import RangeSlider from '@/popup/components/ui/RangeSlider.js';
import ResetButton from '@/popup/components/ui/ResetButton.js';
import Toggle from '@/popup/components/ui/Toggle.js';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import { MessengerIcon, PaletteIcon, MoveHorizontalIcon } from '@/popup/components/icons/Icons.js';
import { useSetting } from '@/popup/store/selectors.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { useThrottledCallback } from '@/popup/hooks/core/useThrottledCallback.js';
import { MESSAGE_APPEARANCE_DEFAULTS, MESSAGE_COLOR_PRESETS, messageAppearanceSurfaces,
  parseMessageAppearance, type MessageAppearance } from '@/shared/message-appearance.js';

export function MessageAppearanceResetButton(): React.ReactElement | null {
  const { t } = useTranslation('center');
  const fill = useSetting<boolean>('messenger_message_background');
  const modern = useSetting<boolean>('messenger_modern_messages');
  const raw = useSetting<string>('messenger_message_settings');
  if (!fill && !modern && JSON.stringify(parseMessageAppearance(raw)) === JSON.stringify(MESSAGE_APPEARANCE_DEFAULTS)) return null;
  return <ResetButton aria-label={t('message_appearance.reset')} onClick={() => {
    void useVKifyStore.getState().saveMultiple({ messenger_message_background: false, messenger_modern_messages: false,
      messenger_message_settings: JSON.stringify(MESSAGE_APPEARANCE_DEFAULTS) });
  }} />;
}

export default function MessageAppearancePage(): React.ReactElement {
  const { t } = useTranslation('center');
  const label = (key: string) => t(`message_appearance.${key}`);
  const fill = useSetting<boolean>('messenger_message_background') === true;
  const modern = useSetting<boolean>('messenger_modern_messages') === true;
  const raw = useSetting<string>('messenger_message_settings');
  const settings = parseMessageAppearance(raw);
  const surfaces = messageAppearanceSurfaces(settings, true);
  const save = (patch: Partial<MessageAppearance>): void => {
    const store = useVKifyStore.getState();
    void store.saveSetting('messenger_message_settings', JSON.stringify({ ...parseMessageAppearance(store.settings.messenger_message_settings), ...patch }));
  };
  const previewColor = useThrottledCallback((key: 'incoming' | 'outgoing', value: string) => save({ [key]: value }), 90);
  return <div className="space-y-4">
    <DashboardPanel title={label('preview')} icon={<MessengerIcon className="h-5 w-5" />}>
      <div className="p-4 space-y-3 bg-[var(--bg-secondary)] rounded-b-2xl" data-message-preview>
        {(['incoming', 'outgoing'] as const).map(direction => <div key={direction}
          className={`px-3 py-2 text-xs shadow-sm ${modern ? 'w-fit max-w-[85%]' : 'w-full'} ${modern && direction === 'outgoing' ? 'ml-auto' : ''}`}
          style={{ borderRadius: fill ? settings.radius : 18,
            background: fill ? surfaces[direction] : 'var(--bg-primary)',
            color: fill ? surfaces[direction === 'incoming' ? 'incomingText' : 'outgoingText'] : 'var(--text-primary)' }}>
          {label(direction === 'incoming' ? 'sample_in' : 'sample_out')}
        </div>)}
      </div>
    </DashboardPanel>
    <DashboardPanel title={label('layout')} icon={<MoveHorizontalIcon className="h-5 w-5" />}>
      <SettingRow id="messenger_modern_messages" title={label('modern')} showDocs={false}
        icon={<MoveHorizontalIcon className="h-5 w-5" />} />
    </DashboardPanel>
    <DashboardPanel title={label('background')} icon={<PaletteIcon className="h-5 w-5" />}
      action={<Toggle ariaLabel={label('enable')} checked={fill} onChange={value => { void useVKifyStore.getState().saveSetting('messenger_message_background', value); }} />}>
      <div className="p-4 space-y-4" data-vkify-anchor="messenger_message_background">
        <SegmentedControl label={label('colors')} value={settings.source} onChange={source => save({ source })} options={[
          { value: 'theme', label: label('theme'), icon: <PaletteIcon className="h-3.5 w-3.5" /> },
          { value: 'custom', label: label('custom'), icon: <PaletteIcon className="h-3.5 w-3.5" /> },
        ]} />
        {settings.source === 'custom' && <>
        <div className="grid grid-cols-3 gap-2">
          {MESSAGE_COLOR_PRESETS.map(preset => <button key={preset.id} type="button" onClick={() => save({ source: 'custom', incoming: preset.incoming, outgoing: preset.outgoing })}
            aria-pressed={settings.incoming === preset.incoming && settings.outgoing === preset.outgoing}
            className={`rounded-xl border p-2 text-left ${settings.incoming === preset.incoming && settings.outgoing === preset.outgoing ? 'border-primary bg-primary/10' : 'border-[var(--border-color)] bg-[var(--bg-secondary)]'}`}>
            <span className="flex gap-1 mb-2"><span className="h-5 w-8 rounded-lg" style={{ background: preset.incoming }} /><span className="h-5 w-8 rounded-lg" style={{ background: preset.outgoing }} /></span>
            <span className="text-xs text-[var(--text-primary)]">{preset.name}</span>
          </button>)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(['incoming', 'outgoing'] as const).map(key => <div key={key} className="space-y-2 min-w-0">
            <span className="text-xs text-[var(--text-secondary)]">{label(key)}</span>
            <ColorPickerField value={settings[key]} ariaLabel={label(key)} variant="pill" onInput={color => previewColor(key, color)} onChange={color => save({ [key]: color })} />
          </div>)}
        </div>
        </>}
        <RangeSlider id="message-background-opacity" label={label('opacity')} min={20} max={100} step={5} unit="%" value={settings.opacity} onChange={opacity => save({ opacity })} />
        <RangeSlider id="message-background-radius" label={label('radius')} min={4} max={28} step={1} unit="px" value={settings.radius} onChange={radius => save({ radius })} />
      </div>
    </DashboardPanel>
  </div>;
}
