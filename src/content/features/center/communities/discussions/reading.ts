import type { FeatureContext } from '@/content/core/feature-context.js';
import { cssFeature, handlerFeature } from '@/content/core/features/index.js';
import { SELECTORS } from '@/content/selectors/index.js';

const ID = 'messages_global_scroll';

function visible(el: HTMLElement): boolean {
  return el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
}

function scrollable(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  return (/auto|scroll/.test(style.overflowY) && el.scrollHeight > el.clientHeight) ||
    (/auto|scroll/.test(style.overflowX) && el.scrollWidth > el.clientWidth);
}

/** Start from known message anchors; never guess hashed VK container classes. */
export function findReadingScroller(): HTMLElement | null {
  const s = SELECTORS.reading;
  const roots = document.querySelectorAll<HTMLElement>(s.roots);
  const candidates = new Set<HTMLElement>();
  for (const root of roots) {
    if (!visible(root) || root.closest(s.independent)) continue;
    const anchor = root.querySelector<HTMLElement>(s.anchors);
    if (!anchor) continue;
    for (let el: HTMLElement | null = anchor; el && el !== document.body; el = el.parentElement) {
      if (visible(el) && scrollable(el)) { candidates.add(el); break; }
    }
  }
  // Ambiguous parallel conversations are safer left to native scrolling.
  return candidates.size === 1 ? [...candidates][0] : null;
}

export function redirectReadingWheel(event: WheelEvent, container: HTMLElement | null): void {
  if (!container || !visible(container) || event.defaultPrevented || !event.cancelable ||
      event.ctrlKey || event.metaKey || event.altKey) return;
  const path = event.composedPath();
  if (path.includes(container)) return;
  const s = SELECTORS.reading;
  // A modal can dim the background while the pointer remains over the page.
  if ([...document.querySelectorAll<HTMLElement>(s.modal)].some(visible)) return;
  for (const target of path) {
    if (!(target instanceof HTMLElement) || target === document.body || target === document.documentElement) continue;
    if (target.matches(s.independent) || scrollable(target)) return;
  }
  const style = getComputedStyle(container);
  const line = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.2 || 16;
  const unitX = event.deltaMode === 1 ? line : event.deltaMode === 2 ? container.clientWidth : 1;
  const unitY = event.deltaMode === 1 ? line : event.deltaMode === 2 ? container.clientHeight : 1;
  const dx = event.shiftKey && !event.deltaX ? event.deltaY * unitX : event.deltaX * unitX;
  const dy = event.shiftKey && !event.deltaX ? 0 : event.deltaY * unitY;
  const extentX = Math.max(0, container.scrollWidth - container.clientWidth);
  const minX = style.direction === 'rtl' ? -extentX : 0;
  const maxX = style.direction === 'rtl' ? 0 : extentX;
  const x = /auto|scroll/.test(style.overflowX) ? Math.max(minX, Math.min(maxX, container.scrollLeft + dx)) : container.scrollLeft;
  const y = /auto|scroll/.test(style.overflowY) ? Math.max(0, Math.min(container.scrollHeight - container.clientHeight, container.scrollTop + dy)) : container.scrollTop;
  if (x === container.scrollLeft && y === container.scrollTop) return;
  // Direct deltas retain fractional trackpad momentum; CSS smooth scrolling must not queue animations.
  const oldX = container.scrollLeft, oldY = container.scrollTop;
  container.scrollTo({ left: x, top: y, behavior: 'instant' });
  if (container.scrollLeft !== oldX || container.scrollTop !== oldY) event.preventDefault();
}

export function createGlobalScrollFeature(ctx: FeatureContext) {
  let enabled = false;
  let container: HTMLElement | null = null;
  let unsubscribe: (() => void) | undefined;
  const refresh = () => { container = findReadingScroller(); };
  const wheel = (event: WheelEvent) => redirectReadingWheel(event, container);
  return handlerFeature({
    id: ID, name: 'Глобальная прокрутка', category: 'messages', impact: 'light',
    requiresDomLayer: true, reapplyOnNavigate: true,
    handler: {
      enable: () => {
        refresh();
        if (enabled) return;
        enabled = true;
        unsubscribe = ctx.observeChanges(ID, refresh, { schedule: { throttleMs: 120 } });
        window.addEventListener('resize', refresh);
        window.addEventListener('wheel', wheel, { passive: false });
      },
      disable: () => {
        enabled = false;
        unsubscribe?.(); unsubscribe = undefined; container = null;
        window.removeEventListener('resize', refresh);
        window.removeEventListener('wheel', wheel);
      },
    },
  });
}

export const disableMessageHoverFeature = cssFeature({
  id: 'messages_disable_hover', name: 'Отключить подсветку сообщений', category: 'messages',
  cssFiles: 'center/communities/discussions/reading.css',
});
