import type { ClockSettings } from './types.js';

export const CLOCK_DEFAULTS: Readonly<ClockSettings> = {
  hour12: false, seconds: false, showDate: false, dateFormat: 'short',
  position: 'bottom-left', margin: 24, x: 0, y: 100,
  fontSize: 28, opacity: 100, color: '#ffffff', background: '#151923',
  backgroundOpacity: 85, showBackground: true, radius: 16, fontWeight: 500, glass: false,
};
export const CLOCK_PRESETS = {
  minimal: { showBackground: true, glass: false, background: '#151923', backgroundOpacity: 85, color: '#ffffff', radius: 16, fontWeight: 500 },
  glass: { showBackground: true, glass: true, background: '#151923', backgroundOpacity: 35, color: '#ffffff', radius: 20, fontWeight: 500 },
  transparent: { showBackground: false, glass: false, color: '#ffffff', fontWeight: 600 },
} satisfies Record<string, Partial<ClockSettings>>;

const ranges: Partial<Record<keyof ClockSettings, [number, number]>> = {
  margin: [0, 120], x: [0, 100], y: [0, 100], fontSize: [12, 96],
  opacity: [10, 100], backgroundOpacity: [0, 100], radius: [0, 48], fontWeight: [300, 900],
};
const enums = { position: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'custom'], dateFormat: ['short', 'long'] };
function valid(key: keyof ClockSettings, value: unknown): boolean {
  if (key in ranges) { const [min, max] = ranges[key]!; return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max; }
  if (key === 'position' || key === 'dateFormat') return typeof value === 'string' && enums[key].includes(value);
  if (key === 'color' || key === 'background') return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  return typeof value === 'boolean';
}
function decode(raw: unknown): Record<string, unknown> | null {
  try {
    const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}
export function parseClockSettings(raw: unknown): ClockSettings {
  const result = { ...CLOCK_DEFAULTS };
  const input = decode(raw);
  for (const key of Object.keys(result) as (keyof ClockSettings)[]) {
    if (input && valid(key, input[key])) Object.assign(result, { [key]: input[key] });
  }
  return result;
}
export function isClockSettingsJson(raw: unknown): boolean {
  if (typeof raw !== 'string' || raw.length > 4096) return false;
  const input = decode(raw);
  return !!input && Object.entries(input).every(([key, value]) => Object.prototype.hasOwnProperty.call(CLOCK_DEFAULTS, key) && valid(key as keyof ClockSettings, value));
}
