import { formatClock, clockDelay } from './format.js';
import { clockStyle } from './style.js';
import type { ClockSettings } from './types.js';

export function createClockRenderer(element: HTMLElement, afterRender = () => {}) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settings: ClockSettings;
  let locale = 'ru';
  const render = (): void => {
    clearTimeout(timer);
    if (!settings) return;
    const formatted = formatClock(new Date(), settings, locale);
    if (settings.showDate && settings.dateLayout !== 'inline') {
      const [date, time] = formatted.split(' · ');
      const dateElement = document.createElement('span');
      dateElement.textContent = date;
      Object.assign(dateElement.style, { display: 'block', fontSize: `${settings.dateSize}%`, opacity: '0.8', letterSpacing: '0', lineHeight: '1.5' });
      const timeElement = document.createElement('span');
      timeElement.textContent = time;
      timeElement.style.display = 'block';
      element.replaceChildren(...(settings.dateLayout === 'above' ? [dateElement, timeElement] : [timeElement, dateElement]));
      element.setAttribute('aria-label', formatted);
    } else {
      element.textContent = formatted;
      element.removeAttribute('aria-label');
    }
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
