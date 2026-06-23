import { coalesceFrame } from '@/content/utils/raf-coalesce.js';

export type Scheduled = (() => void) & { cancel: () => void };

/**
 * Стратегия запуска отложенного колбэка:
 *  - 'frame'  — раз в animation frame (по умолчанию; не тикает в фоне);
 *  - debounce — спустя N мс тишины (для «дорогих» пересчётов);
 *  - throttle — не чаще раза в N мс.
 */
export type ScheduleOpt = 'frame' | { debounceMs: number } | { throttleMs: number };

export function schedule(fn: () => void, opt: ScheduleOpt = 'frame'): Scheduled {
  if (opt === 'frame') return coalesceFrame(fn);
  if ('debounceMs' in opt) return debounce(fn, opt.debounceMs);
  return throttle(fn, opt.throttleMs);
}

function debounce(fn: () => void, ms: number): Scheduled {
  let t = 0;
  const wrapped = (): void => { clearTimeout(t); t = window.setTimeout(fn, ms); };
  wrapped.cancel = (): void => clearTimeout(t);
  return wrapped;
}

function throttle(fn: () => void, ms: number): Scheduled {
  let last = 0, t = 0;
  const wrapped = (): void => {
    const now = Date.now();
    const wait = ms - (now - last);
    if (wait <= 0) { clearTimeout(t); t = 0; last = now; fn(); }
    else if (!t) t = window.setTimeout(() => { t = 0; last = Date.now(); fn(); }, wait);
  };
  wrapped.cancel = (): void => { clearTimeout(t); t = 0; };
  return wrapped;
}
