import { isWallpaperScheduleJson, parseWallpaperSchedule } from '../../wallpaper-schedule.js';
import type { Migration } from './types.js';

export const migrateV19ToV20: Migration = {
  to: 20,
  description: 'Initialize day/night wallpaper scheduling while preserving existing wallpapers and valid schedules',
  migrate(old) {
    const next = { ...old };
    // Freeze the migration's defaults independently of future UI defaults.
    if (!isWallpaperScheduleJson(next.wallpaper_schedule)) {
      next.wallpaper_schedule = JSON.stringify({ dayStart: '07:00', nightStart: '22:00', day: null, night: null });
    }
    const schedule = parseWallpaperSchedule(next.wallpaper_schedule);
    next.wallpaper_schedule_enabled = next.wallpaper_schedule_enabled === true && !!schedule.day && !!schedule.night;
    return next;
  },
};
