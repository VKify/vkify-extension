import React, { useState } from 'react';
import RangeSlider from '@/popup/components/ui/RangeSlider.js';
import ColorPickerField from '@/popup/components/ui/ColorPickerField.js';
import Toggle from '@/popup/components/ui/Toggle.js';
import { EqualizerIcon, PlayIcon, SettingsIcon } from '@/popup/components/icons/Icons.js';
import { parseVisualizerSettings, VISUALIZER_PRESETS, VISUALIZER_MODES, visualizerPreset, VISUALIZER_DEFAULTS, type VisualizerSettings, type VisualizerMode } from '@/shared/music-visualizer.js';
import { useVKifyStore } from '@/popup/store/index.js';
import VisualizerPreview from './VisualizerPreview.js';

const swatches = [['#22d3ee', '#c084fc'], ['#818cf8', '#2dd4bf'], ['#fb7185', '#fbbf24'], ['#a5b4fc', '#f9a8d4'], ['#e2e8f0', '#7dd3fc']];
const card = 'rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)]';

export default function MusicVisualizerPage(): React.ReactElement {
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const [animatePreview, setAnimatePreview] = useState(true);
  const value = parseVisualizerSettings(settings.music_visualizer_settings);
  const accent = typeof settings.custom_accent === 'string' && /^#[0-9a-f]{6}$/i.test(settings.custom_accent) ? settings.custom_accent : '#5181b8';
  const theme = typeof settings.custom_theme === 'string' && /^#[0-9a-f]{6}$/i.test(settings.custom_theme) ? settings.custom_theme : accent;
  const previewValue = value.colorMode === 'accent' || value.colorMode === 'theme'
    ? { ...value, color: value.colorMode === 'theme' ? theme : accent, color2: accent, colorMode: value.colorMode === 'theme' ? 'gradient' : 'custom' }
    : value;
  const enabled = settings.music_visualizer === true;
  const update = (patch: Partial<VisualizerSettings>): void => {
    const current = parseVisualizerSettings(useVKifyStore.getState().settings.music_visualizer_settings);
    void saveSetting('music_visualizer_settings', JSON.stringify({ ...current, ...patch }));
  };
  const select = (label: string, key: keyof VisualizerSettings, options: Record<string, string>): React.ReactElement => (
    <label className="block text-xs text-[var(--text-secondary)]">{label}
      <select value={String(value[key])} onChange={(event) => update({ [key]: event.target.value })}
        className="block w-full mt-2 px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-primary/40">
        {Object.entries(options).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </label>
  );
  const slider = (label: string, key: keyof VisualizerSettings, max: number, min = 0): React.ReactElement => (
    <RangeSlider id={`visualizer-${key}`} label={label} value={Number(value[key])} min={min} max={max} step={1}
      unit={key === 'blur' ? ' px' : '%'} inline
      minLabel={key === 'offsetX' ? 'Влево' : key === 'offsetY' ? 'Вверх' : undefined}
      maxLabel={key === 'offsetX' ? 'Вправо' : key === 'offsetY' ? 'Вниз' : undefined}
      onChange={(next) => update({ [key]: next })} />
  );
  return <div className="space-y-4" data-vkify-anchor="music_visualizer">
    <section className={`${card} overflow-hidden`}>
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><EqualizerIcon className="w-5 h-5" /></div>
          <div><h3 className="text-sm font-semibold text-[var(--text-primary)]">Музыка в движении</h3>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Над обоями, под интерфейсом VK</p></div>
        </div>
        <div className="shrink-0 [&>label>span]:sr-only"><Toggle checked={enabled} onChange={(next) => void saveSetting('music_visualizer', next)} label="Включить визуализатор" /></div>
      </div>
      <div className="relative overflow-hidden bg-[#0b0e19]" style={{ backgroundImage: 'radial-gradient(ellipse at 25% 100%, #1e2544 0%, transparent 70%)' }}>
        <div className="absolute top-3 left-4 z-10 flex items-center gap-2 text-[10px] font-semibold tracking-widest uppercase text-slate-400">
          <span className="w-1 h-1 rounded-full bg-cyan-300" />Демопревью
        </div>
        <button type="button" onClick={() => setAnimatePreview((previous) => !previous)} aria-pressed={animatePreview}
          className="absolute top-2 right-3 z-10 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] text-slate-300 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-300">
          <PlayIcon className="w-3 h-3" />{animatePreview ? 'Остановить' : 'Анимировать'}
        </button>
        <VisualizerPreview settings={previewValue} animated={animatePreview} onOffsetChange={(offsetX, offsetY) => update({ offsetX, offsetY })} className="block w-full h-52 cursor-grab active:cursor-grabbing" />
        <div className="absolute bottom-3 left-4 text-[10px] text-slate-400 pointer-events-none">Перетащите эффект, чтобы изменить его положение</div>
      </div>
      <p className="px-4 py-3 text-xs leading-relaxed text-[var(--text-secondary)]">{enabled ? 'Запустите музыку VK — эффект будет реагировать на звук. При паузе движение плавно затихает.' : 'Выберите стиль и включите визуализатор. Превью использует демонстрационный ритм.'}</p>
    </section>

    <section className={`${card} p-4 space-y-3`}>
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-[var(--text-primary)]">Коллекция стилей</h3><span className="text-[10px] text-[var(--text-tertiary)]">Один клик — новый характер</span></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {VISUALIZER_PRESETS.map((preset) => {
          const snapshot = { ...visualizerPreset(preset.id), hideWhenPaused: value.hideWhenPaused };
          const selected = Object.keys(snapshot).every((key) => snapshot[key as keyof VisualizerSettings] === value[key as keyof VisualizerSettings]);
          return <button key={preset.id} type="button" aria-pressed={selected}
            onClick={() => void saveSetting('music_visualizer_settings', JSON.stringify(snapshot))}
            className={`p-3 text-left rounded-xl border transition-colors focus-visible:ring-2 focus-visible:ring-primary ${selected ? 'border-primary bg-primary/10' : 'border-[var(--border-color)] hover:border-primary/50 bg-[var(--bg-secondary)]'}`}>
            <div className="h-1 rounded-full mb-3" style={{ background: `linear-gradient(90deg, ${preset.color}, ${preset.color2})` }} />
            <span className="block text-xs font-semibold text-[var(--text-primary)]">{preset.name}</span>
            <span className="block mt-1 text-[10px] text-[var(--text-secondary)]">{preset.description}</span>
          </button>;
        })}
      </div>
    </section>

    <section className={`${card} p-4 space-y-4`}>
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Форма и цвет</h3>
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(VISUALIZER_MODES).map(([mode, definition]) => <button key={mode} type="button" aria-pressed={value.mode === mode}
          onClick={() => update({ mode, position: definition.position })}
          className={`rounded-xl overflow-hidden border text-xs transition-colors focus-visible:ring-2 focus-visible:ring-primary ${value.mode === mode ? 'border-primary text-primary' : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-primary/50'}`}>
          <VisualizerPreview settings={{ ...previewValue, mode }} animated={false} thumbnail className="block w-full h-14 bg-[#101421]" />
          <span className="block py-2">{definition.label}</span>
        </button>)}
      </div>
      {select('Палитра', 'colorMode', { accent: 'Акцент VKify', theme: 'Цвета темы', auto: 'Из обложки трека', wallpaper: 'Из изображения обоев', gradient: 'Градиент', custom: 'Один цвет' })}
      <div className="flex items-center gap-2">
        {swatches.map(([color, color2]) => <button key={color} type="button" title={`${color} / ${color2}`} aria-label={`Градиент ${color} и ${color2}`}
          onClick={() => update({ colorMode: 'gradient', color, color2 })}
          className={`h-8 flex-1 rounded-lg border-2 focus-visible:ring-2 focus-visible:ring-primary ${value.color === color && value.color2 === color2 && value.colorMode === 'gradient' ? 'border-primary' : 'border-transparent'}`}
          style={{ background: `linear-gradient(120deg, ${color}, ${color2})` }} />)}
      </div>
      {(value.colorMode === 'custom' || value.colorMode === 'gradient') && <div className="flex gap-3">
        <ColorPickerField value={value.color} onInput={(color) => update({ color })} onChange={(color) => update({ color })} ariaLabel="Первый цвет" />
        {value.colorMode === 'gradient' && <ColorPickerField value={value.color2} onInput={(color2) => update({ color2 })} onChange={(color2) => update({ color2 })} ariaLabel="Второй цвет" />}
      </div>}
      {(value.colorMode === 'auto' || value.colorMode === 'wallpaper') && <p className="text-[11px] text-[var(--text-tertiary)]">Превью показывает пример палитры. На странице цвета берутся из изображения; если оно недоступно для анализа, используется акцент VKify.</p>}
      {slider('Свечение', 'glow', 100)}
      {slider('Интенсивность', 'intensity', 100)}
      {slider('Непрозрачность эффекта', 'opacity', 100)}
    </section>

    <section className={`${card} p-4 space-y-3`}>
      <Toggle checked={value.hideWhenPaused} onChange={(hideWhenPaused) => update({ hideWhenPaused })} label="Скрывать, когда музыка не играет" />
      <p className="text-[11px] text-[var(--text-tertiary)]">Эффект скрывается на паузе и после окончания трека, затем возвращается при воспроизведении.</p>
    </section>

    <section className={`${card} p-4 space-y-5`}>
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Размер и положение</h3>
      {select('Расположение', 'position', { center: 'По центру', bottom: 'Снизу', top: 'Сверху', full: 'По всей странице' })}
      {slider('Ширина', 'width', 200, 20)}
      {slider('Высота', 'height', 200, 20)}
      {slider('Смещение по горизонтали', 'offsetX', 100, -100)}
      {slider('Смещение по вертикали', 'offsetY', 100, -100)}
      <p className="text-[11px] leading-relaxed text-[var(--text-tertiary)]">100% ширины и высоты — исходный размер эффекта. Смещение задаётся в процентах окна; положение также можно изменить перетаскиванием в превью.</p>
      <button type="button" className="text-xs text-[var(--text-secondary)] hover:text-primary" onClick={() => update({ width: 100, height: 100, offsetX: 0, offsetY: 0, position: VISUALIZER_MODES[value.mode as VisualizerMode].position })}>Сбросить размер и положение</button>
    </section>

    <details className={`${card} group`}>
      <summary className="cursor-pointer p-4 text-sm font-semibold text-[var(--text-primary)]"><SettingsIcon className="w-4 h-4 inline-block mr-2" />Тонкая настройка</summary>
      <div className="px-4 pb-4 space-y-5">
        {slider('Масштаб реакции', 'scale', 150, 50)}{slider('Плавность', 'smoothing', 100)}{slider('Скорость движения', 'speed', 200, 25)}
        {slider('Низкие частоты', 'bass', 200)}{slider('Средние частоты', 'mids', 200)}{slider('Высокие частоты', 'treble', 200)}
        {slider('Размытие', 'blur', 30)}
        <div className="grid grid-cols-2 gap-3">
          {select('Частота кадров', 'fps', { auto: 'Авто', '30': '30 FPS', '60': '60 FPS' })}
          {select('Качество', 'quality', { auto: 'Авто', low: 'Низкое', medium: 'Среднее', high: 'Высокое' })}
        </div>
        <p className="text-[11px] leading-relaxed text-[var(--text-tertiary)]">Анимация приостанавливается в скрытой вкладке и учитывает системное уменьшение движения.</p>
        <button type="button" className="text-xs text-[var(--text-secondary)] hover:text-primary" onClick={() => void saveSetting('music_visualizer_settings', JSON.stringify(VISUALIZER_DEFAULTS))}>Сбросить параметры визуализатора</button>
      </div>
    </details>
  </div>;
}
