import { Select } from '@/popup/components/ui/FormControls.js';
import { downloadText } from '@/shared/utils/download.js';
import { controlLyrics } from '@/popup/utils/tabs.js';
import { WidgetsIcon, TypeIcon, LayoutRowsIcon, PaletteIcon, BoldIcon, LayoutIcon, SpeedometerIcon, SparklesIcon, CheckIcon, ImageIcon, DownloadIcon } from '@/popup/components/icons/Icons.js';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MusicPreviewPanel, MusicSettingsPanel, MusicToggleRow, MusicDisclosure } from './MusicAppearanceControls.js';
import RangeSlider from '@/popup/components/ui/RangeSlider.js';
import ColorPickerField from '@/popup/components/ui/ColorPickerField.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { LYRICS_PRESETS, lyricsPreset, parseLyricsSettings, exportLyrics, type LyricsSnapshot } from '@/shared/music-lyrics.js';
import type { VisualizerSettings } from '@/shared/music-visualizer.js';
import { sanitizeFilename } from '@/shared/utils/filename.js';
import VisualizerPreview from './VisualizerPreview.js';
import { musicFeatureVisibilityPatch, musicSettingsVisibilityPatch, widgetFeatureIsEnabled } from '@/shared/widget-visibility.js';

const button = 'music-appearance__button';
const selectIcons: Partial<Record<keyof VisualizerSettings, React.ReactNode>> = {
  output: <WidgetsIcon />, lyricsStyle: <TypeIcon />, lyricsAlignment: <LayoutRowsIcon />,
  colorMode: <PaletteIcon />, lyricsFontWeight: <BoldIcon />, lyricsLayer: <LayoutIcon />, fps: <SpeedometerIcon />,
};

async function activeTabMessage(type: string, labels: Record<string, string> = {}): Promise<unknown> {
  return controlLyrics(type === 'VKIFY_LYRICS_EDIT' ? 'edit' : 'snapshot', labels);
}

