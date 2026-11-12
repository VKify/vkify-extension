import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardPanel, SegmentedControl } from '@/popup/components/ui/DashboardPrimitives.js';
import { Input } from '@/popup/components/ui/FormControls.js';
import ColorPickerField from '@/popup/components/ui/ColorPickerField.js';
import ResetButton from '@/popup/components/ui/ResetButton.js';
import BackgroundAdvancedSettings from '../../appearanceSections/background/BackgroundAdvancedSettings.js';
import { useThrottledCallback } from '@/popup/hooks/core/useThrottledCallback.js';
import type { Settings } from '@/popup/store/slices/settingsSlice.js';
import UploadButton from '@/popup/components/ui/UploadButton.js';
import Toggle from '@/popup/components/ui/Toggle.js';
import { ImageIcon, PaletteIcon, UploadIcon, SettingsIcon } from '@/popup/components/icons/Icons.js';
import { useSetting } from '@/popup/store/selectors.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { DEFAULT_MESSENGER_BACKGROUND, isChatBackgroundImage, MAX_CHAT_BACKGROUND_LENGTH,
  CHAT_BACKGROUND_PRESETS, messengerBackgroundLayers, parseMessengerBackground, type MessengerBackground } from '@/shared/messenger-background.js';

export function MessageBackgroundResetButton(): React.ReactElement | null {
  const { t } = useTranslation('center');
  const enabled = useSetting<boolean>('messenger_background') === true;
  const raw = useSetting<string>('messenger_background_settings');
  if (!enabled && JSON.stringify(parseMessengerBackground(raw)) === JSON.stringify(DEFAULT_MESSENGER_BACKGROUND)) return null;
  return <ResetButton aria-label={t('chat_background.reset')} onClick={() => {
    void useVKifyStore.getState().saveMultiple({ messenger_background: false, messenger_background_settings: JSON.stringify(DEFAULT_MESSENGER_BACKGROUND) });
  }} />;
}

