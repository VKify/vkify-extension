import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '../ui/SettingRow.js';
import NestedSettings from '../ui/NestedSettings.js';
import RangeSlider from '../ui/RangeSlider.js';
import ResetButton from '../ui/ResetButton.js';
import IconButton from '../ui/IconButton.js';
import { LayoutIcon, LayoutRowsIcon, SidebarIcon, EqualizerIcon, SpeedometerIcon, DownloadIcon, MusicIcon, FileTextIcon, ArrowUpIcon, SettingsIcon } from '../icons/Icons.js';
import { Icon24MusicNoteWaveOutline } from '@vkontakte/icons';
import { DOWNLOAD_CENTER_OPEN, widgetIsVisible, widgetVisibilityPatch } from '@/shared/widget-visibility.js';
import SettingsSection, { SectionDivider } from '../ui/SettingsSection.js';
import { getStorage, setStorage, subscribeStorage } from '../../utils/storageClient.js';
import { STACK_KEY, WIDGET_CATALOG, isWidgetKey, widgetKey, positionKey, parseWidget, parseStack, orderedWidgets, reorderWidgets, type StackSettings } from '@/shared/widget-stack.js';
import { MUSIC_OFFSET_STATE, changesMusicOffset, withMusicPageOffset } from '@/shared/music-page-offset.js';

const keys = [STACK_KEY, DOWNLOAD_CENTER_OPEN, ...WIDGET_CATALOG.flatMap(w => [widgetKey(w.id), positionKey(w.id), w.feature].filter(Boolean)), 'equalizerPanelOpen', 'mini_player_open', 'music_visualizer_settings', 'music_lyrics_settings', 'page_offset_enabled', 'page_offset_value', MUSIC_OFFSET_STATE];
const icons: Record<string, React.ReactNode> = {
  equalizer: <EqualizerIcon className="w-5 h-5" />, 'perf-widget': <SpeedometerIcon className="w-5 h-5" />,
  'download-center': <DownloadIcon className="w-5 h-5" />, 'music-mini-player': <MusicIcon className="w-5 h-5" />,
  music_visualizer: <Icon24MusicNoteWaveOutline width={20} height={20} />, music_lyrics: <FileTextIcon className="w-5 h-5" />,
};
function Choice({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string; icon?: React.ReactNode }[]; onChange: (value: string) => void }): React.ReactElement {
  return <div role="group" aria-label={label} className="flex gap-1 rounded-xl bg-[var(--bg-secondary)] p-1">
    {options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}
      className={'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' + (value === option.value ? 'bg-[var(--bg-primary)] text-primary shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]')}>
      {option.icon}{option.label}
    </button>)}
  </div>;
}

