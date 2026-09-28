import type { ClockSettings } from '@/shared/clock/types.js';
import { t } from '@/content/i18n/index.js';

/** Same opt-in pointer-capture editing as the visualizer: transparent to clicks otherwise. */
export function installClockControls(element: HTMLElement, get: () => ClockSettings,
  apply: (settings: ClockSettings) => void, persist: () => void) {
  let toolbar: HTMLDivElement | null = null;
  let drag: { id: number; dx: number; dy: number } | null = null;
  const endDrag = (): void => {
    if (!drag) return;
    const id = drag.id; drag = null;
    if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
    persist();
  };
  const finish = (): void => {
    endDrag(); toolbar?.remove(); toolbar = null;
    element.style.pointerEvents = 'none'; element.style.cursor = '';
    element.style.outline = '';
  };
  const begin = (): void => {
    if (toolbar) return;
    toolbar = document.createElement('div');
    toolbar.className = 'vkify-clock-toolbar';
    const hint = document.createElement('span'); hint.textContent = t('clock.dragHint');
    const done = document.createElement('button'); done.textContent = t('clock.done');
    done.type = 'button'; done.addEventListener('click', finish);
    toolbar.append(hint, done); document.body.append(toolbar);
    element.style.pointerEvents = 'auto'; element.style.cursor = 'move';
    element.style.outline = '2px dashed #5181b8';
  };
  const down = (event: PointerEvent): void => {
    if (!toolbar || event.button !== 0) return;
    const rect = element.getBoundingClientRect();
    drag = { id: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    element.setPointerCapture(event.pointerId); event.preventDefault();
  };
  const move = (event: PointerEvent): void => {
    if (!drag || drag.id !== event.pointerId) return;
    const s = get();
    const mx = Math.min(s.margin, Math.max(0, (innerWidth - element.offsetWidth) / 2));
    const my = Math.min(s.margin, Math.max(0, (innerHeight - element.offsetHeight) / 2));
    const percent = (value: number, available: number) => Math.max(0, Math.min(100, value / Math.max(1, available) * 100));
    apply({ ...s, position: 'custom',
      x: percent(event.clientX - drag.dx - mx, innerWidth - element.offsetWidth - 2 * mx),
      y: percent(event.clientY - drag.dy - my, innerHeight - element.offsetHeight - 2 * my) });
  };
  const up = (event: PointerEvent): void => { if (event.pointerId === drag?.id) endDrag(); };
  const key = (event: KeyboardEvent): void => { if (event.key === 'Escape') finish(); };
  const listener = (message: { type?: string }, sender: chrome.runtime.MessageSender, respond: (value: unknown) => void): void => {
    if (sender.id !== chrome.runtime.id || message.type !== 'VKIFY_CLOCK_EDIT') return;
    begin(); respond({ success: true });
  };
  element.addEventListener('pointerdown', down); element.addEventListener('pointermove', move);
  element.addEventListener('pointerup', up); element.addEventListener('pointercancel', up);
  element.addEventListener('lostpointercapture', up);
  document.addEventListener('keydown', key);
  chrome.runtime.onMessage.addListener(listener);
  return () => {
    // Disabling must not write stale coordinates back into reset settings.
    if (drag) { const id = drag.id; drag = null; if (element.hasPointerCapture(id)) element.releasePointerCapture(id); }
    finish();
    element.removeEventListener('pointerdown', down); element.removeEventListener('pointermove', move);
    element.removeEventListener('pointerup', up); element.removeEventListener('pointercancel', up);
    element.removeEventListener('lostpointercapture', up);
    document.removeEventListener('keydown', key); chrome.runtime.onMessage.removeListener(listener);
  };
}
