import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVKifyStore } from '@/popup/store/index.js';
import Toggle from '@/popup/components/ui/Toggle.js';
import { DashboardSettingCard } from '@/popup/components/ui/DashboardPrimitives.js';
import { ClockIcon, SunIcon, MoonIcon, CheckIcon, TrashIcon } from '@/popup/components/icons/Icons.js';
import WallpaperPreview from './WallpaperPreview.js';
import { captureWallpaper, parseWallpaperSchedule, wallpaperPeriod, nextWallpaperSwitch, isScheduleTime, resolveScheduledBackground, removeScheduledWallpaper, type WallpaperPeriod } from '@/shared/wallpaper-schedule.js';

export default function WallpaperScheduleSettings({ onChoose }: { onChoose: (period: WallpaperPeriod) => void }): React.ReactElement {
  const { t, i18n } = useTranslation('appearance');
  const settings = useVKifyStore(s => s.settings);
  const saveSetting = useVKifyStore(s => s.saveSetting);
  const saveMultiple = useVKifyStore(s => s.saveMultiple);
  const schedule = parseWallpaperSchedule(settings.wallpaper_schedule);
  const enabled = settings.wallpaper_schedule_enabled === true;
  const ready = !!schedule.day && !!schedule.night;
  const current = captureWallpaper(resolveScheduledBackground(settings));
  const [now, setNow] = useState(() => new Date());
  const [times, setTimes] = useState({ day: schedule.dayStart, night: schedule.nightStart });
  const [error, setError] = useState(false);
  useEffect(() => { setTimes({ day: schedule.dayStart, night: schedule.nightStart }); }, [schedule.dayStart, schedule.nightStart]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const label = (key: string): string => t(`background.schedule.${key}`);
  const period = wallpaperPeriod(schedule, now);
  const next = nextWallpaperSwitch(schedule, now);
  const nextPeriod = wallpaperPeriod(schedule, next);
  const saveSlot = (slot: WallpaperPeriod): void => {
    if (current) void saveSetting('wallpaper_schedule', JSON.stringify({ ...parseWallpaperSchedule(useVKifyStore.getState().settings.wallpaper_schedule), [slot]: current }));
  };
  const changeTime = (slot: WallpaperPeriod, value: string): void => {
    const nextTimes = { ...times, [slot]: value };
    setTimes(nextTimes);
    const invalid = !isScheduleTime(nextTimes.day) || !isScheduleTime(nextTimes.night) || nextTimes.day === nextTimes.night;
    setError(invalid);
    if (!invalid) void saveSetting('wallpaper_schedule', JSON.stringify({ ...schedule, dayStart: nextTimes.day, nightStart: nextTimes.night }));
  };

  return <div className="space-y-4" data-vkify-anchor="wallpaper_schedule_enabled">
    <DashboardSettingCard icon={<ClockIcon className="h-5 w-5" />} title={label('title')} description={label('description')}
      control={<Toggle checked={enabled} disabled={!ready && !enabled} ariaLabel={label('title')}
        onChange={value => void saveSetting('wallpaper_schedule_enabled', value)} />} />

    <div className="grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">
      {(['day', 'night'] as const).map(slot => {
        const wallpaper = schedule[slot];
        const Icon = slot === 'day' ? SunIcon : MoonIcon;
        const active = enabled && ready && slot === period;
        return <div key={slot} className={`rounded-xl border overflow-hidden ${active ? 'border-primary ring-1 ring-primary/20' : 'border-[var(--border-color)]'}`}>
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-[var(--bg-secondary)]">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]"><Icon className="h-4 w-4 text-primary" />{label(slot)}</span>
            <div className="flex items-center gap-2">
              {active && <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary"><CheckIcon className="h-3 w-3" />{label('active')}</span>}
              {wallpaper && <button type="button" title={`${label('remove')}: ${label(slot)}`} aria-label={`${label('remove')}: ${label(slot)}`}
                onClick={() => void saveMultiple(removeScheduledWallpaper(useVKifyStore.getState().settings, slot))}
                className="rounded-md p-1 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 transition-colors"><TrashIcon className="h-4 w-4" /></button>}
            </div>
          </div>
          <WallpaperPreview url={wallpaper?.url} type={wallpaper?.type} title={`${label(slot)}: ${t('background.types.' + (wallpaper?.type || 'image'))}`} />
          <div className="p-3 space-y-3">
            <label className="flex items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
              <span>{label('starts')}</span>
              <input type="time" value={times[slot]} aria-label={`${label(slot)}: ${label('starts')}`}
                onChange={event => changeTime(slot, event.target.value)}
                className="min-w-0 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2 py-1.5 text-[var(--text-primary)] focus:outline-none focus:border-primary [color-scheme:light_dark]" />
            </label>
            <button type="button" onClick={() => onChoose(slot)} aria-label={`${label('choose')}: ${label(slot)}`}
              className="w-full rounded-lg bg-primary/10 px-2 py-2 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors">
              {wallpaper ? label('replace') : label('choose')}
            </button>
            {current && <button type="button" onClick={() => saveSlot(slot)} aria-label={`${label('use_current')}: ${label(slot)}`}
              className="w-full text-[11px] text-[var(--text-secondary)] hover:text-primary">{label('use_current')}</button>}
          </div>
        </div>;
      })}
    </div>
    {error && <p role="alert" className="text-xs text-red-500">{label('time_error')}</p>}
    <div className="rounded-xl bg-primary/10 px-3 py-3 text-xs text-[var(--text-secondary)] space-y-1.5">
      <p className="font-semibold text-[var(--text-primary)]">{enabled && ready
        ? t('background.schedule.status', { period: label(period), next: label(nextPeriod), time: new Intl.DateTimeFormat(i18n.resolvedLanguage, { hour: '2-digit', minute: '2-digit', hour12: false }).format(next) })
        : label(ready ? 'ready' : 'setup')}</p>
      <p>{label('local_time')}</p>
    </div>
  </div>;
}
