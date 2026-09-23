import { downloadText } from '@/shared/utils/download.js';
import { controlLyrics } from '@/popup/utils/tabs.js';
import { EqualizerIcon, PlayIcon } from '@/popup/components/icons/Icons.js';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Toggle from '@/popup/components/ui/Toggle.js';
import RangeSlider from '@/popup/components/ui/RangeSlider.js';
import ColorPickerField from '@/popup/components/ui/ColorPickerField.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { LYRICS_DEFAULTS, parseLyricsSettings, exportLyrics, type LyricsSnapshot } from '@/shared/music-lyrics.js';
import type { VisualizerSettings } from '@/shared/music-visualizer.js';
import { sanitizeFilename } from '@/shared/utils/filename.js';
import VisualizerPreview from './VisualizerPreview.js';

const card = 'rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-4 space-y-4';
const button = 'rounded-xl border border-[var(--border-color)] px-3 py-2 text-xs hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed';

async function activeTabMessage(type: string, labels: Record<string, string> = {}): Promise<unknown> {
  return controlLyrics(type === 'VKIFY_LYRICS_EDIT' ? 'edit' : 'snapshot', labels);
}

export default function MusicLyricsPage(): React.ReactElement {
  const { t } = useTranslation('center');
  const settings = useVKifyStore(s => s.settings);
  const saveSetting = useVKifyStore(s => s.saveSetting);
  const enabled = settings.music_lyrics === true;
  const value = parseLyricsSettings(settings.music_lyrics_settings);
  const [snapshot, setSnapshot] = useState<LyricsSnapshot | null>(null);
  const [notice, setNotice] = useState('');
  const [animated, setAnimated] = useState(true);
  const label = (key: string): string => t(`music.lyrics.${key}`);
  const update = (patch: Partial<VisualizerSettings>): void => {
    const current = parseLyricsSettings(useVKifyStore.getState().settings.music_lyrics_settings);
    if (patch.lyricsStyle) patch.lyricsNeighbors = patch.lyricsStyle === 'flow';
    if (patch.lyricsNeighbors) {
      patch.lyricsLineCount = Math.max(3, current.lyricsLineCount);
      patch.lyricsSecondaryOpacity = current.lyricsSecondaryOpacity || 18;
    }
    void saveSetting('music_lyrics_settings', JSON.stringify({ ...current, ...patch }));
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
    <label className="block text-xs text-[var(--text-secondary)]">{text}<select value={String(value[key])} onChange={e => update({ [key]: e.target.value })}
      className="block w-full mt-2 px-3 py-2 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)]">
      {Object.entries(options).map(([id, text]) => <option key={id} value={id}>{text}</option>)}
    </select></label>;
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
  return <div className="space-y-4" data-vkify-anchor="music_lyrics">
    <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><EqualizerIcon className="w-5 h-5" /></div>
          <div><h3 className="text-sm font-semibold text-[var(--text-primary)]">{label('title')}</h3>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{label('description')}</p></div>
        </div>
        <div className="shrink-0 [&>label>span]:sr-only"><Toggle checked={enabled} onChange={next => void saveSetting('music_lyrics', next)} label={label('title')} /></div>
      </div>
      <div className="relative overflow-hidden bg-[#0b0e19]" style={{ backgroundImage: 'radial-gradient(ellipse at 25% 100%, #1e2544 0%, transparent 70%)' }}>
        <div className="absolute top-3 left-4 z-10 flex items-center gap-2 text-[10px] font-semibold tracking-widest uppercase text-slate-400"><span className="w-1 h-1 rounded-full bg-cyan-300" />{t('music.visualizer.demo')}</div>
        <button type="button" aria-pressed={animated} onClick={() => setAnimated(!animated)} className="absolute top-2 right-3 z-10 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] text-slate-300 hover:bg-white/10"><PlayIcon className="w-3 h-3" />{t(animated ? 'music.visualizer.stop' : 'music.visualizer.animate')}</button>
        <VisualizerPreview settings={value} animated={animated} onOffsetChange={(offsetX, offsetY) => update({ offsetX, offsetY })} onCoverOffsetChange={(lyricsCoverX, lyricsCoverY) => update({ lyricsCoverX, lyricsCoverY })} className="block w-full h-52 cursor-grab active:cursor-grabbing" />
        <div className="absolute bottom-3 left-4 text-[10px] text-slate-400 pointer-events-none">{label('drag_hint')}</div>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{label('availability')}</p>
        <button type="button" className="rounded-xl bg-primary/10 px-3 py-2 text-xs text-primary hover:bg-primary/20 disabled:opacity-40" disabled={!enabled} onClick={() => void editPage()}>{label('edit_page')}</button>
        {notice && <p role="status" className="text-xs text-primary">{notice}</p>}
      </div>
    </section>
    <section className={card}>
      <h3 className="text-sm font-semibold">{label('presets')}</h3>
      <div className="grid grid-cols-3 gap-2">
        {[
          { id: 'wide', patch: {} },
          { id: 'side', patch: { width: 38, lyricsSize: 65, offsetX: 57, lyricsLineCount: 5, lyricsShowCover: true, lyricsCoverX: 80, lyricsCoverSize: 16 } },
          { id: 'focus', patch: { lyricsStyle: 'focus', lyricsNeighbors: false, lyricsShowCover: true, lyricsCoverSize: 22, offsetY: 12 } },
        ].map(preset => <button key={preset.id} type="button" className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-left hover:border-primary focus-visible:ring-2 focus-visible:ring-primary" onClick={() => void saveSetting('music_lyrics_settings', JSON.stringify({ ...LYRICS_DEFAULTS, ...preset.patch }))}>
          <VisualizerPreview settings={parseLyricsSettings({ ...LYRICS_DEFAULTS, ...preset.patch })} animated={false} className="block w-full h-20 bg-[#0b0e19] pointer-events-none" />
          <span className="block p-3 text-xs font-semibold text-[var(--text-primary)]">{label(preset.id)}</span>
        </button>)}
      </div>
      {select(label('style'), 'lyricsStyle', { flow: 'Flow', focus: 'Focus' })}
      {select(label('align'), 'lyricsAlignment', { left: label('left'), center: label('center'), right: label('right') })}
      {select(t('music.visualizer.palette'), 'colorMode', { custom: t('music.visualizer.palette_options.custom'), accent: t('music.visualizer.palette_options.accent'), theme: t('music.visualizer.palette_options.theme'), auto: t('music.visualizer.palette_options.auto') })}
      <ColorPickerField value={value.color} onInput={color => update({ color, colorMode: 'custom' })} onChange={color => update({ color, colorMode: 'custom' })} ariaLabel={label('color')} />
      {slider(label('size'), 'lyricsSize', 50, 200)}
      {slider(label('opacity'), 'opacity', 0, 100)}
      {slider(label('secondary'), 'lyricsSecondaryOpacity', 0, 70)}
      <Toggle checked={value.lyricsNeighbors} onChange={lyricsNeighbors => update({ lyricsNeighbors })} label={label('neighbors')} />
      {slider(label('lines'), 'lyricsLineCount', 1, 11, '')}
      {slider(label('spacing'), 'lyricsLineSpacing', 50, 200)}
    </section>
    <section className={card}>
      <h3 className="text-sm font-semibold">{label('placement')}</h3>
      {slider(t('music.visualizer.width'), 'width', 20, 200)}
      {slider(t('music.visualizer.offset_x'), 'offsetX', -100, 100)}
      {slider(t('music.visualizer.offset_y'), 'offsetY', -100, 100)}
      {select(label('layer'), 'lyricsLayer', { background: label('background'), foreground: label('foreground') })}
      <button type="button" className={button} onClick={() => update({ offsetX: 0, offsetY: 0, width: 100, position: 'full' })}>{t('music.visualizer.reset_position')}</button>
    </section>
    <section className={card}>
      <Toggle checked={value.lyricsShowCover} onChange={lyricsShowCover => update({ lyricsShowCover })} label={label('cover')} />
      {value.lyricsShowCover && <>
        {slider(label('cover_size'), 'lyricsCoverSize', 5, 60)}
        {slider(t('music.visualizer.offset_x'), 'lyricsCoverX', 0, 100)}
        {slider(t('music.visualizer.offset_y'), 'lyricsCoverY', 0, 100)}
        {slider(label('opacity'), 'lyricsCoverOpacity', 0, 100)}
        {slider(label('radius'), 'lyricsCoverRadius', 0, 50)}
        {slider(t('music.visualizer.blur'), 'lyricsCoverBlur', 0, 30, ' px')}
      </>}
    </section>
    <details className={card}><summary className="text-sm font-semibold cursor-pointer">{t('music.visualizer.advanced')}</summary>
      {slider(t('music.visualizer.intensity'), 'intensity', 0, 100)}
      {slider(t('music.visualizer.lyrics.sensitivity'), 'lyricsSensitivity', 0, 200)}
      {slider(t('music.visualizer.glow'), 'glow', 0, 100)}
      {slider(t('music.visualizer.blur'), 'blur', 0, 30, ' px')}
      {select(t('music.visualizer.fps'), 'fps', { auto: 'Auto', '30': '30 FPS', '60': '60 FPS' })}
      <Toggle checked={value.hideWhenPaused} onChange={hideWhenPaused => update({ hideWhenPaused })} label={t('music.visualizer.hide_paused')} />
      <button type="button" className={button} onClick={() => void saveSetting('music_lyrics_settings', JSON.stringify(LYRICS_DEFAULTS))}>{t('music.visualizer.reset_all')}</button>
    </details>
    <section className={card}>
      <h3 className="text-sm font-semibold">{label('save')}</h3>
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
    </section>
  </div>;
}
