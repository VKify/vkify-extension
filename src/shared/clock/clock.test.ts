import { describe, it, expect } from 'vitest';
import { CLOCK_DEFAULTS, parseClockSettings, isClockSettingsJson } from './settings.js';
import { formatClock, clockDelay } from './format.js';
import { clockPosition, clockStyle } from './style.js';
import { migrateV12ToV13 } from '../storage/migrations/migrate_v12_to_v13.js';
import { DEFAULT_SETTINGS, RESET_SETTINGS } from '../constants/defaults.js';
import { sanitizeSettings } from '../constants/settings-schema.js';

describe('clock preferences and formatting', () => {
  it.each([
    [0, false, false, '00:08'], [0, true, false, '12:08 AM'],
    [12, true, true, '12:08:09 PM'], [23, true, false, '11:08 PM'],
    [23, false, true, '23:08:09'],
  ])('formats hour %s, 12-hour %s, seconds %s', (hour, hour12, seconds, expected) => {
    expect(formatClock(new Date(2026, 8, 27, hour, 8, 9), { ...CLOCK_DEFAULTS, hour12, seconds }, 'ru')).toBe(expected);
  });
  it('supports numeric and localized dates', () => {
    const date = new Date(2026, 8, 27, 23, 48);
    expect(formatClock(date, { ...CLOCK_DEFAULTS, showDate: true }, 'ru')).toBe('27.09.2026 · 23:48');
    expect(formatClock(date, { ...CLOCK_DEFAULTS, showDate: true, dateFormat: 'long' }, 'ru')).toBe('27 сентября · 23:48');
    expect(formatClock(date, { ...CLOCK_DEFAULTS, showDate: true, dateFormat: 'long' }, 'en')).toBe('September 27 · 23:48');
  });
  it('aligns the timer to second/minute boundaries', () => {
    expect(clockDelay(false, 59010)).toBe(990);
    expect(clockDelay(true, 59010)).toBe(990);
    expect(clockDelay(false, 60000)).toBe(60000);
  });
  it('defaults to a disabled 24-hour clock without seconds', () => {
    expect(DEFAULT_SETTINGS.clock_enabled).toBe(false);
    expect(RESET_SETTINGS.clock_enabled).toBe(false);
    expect(parseClockSettings(DEFAULT_SETTINGS.clock_settings)).toEqual(CLOCK_DEFAULTS);
    expect(CLOCK_DEFAULTS).toMatchObject({ hour12: false, seconds: false });
  });
  it('normalizes corrupted storage and validates imports', () => {
    expect(parseClockSettings('{')).toEqual(CLOCK_DEFAULTS);
    expect(parseClockSettings({ fontSize: Infinity, color: 'red; background:url(x)', seconds: 'true' })).toEqual(CLOCK_DEFAULTS);
    const raw = JSON.stringify({ seconds: true, position: 'custom', x: 21.5, y: 72 });
    expect(isClockSettingsJson(raw)).toBe(true);
    expect(sanitizeSettings({ clock_enabled: true, clock_settings: raw }, 'import')).toEqual({ clock_enabled: true, clock_settings: raw });
    for (const invalid of ['[]', '{"x":-1}', '{"unknown":true}', '{"background":"url(x)"}']) expect(isClockSettingsJson(invalid)).toBe(false);
  });
  it('migrates additively and idempotently', () => {
    const old = { custom_accent: '#abcdef', music_visualizer: true, clock_settings: '{"seconds":true}' };
    const next = migrateV12ToV13.migrate(old);
    expect(next).toMatchObject({ custom_accent: '#abcdef', music_visualizer: true, clock_enabled: false });
    expect(parseClockSettings(next.clock_settings).seconds).toBe(true);
    expect(migrateV12ToV13.migrate(next)).toEqual(next);
    expect(old.clock_settings).toBe('{"seconds":true}');
  });
  it('keeps placement bounded and respects the header', () => {
    expect(clockPosition({ ...CLOCK_DEFAULTS, position: 'top-right' }, 1000, 700, 200, 50)).toEqual({ left: 776, top: 64 });
    expect(clockPosition({ ...CLOCK_DEFAULTS, position: 'custom', x: 100, y: 100 }, 320, 200, 300, 180)).toEqual({ left: 10, top: 10 });
    expect(clockStyle({ ...CLOCK_DEFAULTS, showBackground: false, glass: true })).toMatchObject({ background: 'transparent', backdropFilter: 'none' });
  });
});
