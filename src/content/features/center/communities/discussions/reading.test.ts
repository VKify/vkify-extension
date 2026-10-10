// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ScopedFeatureContext } from '@/content/core/features/scoped-context.js';
import type { FeatureContext } from '@/content/core/feature-context.js';
import { createGlobalScrollFeature, findReadingScroller, redirectReadingWheel } from './reading.js';
import { DEFAULT_SETTINGS } from '@/shared/constants/defaults.js';
import { sanitizeSettings } from '@/shared/constants/settings-schema.js';
import { migrateV24ToV25 } from '@/shared/storage/migrations/migrate_v24_to_v25.js';
import { Migrator } from '@/shared/storage/Migrator.js';
import type { RawSettings } from '@/shared/storage/migrations/types.js';

function geometry(el: HTMLElement, width = 200, height = 100) {
  Object.defineProperties(el, {
    clientWidth: { configurable: true, value: width }, clientHeight: { configurable: true, value: height },
    scrollWidth: { configurable: true, value: width + 800 }, scrollHeight: { configurable: true, value: height + 900 },
  });
  vi.spyOn(el, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
}
function fixture(messenger = false) {
  document.body.innerHTML = messenger
    ? '<div class="MEApp__mainPanel"><div id="scroller"><div class="ConvoHistory__messageBlock"></div></div></div><div id="outside"></div>'
    : '<div data-testid="board-topic-page"><div id="scroller"><section data-testid="board-comments-list"><div data-testid="comment"></div></section></div></div><div id="outside"></div>';
  const container = document.querySelector<HTMLElement>('#scroller')!;
  geometry(container); geometry(container.parentElement!);
  container.style.cssText = 'overflow-x: auto; overflow-y: auto; line-height: 20px;';
  const scroll = vi.spyOn(container, 'scrollTo').mockImplementation((options: ScrollToOptions | number) => {
    if (typeof options === 'object') { container.scrollLeft = options.left ?? container.scrollLeft; container.scrollTop = options.top ?? container.scrollTop; }
  });
  return { container, scroll, outside: document.querySelector<HTMLElement>('#outside')! };
}
function wheel(target: HTMLElement, container: HTMLElement | null, init: WheelEventInit = {}) {
  const event = new WheelEvent('wheel', { deltaY: 25, bubbles: true, cancelable: true, ...init });
  for (const key of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey'] as const) Object.defineProperty(event, key, { value: init[key] ?? false });
  const listener = (e: WheelEvent) => redirectReadingWheel(e, container);
  window.addEventListener('wheel', listener, { passive: false });
  target.dispatchEvent(event);
  window.removeEventListener('wheel', listener);
  return event;
}
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('discussion reading wheel', () => {
  it.each([false, true])('discovers scroll ancestors without hashed classes (messenger=%s)', messenger => {
    const { container } = fixture(messenger);
    expect(findReadingScroller()).toBe(container);
  });
  it('leaves native wheel inside the scroller alone', () => {
    const { container, scroll } = fixture();
    expect(wheel(container.firstElementChild as HTMLElement, container).defaultPrevented).toBe(false);
    expect(scroll).not.toHaveBeenCalled();
  });
  it('redirects outside wheel including fractional horizontal trackpad deltas', () => {
    const { container, outside } = fixture();
    expect(wheel(outside, container, { deltaX: 1.5, deltaY: 2.25 }).defaultPrevented).toBe(true);
    expect(container.scrollLeft).toBe(1.5); expect(container.scrollTop).toBe(2.25);
  });
  it('normalizes lines, pages and shift-wheel', () => {
    const { container, outside } = fixture();
    wheel(outside, container, { deltaY: 2, deltaMode: 1 }); expect(container.scrollTop).toBe(40);
    wheel(outside, container, { deltaY: 1, deltaMode: 2 }); expect(container.scrollTop).toBe(140);
    wheel(outside, container, { deltaY: 10, shiftKey: true }); expect(container.scrollLeft).toBe(10);
    expect(container.scrollTop).toBe(140);
  });
  it('handles RTL horizontal offsets and avoids cancellation when scrolling is ignored', () => {
    const { container, outside, scroll } = fixture();
    container.style.direction = 'rtl';
    wheel(outside, container, { deltaX: -20, deltaY: 0 });
    expect(container.scrollLeft).toBe(-20);
    scroll.mockImplementation(() => {});
    expect(wheel(outside, container).defaultPrevented).toBe(false);
  });
  it('respects events already consumed by another feature', () => {
    const { container, outside, scroll } = fixture();
    outside.addEventListener('wheel', event => event.preventDefault(), { once: true });
    wheel(outside, container);
    expect(scroll).not.toHaveBeenCalled();
  });
  it.each(['ctrlKey', 'metaKey', 'altKey'])('keeps browser modifier gestures (%s)', key => {
    const { container, outside, scroll } = fixture();
    expect(wheel(outside, container, { [key]: true }).defaultPrevented).toBe(false);
    expect(scroll).not.toHaveBeenCalled();
  });
  it.each(['role="menu"', 'role="listbox"', 'contenteditable="true"'])('protects independent UI: %s', attr => {
    const { container, outside, scroll } = fixture();
    outside.innerHTML = `<div ${attr}><span></span></div>`;
    expect(wheel(outside.querySelector('span')!, container).defaultPrevented).toBe(false);
    expect(scroll).not.toHaveBeenCalled();
  });
  it('protects an unrelated nested scroll region and modal background', () => {
    const { container, outside, scroll } = fixture();
    outside.style.overflowY = 'auto'; geometry(outside);
    expect(wheel(outside, container).defaultPrevented).toBe(false);
    outside.style.overflowY = 'visible';
    const modal = document.createElement('div'); modal.setAttribute('aria-modal', 'true'); document.body.append(modal); geometry(modal);
    expect(wheel(outside, container).defaultPrevented).toBe(false);
    expect(scroll).not.toHaveBeenCalled();
  });
  it('keeps edge, disconnected, uncancelable and already handled events native', () => {
    const { container, outside, scroll } = fixture();
    container.scrollTop = 900;
    expect(wheel(outside, container).defaultPrevented).toBe(false);
    expect(wheel(outside, container, { deltaY: -2, cancelable: false }).defaultPrevented).toBe(false);
    container.remove();
    expect(wheel(outside, container).defaultPrevented).toBe(false);
    expect(scroll).not.toHaveBeenCalled();
  });
  it('does not duplicate listeners, refreshes after SPA replacement and tears down', async () => {
    let refresh = () => {};
    const unsubscribe = vi.fn();
    const ctx = { value: true, observeChanges: vi.fn((_id, cb) => { refresh = cb; return unsubscribe; }) } as unknown as FeatureContext;
    const definition = createGlobalScrollFeature(ctx);
    const plugin = definition.plugins![0];
    const first = fixture();
    await plugin.onEnable!(ctx as unknown as ScopedFeatureContext);
    await plugin.onEnable!(ctx as unknown as ScopedFeatureContext);
    first.outside.dispatchEvent(new WheelEvent('wheel', { deltaY: 20, cancelable: true, bubbles: true }));
    expect(first.container.scrollTop).toBe(20);
    expect(ctx.observeChanges).toHaveBeenCalledOnce();
    const second = fixture(true); refresh();
    second.outside.dispatchEvent(new WheelEvent('wheel', { deltaY: 30, cancelable: true, bubbles: true }));
    expect(second.container.scrollTop).toBe(30);
    await plugin.onDisable!(ctx as unknown as ScopedFeatureContext);
    expect(unsubscribe).toHaveBeenCalledOnce();
    second.outside.dispatchEvent(new WheelEvent('wheel', { deltaY: 30, cancelable: true, bubbles: true }));
    expect(second.container.scrollTop).toBe(30);
  });
});

describe('reading settings and hover scope', () => {
  it('persists v25 settings through migration and restores them on a second startup', async () => {
    const data: RawSettings = { schema_version: 24, messages_global_scroll: true };
    const adapter = {
      getAll: async () => structuredClone(data),
      setMultiple: async (patch: RawSettings) => { Object.assign(data, patch); },
      remove: async (keys: string[]) => { keys.forEach(key => delete data[key]); },
    };
    await new Migrator(adapter, { verbose: false }).migrate();
    expect(data).toMatchObject({ schema_version: 25, messages_global_scroll: true, messages_disable_hover: false });
    const restarted = await new Migrator(adapter, { verbose: false }).migrate();
    expect(restarted.migrated).toBe(false);
    expect((await adapter.getAll()).messages_global_scroll).toBe(true);
  });
  it('defaults off and migrates without losing explicit saved values', () => {
    expect(DEFAULT_SETTINGS.messages_global_scroll).toBe(false);
    expect(DEFAULT_SETTINGS.messages_disable_hover).toBe(false);
    expect(migrateV24ToV25.migrate({})).toEqual({ messages_global_scroll: false, messages_disable_hover: false });
    const saved = { messages_global_scroll: true, messages_disable_hover: false };
    expect(migrateV24ToV25.migrate(saved)).toEqual(saved);
    expect(sanitizeSettings(JSON.parse(JSON.stringify(saved)), 'import')).toEqual(saved);
    expect(sanitizeSettings({ messages_global_scroll: 'true' }, 'import')).toEqual({});
  });
});
