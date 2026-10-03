import { describe, expect, it } from 'vitest';
import { DEFAULT_WALLPAPER_SCHEDULE, captureWallpaper, isWallpaperScheduleJson, nextWallpaperSwitch, parseWallpaperSchedule, resolveScheduledBackground, wallpaperPeriod, manualWallpaperPatch, removeScheduledWallpaper } from './wallpaper-schedule.js';
import { isValidSettingValue } from './constants/settings-schema.js';

const date = (hour: number, minute = 0): Date => new Date(2026, 9, 3, hour, minute);
const day = captureWallpaper({ custom_background: 'https://example.com/day.jpg', background_type: 'image' })!;
const night = captureWallpaper({ custom_background: 'https://example.com/night.mp4', background_type: 'video' })!;
const schedule = { ...DEFAULT_WALLPAPER_SCHEDULE, day, night };

describe('wallpaper schedule', () => {
  it('turns off scheduling when a manual wallpaper is applied', () => {
    expect(manualWallpaperPatch({ custom_background: day.url })).toEqual({ custom_background: day.url, wallpaper_schedule_enabled: false });
  });
  it('removes only the requested wallpaper and turns off the schedule atomically', () => {
    const settings = { wallpaper_schedule_enabled: true, wallpaper_schedule: JSON.stringify(schedule) };
    const patch = removeScheduledWallpaper(settings, 'night');
    expect(patch.wallpaper_schedule_enabled).toBe(false);
    expect(parseWallpaperSchedule(patch.wallpaper_schedule)).toMatchObject({ day, night: null });
    expect(parseWallpaperSchedule(settings.wallpaper_schedule).night).toEqual(night);
  });
  it('includes day start and night start in their respective periods', () => {
    expect(wallpaperPeriod(schedule, date(6, 59))).toBe('night');
    expect(wallpaperPeriod(schedule, date(7))).toBe('day');
    expect(wallpaperPeriod(schedule, date(21, 59))).toBe('day');
    expect(wallpaperPeriod(schedule, date(22))).toBe('night');
    expect(wallpaperPeriod(schedule, date(0))).toBe('night');
  });
  it('supports day periods that cross midnight', () => {
    const reversed = { ...schedule, dayStart: '22:00', nightStart: '07:00' };
    expect(wallpaperPeriod(reversed, date(23))).toBe('day');
    expect(wallpaperPeriod(reversed, date(6))).toBe('day');
    expect(wallpaperPeriod(reversed, date(7))).toBe('night');
  });
  it('finds the next boundary, including tomorrow after the night starts', () => {
    expect(nextWallpaperSwitch(schedule, date(6))).toEqual(date(7));
    expect(nextWallpaperSwitch(schedule, date(7))).toEqual(date(22));
    expect(nextWallpaperSwitch(schedule, date(23))).toEqual(new Date(2026, 9, 4, 7));
  });
  it('resolves the current period without changing manual settings', () => {
    const settings = { custom_background: 'manual', wallpaper_schedule_enabled: true, wallpaper_schedule: JSON.stringify(schedule) };
    expect(resolveScheduledBackground(settings, date(23))).toMatchObject({ custom_background: night.url, background_type: 'video' });
    expect(settings.custom_background).toBe('manual');
    expect(resolveScheduledBackground({ ...settings, wallpaper_schedule_enabled: false }, date(23)).custom_background).toBe('manual');
  });
  it('falls back to manual wallpaper until both periods are configured', () => {
    const settings = { custom_background: 'manual', wallpaper_schedule_enabled: true, wallpaper_schedule: JSON.stringify({ ...schedule, night: null }) };
    expect(resolveScheduledBackground(settings, date(23))).toBe(settings);
  });
  it('rejects malformed times and unsafe resources, but accepts local photo snapshots', () => {
    for (const invalid of [null, '{}', JSON.stringify({ ...schedule, dayStart: '24:00' }), JSON.stringify({ ...schedule, dayStart: '22:00' }), JSON.stringify({ ...schedule, day: { ...day, url: 'javascript:alert(1)' } }), JSON.stringify({ ...schedule, night: { ...night, type: 'web', url: 'data:text/html;base64,AA==' } })]) {
      expect(isWallpaperScheduleJson(invalid)).toBe(false);
      expect(parseWallpaperSchedule(invalid)).toEqual(DEFAULT_WALLPAPER_SCHEDULE);
    }
    expect(isWallpaperScheduleJson(JSON.stringify({ ...schedule, day: { ...day, url: 'data:image/jpeg;base64,AA==' } }))).toBe(true);
  });
  it('preserves uploaded wallpapers across file import while keeping schedules out of shared themes', () => {
    const saved = JSON.stringify({ ...schedule, day: { ...day, url: `data:image/jpeg;base64,${'A'.repeat(100000)}` } });
    expect(isValidSettingValue('wallpaper_schedule', saved, 'import')).toBe(true);
    expect(isValidSettingValue('wallpaper_schedule', saved, 'theme')).toBe(false);
    expect(isValidSettingValue('custom_font_value', 'A'.repeat(100000), 'import')).toBe(false);
  });
});
