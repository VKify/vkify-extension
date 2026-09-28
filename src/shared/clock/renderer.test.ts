// @vitest-environment happy-dom
import { afterEach, it, expect, vi } from 'vitest';
import { createClockRenderer } from './renderer.js';
import { CLOCK_DEFAULTS } from './settings.js';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('uses a single minute timer, crosses midnight, pauses hidden tabs and resumes immediately', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 27, 23, 59, 20));
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  const element = document.createElement('div'); const draws = vi.fn();
  const renderer = createClockRenderer(element, draws);
  renderer.update({ ...CLOCK_DEFAULTS, showDate: true }, 'ru');
  expect(vi.getTimerCount()).toBe(1);
  vi.advanceTimersByTime(39000); expect(draws).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1000); expect(element.textContent).toBe('28.09.2026 · 00:00');
  hidden.mockReturnValue(true); document.dispatchEvent(new Event('visibilitychange'));
  expect(vi.getTimerCount()).toBe(0);
  vi.setSystemTime(new Date(2026, 8, 28, 10, 15));
  hidden.mockReturnValue(false); document.dispatchEvent(new Event('visibilitychange'));
  expect(element.textContent).toBe('28.09.2026 · 10:15');
  renderer.update({ ...CLOCK_DEFAULTS, seconds: true }, 'en');
  expect(vi.getTimerCount()).toBe(1);
  renderer.dispose(); expect(vi.getTimerCount()).toBe(0);
  const count = draws.mock.calls.length;
  document.dispatchEvent(new Event('visibilitychange'));
  expect(draws).toHaveBeenCalledTimes(count);
});
