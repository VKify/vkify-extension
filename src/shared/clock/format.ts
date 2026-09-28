import type { ClockSettings } from './types.js';

export function formatClock(date: Date, settings: ClockSettings, locale: string): string {
  const hours = date.getHours();
  const pad = (value: number) => String(value).padStart(2, '0');
  const time = `${settings.hour12 ? hours % 12 || 12 : pad(hours)}:${pad(date.getMinutes())}`
    + (settings.seconds ? `:${pad(date.getSeconds())}` : '')
    + (settings.hour12 ? (hours >= 12 ? ' PM' : ' AM') : '');
  if (!settings.showDate) return time;
  const day = settings.dateFormat === 'short'
    ? `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`
    : date.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  return `${day} · ${time}`;
}

/** Align to the next wall-clock boundary, including after sleep/time changes. */
export function clockDelay(seconds: boolean, now = Date.now()): number {
  const interval = seconds ? 1000 : 60000;
  return interval - now % interval;
}
