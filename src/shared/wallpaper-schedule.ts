import { isSafeBackgroundResource } from './background-resource.js';
import { isWallpaperId, isWallpaperPropertySchemaJson } from './wallpaper-properties.js';

export type WallpaperPeriod = 'day' | 'night';
export interface ScheduledWallpaper {
  url: string;
  type: 'image' | 'video' | 'embed' | 'web';
  presetId: string;
  webId: string;
  webSchema: string;
}
export interface WallpaperSchedule {
  dayStart: string;
  nightStart: string;
  day: ScheduledWallpaper | null;
  night: ScheduledWallpaper | null;
}
export const DEFAULT_WALLPAPER_SCHEDULE: WallpaperSchedule = { dayStart: '07:00', nightStart: '22:00', day: null, night: null };
export function manualWallpaperPatch(patch: Record<string, unknown>): Record<string, unknown> {
  return { ...patch, wallpaper_schedule_enabled: false };
}
export function removeScheduledWallpaper(settings: Record<string, unknown>, period: WallpaperPeriod): Record<string, unknown> {
  return { wallpaper_schedule: JSON.stringify({ ...parseWallpaperSchedule(settings.wallpaper_schedule), [period]: null }), wallpaper_schedule_enabled: false };
}
export const isScheduleTime = (value: unknown): value is string => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

function isWallpaper(value: unknown): value is ScheduledWallpaper {
  if (!value || typeof value !== 'object') return false;
  const w = value as ScheduledWallpaper;
  return typeof w.url === 'string' && !!w.url.trim() && isSafeBackgroundResource(w.url)
    && ['image', 'video', 'embed', 'web'].includes(w.type)
    && (!w.url.startsWith('data:') || (w.type === 'image' ? /^data:image\//i.test(w.url) : w.type === 'video' && /^data:video\//i.test(w.url)))
    && typeof w.presetId === 'string' && w.presetId.length <= 256
    && typeof w.webId === 'string' && (!w.webId || isWallpaperId(w.webId))
    && isWallpaperPropertySchemaJson(w.webSchema);
}
export function isWallpaperScheduleJson(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const s = JSON.parse(value) as WallpaperSchedule;
    return !!s && isScheduleTime(s.dayStart) && isScheduleTime(s.nightStart) && s.dayStart !== s.nightStart
      && (s.day === null || isWallpaper(s.day)) && (s.night === null || isWallpaper(s.night));
  } catch { return false; }
}
export function parseWallpaperSchedule(value: unknown): WallpaperSchedule {
  return isWallpaperScheduleJson(value) ? JSON.parse(value as string) as WallpaperSchedule : { ...DEFAULT_WALLPAPER_SCHEDULE };
}
const minutes = (time: string): number => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export function wallpaperPeriod(schedule: WallpaperSchedule, now = new Date()): WallpaperPeriod {
  const minute = now.getHours() * 60 + now.getMinutes();
  const start = minutes(schedule.dayStart), end = minutes(schedule.nightStart);
  const day = start < end ? minute >= start && minute < end : minute >= start || minute < end;
  return day ? 'day' : 'night';
}
export function nextWallpaperSwitch(schedule: WallpaperSchedule, now = new Date()): Date {
  return [schedule.dayStart, schedule.nightStart].map(time => {
    const next = new Date(now);
    next.setHours(Number(time.slice(0, 2)), Number(time.slice(3)), 0, 0);
    if (next <= now) { next.setDate(next.getDate() + 1); next.setHours(Number(time.slice(0, 2)), Number(time.slice(3)), 0, 0); }
    return next;
  }).sort((a, b) => a.getTime() - b.getTime())[0];
}
export function captureWallpaper(settings: Record<string, unknown>): ScheduledWallpaper | null {
  const wallpaper = {
    url: settings.custom_background,
    type: settings.background_type || 'image',
    presetId: settings.background_preset_id || '',
    webId: settings.web_wallpaper_id || '',
    webSchema: settings.web_wallpaper_schema || '[]',
  };
  return isWallpaper(wallpaper) ? wallpaper : null;
}
/** Resolve locally: the schedule never overwrites the user's manually selected wallpaper. */
export function resolveScheduledBackground(settings: Record<string, unknown>, now = new Date()): Record<string, unknown> {
  if (settings.wallpaper_schedule_enabled !== true) return settings;
  const schedule = parseWallpaperSchedule(settings.wallpaper_schedule);
  if (!schedule.day || !schedule.night) return settings;
  const wallpaper = schedule[wallpaperPeriod(schedule, now)]!;
  return { ...settings, custom_background: wallpaper.url, background_type: wallpaper.type,
    background_preset_id: wallpaper.presetId, web_wallpaper_id: wallpaper.webId, web_wallpaper_schema: wallpaper.webSchema };
}
