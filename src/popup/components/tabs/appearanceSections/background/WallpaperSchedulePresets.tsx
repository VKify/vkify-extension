import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { wallpaperCatalog } from '@/popup/utils/wallpaperCatalog.js';
import { getBase64Image, dataUrlByteSize } from '@/popup/utils/imageToBase64.js';
import { shouldCacheBackground } from '@/shared/background-source.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { parseWallpaperSchedule } from '@/shared/wallpaper-schedule.js';
import type { CatalogWallpaper } from '@/shared/wallpaper-catalog.js';
import WallpaperPreview from './WallpaperPreview.js';
import SettingsDisclosure from '@/popup/components/ui/SettingsDisclosure.js';
import { ImageIcon, SunIcon, MoonIcon, CheckIcon } from '@/popup/components/icons/Icons.js';

// Stable VK photo references: resolve fresh CDN URLs instead of shipping expiring links.
const presets = [
  { id: 'bridge', day: '-235511300_457239136', night: '-235511300_457239135' },
  { id: 'dream', day: '-235511300_457239149', night: '-235511300_457239146' },
] as const;

export default function WallpaperSchedulePresets(): React.ReactElement {
  const { t } = useTranslation('appearance');
  const scheduleValue = useVKifyStore(s => s.settings.wallpaper_schedule);
  const saveSetting = useVKifyStore(s => s.saveSetting);
  const [photos, setPhotos] = useState<CatalogWallpaper[]>([]);
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [applyFailed, setApplyFailed] = useState(false);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setFailed(false);
    void wallpaperCatalog.photos(presets.flatMap(p => [p.day, p.night])).then(items => {
      if (alive) { setPhotos(items); setLoading(false); }
    }).catch(() => { if (alive) { setFailed(true); setLoading(false); } });
    return () => { alive = false; };
  }, [attempt, open]);
  const label = (key: string): string => t(`background.schedule.${key}`);
  const schedule = parseWallpaperSchedule(scheduleValue);
  async function apply(id: string, day: CatalogWallpaper, night: CatalogWallpaper): Promise<void> {
    if (busy) return;
    setBusy(id);
    setApplyFailed(false);
    try {
      const pair = await Promise.all([day, night].map(async photo => {
        // Match the regular wallpaper picker: VK CDN images are allowed by VK's
        // CSP and do not need canvas conversion (which can fail without CORS).
        let url = photo.url;
        if (shouldCacheBackground(url)) {
          url = await getBase64Image(url, { maxWidth: 1920, quality: 0.85 });
          if (!url.startsWith('data:image/') || dataUrlByteSize(url) > 5 * 1024 * 1024) throw new Error('INVALID_IMAGE');
        }
        return { url, type: 'image' as const, presetId: photo.id };
      }));
      // Commit both slots together; preserve any time edits made during the download.
      await saveSetting('wallpaper_schedule', JSON.stringify({
        ...parseWallpaperSchedule(useVKifyStore.getState().settings.wallpaper_schedule), day: pair[0], night: pair[1],
      }));
    } catch { setApplyFailed(true); }
    finally { setBusy(null); }
  }
  return <SettingsDisclosure title={label('presets_title')} icon={<ImageIcon className="h-4 w-4" />}
    badge={presets.length} open={open} onToggle={() => setOpen(value => !value)}>
    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{label('presets_hint')}</p>
    {loading && <p role="status" className="text-xs text-[var(--text-secondary)]">{t('background.gallery.loading')}</p>}
    {failed ? <div className="space-y-2">
      <p role="alert" className="text-xs text-[var(--text-secondary)]">{t('background.gallery.load_error')}</p>
      <button type="button" className="text-xs font-semibold text-primary" onClick={() => setAttempt(value => value + 1)}>{t('background.gallery.retry')}</button>
    </div> : !loading && <div className="grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">
      {presets.map(preset => {
        const day = photos.find(photo => photo.id === `vk-photo-${preset.day}`);
        const night = photos.find(photo => photo.id === `vk-photo-${preset.night}`);
        const selected = !!day && !!night && schedule.day?.presetId === day.id && schedule.night?.presetId === night.id;
        return <div key={preset.id} className={`rounded-xl border p-2.5 space-y-2.5 transition-colors ${selected ? 'border-primary/60 bg-primary/5' : 'border-[var(--border-color)] bg-[var(--bg-secondary)]'}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 text-xs font-semibold text-[var(--text-primary)]">{label(`preset_${preset.id}`)}</p>
            {selected && <CheckIcon className="h-4 w-4 shrink-0 text-primary" />}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['day', 'night'] as const).map(slot => <div key={slot} className="min-w-0 space-y-1.5">
              <div className="overflow-hidden rounded-lg">
                <WallpaperPreview url={selected ? schedule[slot]?.url : (slot === 'day' ? day : night)?.preview} type="image" title={`${label(`preset_${preset.id}`)}: ${label(slot)}`} />
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                {slot === 'day' ? <SunIcon className="h-3 w-3" /> : <MoonIcon className="h-3 w-3" />}{label(slot)}
              </p>
            </div>)}
          </div>
          <div>
            <button type="button" disabled={!!busy || !day || !night || selected}
              aria-pressed={selected}
              onClick={() => { if (day && night) void apply(preset.id, day, night); }}
              className={`w-full rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${selected ? '' : 'hover:bg-primary/20 disabled:opacity-40'}`}>
              {busy === preset.id ? t('background.uploading') : selected ? label('preset_selected') : label('preset_apply')}
            </button>
            {(!day || !night) && <p className="mt-2 text-[11px] text-[var(--text-secondary)]">{label('preset_unavailable')}</p>}
          </div>
        </div>;
      })}
    </div>}
    {applyFailed && <p role="alert" className="text-xs text-red-500">{label('preset_error')}</p>}
  </SettingsDisclosure>;
}
