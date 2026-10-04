import { Select } from '@/popup/components/ui/FormControls.js';
import { controlLyrics } from '@/popup/utils/tabs.js';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import RangeSlider from '@/popup/components/ui/RangeSlider.js';
import ColorPickerField from '@/popup/components/ui/ColorPickerField.js';
import { MusicPreviewPanel, MusicSettingsPanel, MusicToggleRow, MusicDisclosure } from './MusicAppearanceControls.js';
import { EqualizerIcon, WidgetsIcon, PaletteIcon, LayoutIcon, SpeedometerIcon, SparklesIcon, CheckIcon } from '@/popup/components/icons/Icons.js';
import { parseVisualizerSettings, VISUALIZER_PRESETS, VISUALIZER_MODES, visualizerPreset, type VisualizerSettings, type VisualizerMode } from '@/shared/music-visualizer.js';
import { useVKifyStore } from '@/popup/store/index.js';
import VisualizerPreview from './VisualizerPreview.js';
import { musicFeatureVisibilityPatch, musicSettingsVisibilityPatch, widgetFeatureIsEnabled } from '@/shared/widget-visibility.js';

const swatches = [['#22d3ee', '#c084fc'], ['#818cf8', '#2dd4bf'], ['#fb7185', '#fbbf24'], ['#a5b4fc', '#f9a8d4'], ['#e2e8f0', '#7dd3fc']];
const selectIcons: Partial<Record<keyof VisualizerSettings, React.ReactNode>> = {
  output: <WidgetsIcon />, colorMode: <PaletteIcon />, position: <LayoutIcon />,
  fps: <SpeedometerIcon />, quality: <EqualizerIcon />,
};