export default function MusicLyricsPage(): React.ReactElement {
  const { t } = useTranslation('center');
  const settings = useVKifyStore(s => s.settings);
  const saveMultiple = useVKifyStore(s => s.saveMultiple);
  const enabled = widgetFeatureIsEnabled('music_lyrics', 'music_lyrics', settings);
  const value = parseLyricsSettings(settings.music_lyrics_settings);
  const [snapshot, setSnapshot] = useState<LyricsSnapshot | null>(null);
  const [notice, setNotice] = useState('');
  const [animated, setAnimated] = useState(true);
  const label = (key: string): string => t(`music.lyrics.${key}`);
  const saveLyrics = (next: VisualizerSettings): void => {
    const current = useVKifyStore.getState().settings;
    void saveMultiple(musicSettingsVisibilityPatch('music_lyrics', JSON.stringify(next), current));
  };
  const update = (patch: Partial<VisualizerSettings>): void => {
    const current = parseLyricsSettings(useVKifyStore.getState().settings.music_lyrics_settings);
    if (patch.lyricsStyle) patch.lyricsNeighbors = patch.lyricsStyle === 'flow';
    if (patch.lyricsNeighbors) {
      patch.lyricsLineCount = Math.max(3, current.lyricsLineCount);
      patch.lyricsSecondaryOpacity = current.lyricsSecondaryOpacity || 18;
    }
    const next = { ...current, ...patch };
    saveLyrics(next);
  };
  useEffect(() => {
    let alive = true;
    const refresh = async (): Promise<void> => {
      try {
        const response = await activeTabMessage('VKIFY_LYRICS_SNAPSHOT') as LyricsSnapshot | null;
        if (alive) setSnapshot(response);
      } catch { if (alive) setSnapshot(null); }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 3000);
    return () => { alive = false; clearInterval(timer); };
  }, [enabled]);
  const slider = (text: string, key: keyof VisualizerSettings, min: number, max: number, unit = '%') =>
    <RangeSlider id={`lyrics-${key}`} label={text} value={Number(value[key])} min={min} max={max} step={1} unit={unit} inline onChange={n => update({ [key]: n })} />;
  const select = (text: string, key: keyof VisualizerSettings, options: Record<string, string>) =>
    <label className="block text-xs text-[var(--text-secondary)]">{text}<Select icon={selectIcons[key]} value={String(value[key])} onChange={e => update({ [key]: e.target.value })}
      className="block w-full mt-2">
      {Object.entries(options).map(([id, text]) => <option key={id} value={id}>{text}</option>)}
    </Select></label>;
  const editPage = async (): Promise<void> => {
    try {
      const response = await activeTabMessage('VKIFY_LYRICS_EDIT', { hint: label('page_hint'), doneLabel: label('done') }) as { success?: boolean } | null;
      setNotice(label(response?.success ? 'editing' : 'open_vk'));
    } catch { setNotice(label('open_vk')); }
  };
  const download = (format: 'txt' | 'lrc'): void => {
    if (!snapshot?.result) return;
    const text = exportLyrics(snapshot.result, format); if (!text) return;
    const name = sanitizeFilename([snapshot.track?.artist, snapshot.track?.title].filter(Boolean).join(' — ') || 'lyrics');
    downloadText(text, `${name}.${format}`);
  };
  const hasText = !!snapshot?.result && !!exportLyrics(snapshot.result, 'txt');
  return <div className="music-appearance space-y-4 pb-4" data-vkify-anchor="music_lyrics">
    <MusicPreviewPanel title={label('title')} description={label('description')} icon={<TypeIcon className="h-5 w-5" />}
      enabled={enabled} enableLabel={label('title')} enableAnchor="music_lyrics_enable"
      onEnable={next => void saveMultiple(musicFeatureVisibilityPatch('music_lyrics', next, useVKifyStore.getState().settings))}
      animated={animated} onAnimate={() => setAnimated(previous => !previous)}
      output={value.output} onOutput={output => { update({ output }); setNotice(''); }} dragHint={label('drag_hint')}
      footer={<>
        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{label('availability')}</p>
        {notice && <p role="status" className="text-xs text-primary">{notice}</p>}
      </>}>
      <VisualizerPreview settings={value} animated={animated} onOffsetChange={(offsetX, offsetY) => update({ offsetX, offsetY })} onCoverOffsetChange={(lyricsCoverX, lyricsCoverY) => update({ lyricsCoverX, lyricsCoverY })} className="block w-full h-52 cursor-grab active:cursor-grabbing" />
    </MusicPreviewPanel>
    <MusicSettingsPanel title={label('presets')} icon={<SparklesIcon className="h-5 w-5" />}>
      <div className="music-appearance__presets">
        {LYRICS_PRESETS.map(preset => {
          const snapshot = { ...lyricsPreset(preset.id), output: value.output, hideWhenPaused: value.hideWhenPaused, lyricsAvoidContent: value.lyricsAvoidContent };
          const selected = Object.keys(snapshot).every(key => snapshot[key as keyof VisualizerSettings] === value[key as keyof VisualizerSettings]);
          return <button key={preset.id} type="button" aria-pressed={selected} className="music-appearance__preset" onClick={() => saveLyrics(snapshot)}>
            <VisualizerPreview settings={snapshot} animated={false} thumbnail />
            <span className="flex items-center justify-between gap-1 text-xs font-semibold text-[var(--text-primary)]">{label('presets_list.' + preset.id + '.name')}{selected && <CheckIcon className="h-3.5 w-3.5 shrink-0 text-primary" />}</span>
            <span className="mt-1 block text-xs leading-relaxed text-[var(--text-secondary)]">{label('presets_list.' + preset.id + '.description')}</span>
          </button>;
        })}
      </div>
    </MusicSettingsPanel>
    <MusicSettingsPanel title={label('typography')} icon={<TypeIcon className="h-5 w-5" />}>
      <div className="grid grid-cols-2 gap-3">
      {select(label('style'), 'lyricsStyle', { flow: 'Flow', focus: 'Focus' })}
      {select(label('align'), 'lyricsAlignment', { left: label('left'), center: label('center'), right: label('right') })}
      </div>
      {select(t('music.visualizer.palette'), 'colorMode', { custom: t('music.visualizer.palette_options.custom'), accent: t('music.visualizer.palette_options.accent'), theme: t('music.visualizer.palette_options.theme'), auto: t('music.visualizer.palette_options.auto') })}
      {value.colorMode === 'custom' && <div className="music-appearance__colors"><div><span>{label('color')}</span><ColorPickerField value={value.color} onInput={color => update({ color, colorMode: 'custom' })} onChange={color => update({ color, colorMode: 'custom' })} ariaLabel={label('color')} /></div></div>}
      {select(label('weight'), 'lyricsFontWeight', { '500': label('weight_medium'), '600': label('weight_semibold'), '700': label('weight_bold'), '800': label('weight_heavy') })}
      <div className="music-appearance__group space-y-4">
      {slider(label('size'), 'lyricsSize', 50, 200)}
      {slider(label('opacity'), 'opacity', 0, 100)}
      </div>
      <MusicDisclosure title={label('line_settings')}>
      {slider(label('secondary'), 'lyricsSecondaryOpacity', 0, 70)}
      <MusicToggleRow checked={value.lyricsNeighbors} onChange={lyricsNeighbors => update({ lyricsNeighbors })} label={label('neighbors')} />
      {slider(label('lines'), 'lyricsLineCount', 1, 11, '')}
      {slider(label('spacing'), 'lyricsLineSpacing', 50, 200)}
      </MusicDisclosure>
    </MusicSettingsPanel>
    <MusicSettingsPanel title={label('placement')} icon={<LayoutIcon className="h-5 w-5" />}>
      {slider(t('music.visualizer.width'), 'width', 20, 200)}
      {slider(t('music.visualizer.offset_x'), 'offsetX', -100, 100)}
      {slider(t('music.visualizer.offset_y'), 'offsetY', -100, 100)}
      {value.output === 'overlay' && select(label('layer'), 'lyricsLayer', { background: label('background'), foreground: label('foreground') })}
      <MusicToggleRow checked={value.lyricsAvoidContent} onChange={lyricsAvoidContent => update({ lyricsAvoidContent })} label={t('music.visualizer.auto_offset')} />
      {value.output === 'overlay' && value.lyricsAvoidContent && <p className="text-xs text-[var(--text-secondary)]">{t('music.visualizer.page_offset_hint')}</p>}
      <button type="button" className={button} disabled={!enabled || value.output === 'widget'} onClick={() => void editPage()}>{label('edit_page')}</button>
      <button type="button" className={button} onClick={() => update({ offsetX: 0, offsetY: 0, width: 100, position: 'full' })}>{t('music.visualizer.reset_position')}</button>
    </MusicSettingsPanel>
    <MusicSettingsPanel title={label('cover')} icon={<ImageIcon className="h-5 w-5" />}>
      <MusicToggleRow checked={value.lyricsShowCover} onChange={lyricsShowCover => update({ lyricsShowCover })} label={label('cover')} />
      {value.lyricsShowCover && <>
        {slider(label('cover_size'), 'lyricsCoverSize', 5, 60)}
        {slider(t('music.visualizer.offset_x'), 'lyricsCoverX', 0, 100)}
        {slider(t('music.visualizer.offset_y'), 'lyricsCoverY', 0, 100)}
        {slider(label('opacity'), 'lyricsCoverOpacity', 0, 100)}
        {slider(label('radius'), 'lyricsCoverRadius', 0, 50)}
        {slider(t('music.visualizer.blur'), 'lyricsCoverBlur', 0, 30, ' px')}
      </>}
    </MusicSettingsPanel>
    <MusicDisclosure title={t('music.visualizer.advanced')}>
      {slider(t('music.visualizer.intensity'), 'intensity', 0, 100)}
      {slider(t('music.visualizer.lyrics.sensitivity'), 'lyricsSensitivity', 0, 200)}
      {slider(t('music.visualizer.glow'), 'glow', 0, 100)}
      {slider(t('music.visualizer.blur'), 'blur', 0, 30, ' px')}
      {select(t('music.visualizer.fps'), 'fps', { auto: 'Auto', '30': '30 FPS', '60': '60 FPS' })}
      <MusicToggleRow checked={value.hideWhenPaused} onChange={hideWhenPaused => update({ hideWhenPaused })} label={t('music.visualizer.hide_paused')} />

    </MusicDisclosure>
    <MusicSettingsPanel title={label('save')} icon={<DownloadIcon className="h-5 w-5" />}>
      <p className="text-xs text-[var(--text-secondary)]">{snapshot?.track ? `${snapshot.track.artist} — ${snapshot.track.title}` : label('open_vk')}</p>
      {snapshot?.track && !hasText && <p className="text-xs text-[var(--text-secondary)]">{label('no_text')}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={!hasText} onClick={() => download('txt')}>TXT</button>
        <button type="button" className={button} disabled={!snapshot?.result?.synced} onClick={() => download('lrc')}>LRC</button>
        <button type="button" className={button} disabled={!hasText} onClick={() => {
          if (snapshot?.result) void navigator.clipboard.writeText(exportLyrics(snapshot.result, 'txt')).then(() => setNotice(label('copied')), () => setNotice(label('copy_failed')));
        }}>{label('copy')}</button>
      </div>
      <p className="text-xs text-[var(--text-secondary)]">{label('export_hint')}</p>
    </MusicSettingsPanel>
  </div>;
}
