// ── Форматирование для вкладки «Реклама» (счётчики и журнал блокировок) ─────

/** Компактное число: 1234 → «1.2K», 2_000_000 → «2.0M». */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

/** Время записи журнала в формате HH:MM. */
export function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Maps a trigger string to a Tailwind colour class.
 * Hard/certain signals → rose, heuristic → amber, domain/custom → other.
 */
export function triggerColorClass(trigger: string): string {
  if (trigger.startsWith('Маркер')          ||
      trigger.startsWith('Нативная')        ||
      trigger.startsWith('aria-label'))       return 'text-rose-500 dark:text-rose-400';
  if (trigger.startsWith('Рекламный домен')) return 'text-orange-500 dark:text-orange-400';
  if (trigger.startsWith('Стоп-слово'))     return 'text-violet-500 dark:text-violet-400';
  if (trigger.startsWith('«реклам»')        ||
      trigger.startsWith('CTA')             ||
      trigger.startsWith('Обфусц'))          return 'text-amber-600 dark:text-amber-400';
  return 'text-indigo-400 dark:text-indigo-300'; // API ad type
}

/** Pretty-prints a JSON string; falls back to raw string on parse error. */
export function prettyJson(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
}