export default function MusicVisualizerPage(): React.ReactElement {
  const { t } = useTranslation('center');
  const settings = useVKifyStore((s) => s.settings);
  const saveMultiple = useVKifyStore((s) => s.saveMultiple);
  const [animatePreview, setAnimatePreview] = useState(true);
  const [editNotice, setEditNotice] = useState('');
  const value = parseVisualizerSettings(settings.music_visualizer_settings);
  const accent = typeof settings.custom_accent === 'string' && /^#[0-9a-f]{6}$/i.test(settings.custom_accent) ? settings.custom_accent : '#5181b8';
  const theme = typeof settings.custom_theme === 'string' && /^#[0-9a-f]{6}$/i.test(settings.custom_theme) ? settings.custom_theme : accent;
  const previewValue = value.colorMode === 'accent' || value.colorMode === 'theme'
    ? { ...value, color: value.colorMode === 'theme' ? theme : accent, color2: accent, colorMode: value.colorMode === 'theme' ? 'gradient' : 'custom' }
    : value;
  const enabled = widgetFeatureIsEnabled('music_visualizer', 'music_visualizer', settings);
  const saveVisualizer = (next: VisualizerSettings): void => {
    const current = useVKifyStore.getState().settings;
    void saveMultiple(musicSettingsVisibilityPatch('music_visualizer', JSON.stringify(next), current));
  };
  const update = (patch: Partial<VisualizerSettings>): void => {
    const current = parseVisualizerSettings(useVKifyStore.getState().settings.music_visualizer_settings);
    const next = { ...current, ...patch };
    saveVisualizer(next);
  };
  const select = (label: string, key: keyof VisualizerSettings, options: Record<string, string>): React.ReactElement => (
    <label className="block text-xs text-[var(--text-secondary)]">{label}
      <Select icon={selectIcons[key]} value={String(value[key])} onChange={(event) => update({ [key]: event.target.value })}
        className="block w-full mt-2">
        {Object.entries(options).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </Select>
    </label>
  );
  const slider = (label: string, key: keyof VisualizerSettings, max: number, min = 0): React.ReactElement => (
    <RangeSlider id={`visualizer-${key}`} label={label} value={Number(value[key])} min={min} max={max} step={1}
      unit={key === 'blur' ? ' px' : '%'} inline
      minLabel={key === 'offsetX' ? t('music.visualizer.left') : key === 'offsetY' ? t('music.visualizer.up') : undefined}
      maxLabel={key === 'offsetX' ? t('music.visualizer.right') : key === 'offsetY' ? t('music.visualizer.down') : undefined}
      onChange={(next) => update({ [key]: next })} />
  );
  return <div className="music-appearance space-y-4 pb-4" data-vkify-anchor="music_visualizer">
    <MusicPreviewPanel title={t('music.visualizer.hero_title')} description={t('music.visualizer.hero_desc')}
      icon={<EqualizerIcon className="h-5 w-5" />} enabled={enabled} enableLabel={t('music.visualizer.enable')} enableAnchor="music_visualizer_enable"
      onEnable={next => void saveMultiple(musicFeatureVisibilityPatch('music_visualizer', next, useVKifyStore.getState().settings))}
      animated={animatePreview} onAnimate={() => setAnimatePreview(previous => !previous)}
      output={value.output} onOutput={output => { update({ output }); setEditNotice(''); }} dragHint={t('music.visualizer.drag_hint')}
      footer={<p className="text-xs leading-relaxed text-[var(--text-secondary)]">{t(enabled ? 'music.visualizer.enabled_hint' : 'music.visualizer.disabled_hint')}</p>}>
      <VisualizerPreview settings={previewValue} animated={animatePreview} onOffsetChange={(offsetX, offsetY) => update({ offsetX, offsetY })} className="block w-full h-52 cursor-grab active:cursor-grabbing" />
    </MusicPreviewPanel>

    <MusicSettingsPanel title={t('music.visualizer.styles')} description={t('music.visualizer.styles_hint')} icon={<SparklesIcon className="h-5 w-5" />}>
      <div className="music-appearance__presets">
        {VISUALIZER_PRESETS.map((preset) => {
          const snapshot = { ...visualizerPreset(preset.id), hideWhenPaused: value.hideWhenPaused, visualizerAvoidContent: value.visualizerAvoidContent, output: value.output };
          const selected = Object.keys(snapshot).every((key) => snapshot[key as keyof VisualizerSettings] === value[key as keyof VisualizerSettings]);
          return <button key={preset.id} type="button" aria-pressed={selected}
            onClick={() => saveVisualizer(snapshot)}
            className="music-appearance__preset">
            <VisualizerPreview settings={snapshot} animated={false} thumbnail />
            <span className="flex items-center justify-between gap-1 text-xs font-semibold text-[var(--text-primary)]">{t(`music.visualizer.presets.${preset.id}.name`)}{selected && <CheckIcon className="h-3.5 w-3.5 shrink-0 text-primary" />}</span>
            <span className="mt-1 block text-xs leading-relaxed text-[var(--text-secondary)]">{t(`music.visualizer.presets.${preset.id}.description`)}</span>
          </button>;
        })}
      </div>
    </MusicSettingsPanel>

    <MusicSettingsPanel title={t('music.visualizer.shape_color')} icon={<PaletteIcon className="h-5 w-5" />}>
      <div className="music-appearance__modes">
        {Object.entries(VISUALIZER_MODES).filter(([mode]) => mode !== 'lyrics').map(([mode, definition]) => <button key={mode} type="button" aria-pressed={value.mode === mode}
          onClick={() => update({ mode, position: definition.position })}
          className="music-appearance__mode">
          <VisualizerPreview settings={{ ...previewValue, mode }} animated={false} thumbnail className="block w-full h-14 bg-[#101421]" />
          <span className="block py-2">{t(`music.visualizer.modes.${mode}`)}</span>
        </button>)}
      </div>
      {select(t('music.visualizer.palette'), 'colorMode', { accent: t('music.visualizer.palette_options.accent'), theme: t('music.visualizer.palette_options.theme'), auto: t('music.visualizer.palette_options.auto'), wallpaper: t('music.visualizer.palette_options.wallpaper'), gradient: t('music.visualizer.palette_options.gradient'), custom: t('music.visualizer.palette_options.custom') })}
      <div className="flex items-center gap-2">
        {swatches.map(([color, color2]) => <button key={color} type="button" title={`${color} / ${color2}`} aria-label={t('music.visualizer.gradient_aria', { color, color2 })}
          onClick={() => update({ colorMode: 'gradient', color, color2 })}
          className={`h-8 flex-1 rounded-lg border-2 focus-visible:ring-2 focus-visible:ring-primary ${value.color === color && value.color2 === color2 && value.colorMode === 'gradient' ? 'border-primary' : 'border-transparent'}`}
          style={{ background: `linear-gradient(120deg, ${color}, ${color2})` }} />)}
      </div>
      {(value.colorMode === 'custom' || value.colorMode === 'gradient') && <div className="music-appearance__colors">
        <div><span>{t('music.visualizer.first_color')}</span><ColorPickerField value={value.color} onInput={(color) => update({ color })} onChange={(color) => update({ color })} ariaLabel={t('music.visualizer.first_color')} /></div>
        {value.colorMode === 'gradient' && <div><span>{t('music.visualizer.second_color')}</span><ColorPickerField value={value.color2} onInput={(color2) => update({ color2 })} onChange={(color2) => update({ color2 })} ariaLabel={t('music.visualizer.second_color')} /></div>}
      </div>}
      {(value.colorMode === 'auto' || value.colorMode === 'wallpaper') && <p className="text-[11px] text-[var(--text-tertiary)]">{t('music.visualizer.palette_hint')}</p>}
      <div className="music-appearance__group space-y-4">
      {slider(t('music.visualizer.glow'), 'glow', 100)}
      {slider(t('music.visualizer.intensity'), 'intensity', 100)}
      {slider(t('music.visualizer.opacity'), 'opacity', 100)}
      </div>
    </MusicSettingsPanel>

    <MusicSettingsPanel title={t('music.visualizer.size_position')} icon={<LayoutIcon className="h-5 w-5" />}>
      {select(t('music.visualizer.position'), 'position', { center: t('music.visualizer.positions.center'), bottom: t('music.visualizer.positions.bottom'), top: t('music.visualizer.positions.top'), full: t('music.visualizer.positions.full') })}
      {slider(t('music.visualizer.width'), 'width', 200, 20)}
      {slider(t('music.visualizer.height'), 'height', 200, 20)}
      {slider(t('music.visualizer.offset_x'), 'offsetX', 100, -100)}
      {slider(t('music.visualizer.offset_y'), 'offsetY', 100, -100)}
      <p className="text-[11px] leading-relaxed text-[var(--text-tertiary)]">{t('music.visualizer.position_hint')}</p>
      <MusicToggleRow label={t('music.visualizer.auto_offset')} checked={value.visualizerAvoidContent} onChange={visualizerAvoidContent => update({ visualizerAvoidContent })} />
      {value.output === 'overlay' && ['radial', 'rings', 'portal', 'prism', 'nebula'].includes(value.mode) && <p className="text-xs text-[var(--text-secondary)]">{t('music.visualizer.page_offset_hint')}</p>}
      <button type="button" disabled={!enabled || value.output === 'widget'} className="music-appearance__button"
        onClick={() => { void controlLyrics('edit', { hint: t('music.visualizer.page_hint'), doneLabel: t('music.lyrics.done') }, 'music_visualizer').then(response => setEditNotice(t(response ? 'music.visualizer.editing' : 'music.visualizer.open_vk')), () => setEditNotice(t('music.visualizer.open_vk'))); }}>{t('music.visualizer.edit_page')}</button>
      {editNotice && <p role="status" className="text-xs text-[var(--text-secondary)]">{editNotice}</p>}
      <button type="button" className="music-appearance__button" onClick={() => update({ width: 100, height: 100, offsetX: 0, offsetY: 0, position: VISUALIZER_MODES[value.mode as VisualizerMode].position })}>{t('music.visualizer.reset_position')}</button>
    </MusicSettingsPanel>

    <MusicDisclosure title={t('music.visualizer.advanced')}>
        <MusicToggleRow checked={value.hideWhenPaused} onChange={hideWhenPaused => update({ hideWhenPaused })} label={t('music.visualizer.hide_paused')} />
        <p className="text-[11px] text-[var(--text-tertiary)]">{t('music.visualizer.hide_paused_hint')}</p>
        {slider(t('music.visualizer.scale'), 'scale', 150, 50)}{slider(t('music.visualizer.smoothing'), 'smoothing', 100)}{slider(t('music.visualizer.speed'), 'speed', 200, 25)}
        {slider(t('music.visualizer.bass'), 'bass', 200)}{slider(t('music.visualizer.mids'), 'mids', 200)}{slider(t('music.visualizer.treble'), 'treble', 200)}
        {slider(t('music.visualizer.blur'), 'blur', 30)}
        <div className="grid grid-cols-2 gap-3">
          {select(t('music.visualizer.fps'), 'fps', { auto: t('music.visualizer.auto'), '30': '30 FPS', '60': '60 FPS' })}
          {select(t('music.visualizer.quality'), 'quality', { auto: t('music.visualizer.auto'), low: t('music.visualizer.quality_options.low'), medium: t('music.visualizer.quality_options.medium'), high: t('music.visualizer.quality_options.high') })}
        </div>
        <p className="text-[11px] leading-relaxed text-[var(--text-tertiary)]">{t('music.visualizer.performance_hint')}</p>
    </MusicDisclosure>
  </div>;
}