export default function WidgetsTab(): React.ReactElement {
  const { t } = useTranslation('settings');
  const label = (key: string): string => t(`widgets.${key}`);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const changed = new Set<string>();
    const off = subscribeStorage([], allChanges => {
      const changes = Object.fromEntries(Object.entries(allChanges).filter(([key]) => keys.includes(key) || isWidgetKey(key)));
      if (!Object.keys(changes).length) return;
      for (const key of Object.keys(changes)) changed.add(key);
      setValues(current => ({ ...current, ...Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value.newValue])) }));
    });
    void getStorage(null).then(data => {
      if (!active) return;
      setValues(current => ({ ...Object.fromEntries(Object.entries(data).filter(([key]) => (keys.includes(key) || isWidgetKey(key)) && !changed.has(key))), ...current })); setReady(true);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; off(); };
  }, []);
  const save = async (patch: Record<string, unknown>): Promise<void> => {
    try {
      // This tab writes storage directly (it also owns non-UI widget keys), so
      // preserve the same page-offset transaction used by the canonical store.
      const current = changesMusicOffset(patch) ? await getStorage(null) : values;
      await setStorage(withMusicPageOffset(current, patch)); setError(false);
    } catch { setError(true); }
  };
  const catalog: { id: string; feature: string; title?: string }[] = [...WIDGET_CATALOG];
  for (const [key, value] of Object.entries(values)) {
    if (!key.startsWith('widgetDefinition:') || !value || typeof value !== 'object') continue;
    const id = key.slice('widgetDefinition:'.length), title = (value as { title?: unknown }).title;
    if (!catalog.some(w => w.id === id) && typeof title === 'string') catalog.push({ id, feature: '', title });
  }
  const config = parseStack(values[STACK_KEY]);
  const stack = (patch: Partial<StackSettings>): void => { void save({ [STACK_KEY]: { ...config, ...patch } }); };
  const ids = orderedWidgets(catalog.map(w => w.id).filter(id => parseWidget(values[widgetKey(id)]).mode === 'stacked'), values);
  const show = (id: string, feature: string, visible: boolean): void => {
    // Build coupled feature/settings state from the latest storage snapshot;
    // another popup page may have changed it since this tab rendered.
    void getStorage(null).then(current => save(widgetVisibilityPatch(id, feature, visible, current)));
  };
  const reset = (id: string): Record<string, unknown> => {
    const patch: Record<string, unknown> = { [positionKey(id)]: null };
    return patch;
  };
  return <div className="space-y-4 pb-4">
    {error && <p role="alert" className="rounded-xl bg-error/10 p-3 text-xs text-error">{label('error')}</p>}
    <fieldset disabled={!ready} className="min-w-0 space-y-4">
      <SettingsSection title={label('available')} description={label('intro')} icon={<LayoutIcon className="w-5 h-5" />} iconColor="blue">
        {catalog.map((w, row) => {
          const state = parseWidget(values[widgetKey(w.id)]), index = ids.indexOf(w.id);
          const visible = widgetIsVisible(w.id, w.feature, values);
          const title = w.title ?? label(w.id);
          const description = w.id === 'download-center' ? label('downloadsHint') :
            (w.id === 'music_visualizer' || w.id === 'music_lyrics') ? label('visualHint') : label(visible ? state.mode : 'hidden');
          return <React.Fragment key={w.id}>
            {row > 0 && <SectionDivider />}
            <SettingRow id={widgetKey(w.id)} title={title} description={description} icon={icons[w.id] ?? <LayoutIcon className="w-5 h-5" />}
              checked={visible} disabled={!ready} onToggle={value => show(w.id, w.feature, value)} />
            {visible && <NestedSettings label={label('placement')}>
              <div className="space-y-3 px-4 pb-3">
                <Choice label={title + ': ' + label('mode')} value={state.mode} options={[
                  { value: 'free', label: label('free'), icon: <LayoutIcon className="w-4 h-4" /> },
                  { value: 'stacked', label: label('stacked'), icon: <LayoutRowsIcon className="w-4 h-4" /> },
                ]} onChange={mode => void save({ [widgetKey(w.id)]: { ...state, mode } })} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {state.mode === 'stacked' && <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-secondary)]">{label('order')} <span className="font-semibold tabular-nums text-primary">{index + 1} / {ids.length}</span></span>
                    {[-1, 1].map(direction => <IconButton key={direction} title={label(direction < 0 ? 'up' : 'down')} disabled={!ids[index + direction]}
                      className="rounded-lg hover:bg-[var(--bg-tertiary)]" onClick={() => void save(reorderWidgets(ids, w.id, ids[index + direction], values))}>
                      <ArrowUpIcon className={direction < 0 ? 'h-4 w-4' : 'h-4 w-4 rotate-180'} />
                    </IconButton>)}
                  </div>}
                  <ResetButton label={label('reset')} aria-label={title + ': ' + label('reset')} onClick={() => void save(reset(w.id))} />
                </div>
              </div>
            </NestedSettings>}
          </React.Fragment>;
        })}
      </SettingsSection>
      <SettingsSection title={label('stack')} description={label('stackHint')} icon={<LayoutRowsIcon className="w-5 h-5" />} iconColor="purple">
        <div className="space-y-4 px-4 py-3">
          <div className="space-y-2"><h4 className="text-xs font-medium text-[var(--text-secondary)]">{label('side')}</h4>
            <Choice label={label('side')} value={config.side} options={[
              { value: 'left', label: label('left'), icon: <SidebarIcon className="w-4 h-4" /> },
              { value: 'right', label: label('right'), icon: <SidebarIcon className="w-4 h-4 rotate-180" /> },
              { value: 'free', label: label('free'), icon: <LayoutIcon className="w-4 h-4" /> },
            ]} onChange={side => stack({ side: side as StackSettings['side'] })} />
          </div>
          <div className="space-y-2"><h4 className="text-xs font-medium text-[var(--text-secondary)]">{label('vertical')}</h4>
            <Choice label={label('vertical')} value={config.vertical} options={['top', 'center', 'bottom'].map(value => ({ value, label: label(value) }))}
              onChange={vertical => stack({ vertical: vertical as StackSettings['vertical'], position: null })} />
          </div>
        </div>
        <SectionDivider />
        {(['collapsed', 'animation'] as const).map(key => <SettingRow key={key} id={'widgetStack:' + key} title={label(key)} description={label(key + 'Hint')}
          checked={config[key]} disabled={!ready} onToggle={value => stack({ [key]: value })} />)}
      </SettingsSection>
      <SettingsSection title={label('appearance')} icon={<SettingsIcon className="w-5 h-5" />} iconColor="purple">
        <div className="space-y-5 px-4 py-4">
          <RangeSlider id="widget-stack-width" inline label={label('width')} value={config.width} min={240} max={600} step={10} unit=" px" onChange={width => stack({ width })} />
          <RangeSlider id="widget-stack-opacity" inline label={label('opacity')} value={Math.round(config.opacity * 100)} min={40} max={100} step={5} unit="%" onChange={opacity => stack({ opacity: opacity / 100 })} />
          <RangeSlider id="widget-stack-gap" inline label={label('gap')} value={config.gap} min={0} max={80} step={2} unit=" px" onChange={gap => stack({ gap })} />
        </div>
        <SectionDivider />
        <div className="flex justify-end p-4"><ResetButton label={label('resetAll')} onClick={() => void save(Object.assign({ [STACK_KEY]: { ...config, position: null } }, ...catalog.map(w => reset(w.id))))} /></div>
      </SettingsSection>
    </fieldset>
  </div>;
}
