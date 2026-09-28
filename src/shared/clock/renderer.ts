import { formatClock, clockDelay } from './format.js';
import { clockStyle } from './style.js';
import type { ClockSettings } from './types.js';

export function createClockRenderer(element: HTMLElement, afterRender = () => {}) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settings: ClockSettings;
  let locale = 'ru';
  const render = (): void => {
    clearTimeout(timer);
    element.textContent = formatClock(new Date(), settings, locale);
    afterRender();
    if (!document.hidden) timer = setTimeout(render, clockDelay(settings.seconds));
  };
  document.addEventListener('visibilitychange', render);
  return {
    update(next: ClockSettings, language: string) {
      settings = next; locale = language;
      Object.assign(element.style, clockStyle(settings));
      render();
    },
    dispose() { clearTimeout(timer); document.removeEventListener('visibilitychange', render); },
  };
}