export default function MessageBackgroundPage(): React.ReactElement {
  const { t } = useTranslation('center');
  const text = (key: string) => t(`chat_background.${key}`);
  const enabled = useSetting<boolean>('messenger_background') === true;
  const raw = useSetting<string>('messenger_background_settings');
  const settings = parseMessengerBackground(raw);
  const [tab, setTab] = useState<MessengerBackground['mode'] | 'settings'>(settings.mode);
  const [url, setUrl] = useState(settings.image.startsWith('data:') ? '' : settings.image);
  useEffect(() => setUrl(settings.image.startsWith('data:') ? '' : settings.image), [settings.image]);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const save = async (patch: Partial<MessengerBackground>): Promise<void> => {
    const store = useVKifyStore.getState();
    const current = parseMessengerBackground(store.settings.messenger_background_settings);
    const ok = await store.saveSetting('messenger_background_settings', JSON.stringify({ ...current, ...patch }));
    if (!ok) setError(text('save_error'));
  };
  const applyUrl = async (): Promise<void> => {
    const value = url.trim();
    if (!value || !isChatBackgroundImage(value)) { setError(text('url_error')); return; }
    setError('');
    await save({ image: value, mode: 'image' });
  };
  const upload = async (file: File): Promise<void> => {
    setError(''); setUploading(true);
    let objectUrl = '';
    try {
      if (!/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type) || file.size > 10 * 1024 * 1024) throw new Error('image');
      objectUrl = URL.createObjectURL(file);
      const image = new Image(); image.src = objectUrl;
      await image.decode();
      const scale = Math.min(1, 1920 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/webp', .85);
      if (!isChatBackgroundImage(data) || data.length > MAX_CHAT_BACKGROUND_LENGTH) throw new Error('size');
      await save({ image: data, mode: 'image' }); setUrl('');
    } catch { setError(text('upload_error')); }
    finally { if (objectUrl) URL.revokeObjectURL(objectUrl); setUploading(false); }
  };
  const layers = messengerBackgroundLayers(settings);
  const saveColor = useThrottledCallback((color: string) => { void save({ color }); }, 90);
  const advancedSettings: Settings = { background_type: 'image' };
  for (const [key, value] of Object.entries(settings)) advancedSettings['background_' + key] = value;
  const saveAdvanced = async (values: Settings): Promise<boolean> => {
    const patch = Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith('background_')).map(([key, value]) => [key.slice(11), value]));
    await save(patch as Partial<MessengerBackground>); return true;
  };
  return <div className="space-y-4" data-vkify-anchor="messenger_background">
    <DashboardPanel title={text('title')} icon={<ImageIcon className="h-5 w-5" />}
      action={<Toggle ariaLabel={text('enable')} checked={enabled}
        onChange={value => { void useVKifyStore.getState().saveSetting('messenger_background', value); }} />}>
      <div className="p-4 space-y-4">
        <div className="overflow-hidden rounded-xl border border-[var(--border-color)]" aria-label={text('preview')}>
          <div className="relative isolate overflow-hidden min-h-[180px] bg-[var(--bg-secondary)]">
            <div aria-hidden="true" className="absolute pointer-events-none" data-chat-preview-layer style={{
              inset: -settings.blur, backgroundColor: layers.color, backgroundImage: layers.image,
              backgroundSize: settings.size, backgroundPosition: settings.position, backgroundRepeat: 'no-repeat',
              filter: layers.filter, opacity: settings.opacity / 100, transform: `scale(${settings.scale / 100})`,
            }} />
            <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ backgroundImage: layers.overlay }} />
          </div>
        </div>
        <SegmentedControl label={text('source')} value={tab} onChange={value => { setTab(value); if (value !== 'settings') void save({ mode: value }); }}
          options={[
            { value: 'preset', label: text('presets'), icon: <ImageIcon className="h-3.5 w-3.5" /> },
            { value: 'color', label: text('color'), icon: <PaletteIcon className="h-3.5 w-3.5" /> },
            { value: 'image', label: text('image'), icon: <UploadIcon className="h-3.5 w-3.5" /> },
            { value: 'settings', label: text('appearance'), icon: <SettingsIcon className="h-3.5 w-3.5" /> },
          ]} />
        {tab === 'preset' && <div className="grid grid-cols-3 gap-2">
          {CHAT_BACKGROUND_PRESETS.map(preset => <button key={preset.id} type="button" aria-pressed={settings.preset === preset.id}
            onClick={() => { void save({ preset: preset.id }); }}
            className={`overflow-hidden rounded-xl border-2 text-left transition-colors ${settings.preset === preset.id ? 'border-primary' : 'border-[var(--border-color)] hover:border-primary/50'}`}>
            <span className="block h-16" style={{ backgroundColor: preset.color, backgroundImage: preset.image }} />
            <span className="block bg-[var(--bg-secondary)] px-2 py-2 text-xs font-medium text-[var(--text-primary)]">{preset.name}</span>
          </button>)}
        </div>}
        {tab === 'color' && <ColorPickerField value={settings.color} onInput={saveColor}
          onChange={color => { void save({ color }); }} ariaLabel={text('custom_color')} variant="pill" />}
        {tab === 'image' && <div className="space-y-3">
          <div className="space-y-2 text-xs text-[var(--text-secondary)]">
            <label htmlFor="messenger-background-url">{text('url')}</label>
            <div className="flex gap-2">
              <Input id="messenger-background-url" type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://…" className="w-full min-w-0" />
              <button type="button" disabled={uploading || !url.trim()} onClick={() => { void applyUrl(); }}
                className="shrink-0 rounded-xl bg-primary px-3 text-xs font-semibold text-white disabled:opacity-40">{text('apply')}</button>
            </div>
          </div>
          <UploadButton label={text('upload')} loadingLabel={text('uploading')} loading={uploading} onClick={() => fileInput.current?.click()} />
          <input ref={fileInput} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
            onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file); }} />
          <p className="text-xs text-[var(--text-tertiary)]">{text('upload_hint')}</p>
          {settings.image && <button type="button" disabled={uploading} className="text-xs text-primary hover:underline" onClick={() => { setUrl(''); void save({ image: '' }); }}>{text('remove')}</button>}
        </div>}
        {tab === 'settings' && <BackgroundAdvancedSettings settings={advancedSettings}
          saveSetting={(key, value) => saveAdvanced({ [key]: value })} saveMultiple={saveAdvanced} />}
        {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
      </div>
    </DashboardPanel>
  </div>;
}
