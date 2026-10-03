// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFloatingWidget, type FloatingWidgetHandle } from './floating-widget.js';
import { widgetStack } from './widget-stack.js';
import { storage } from '../core/storage.js';
import { parseStack, parseWidget, reorderWidgets } from '@/shared/widget-stack.js';

const backing: Record<string, unknown> = {};
const handles: FloatingWidgetHandle[] = [];
const flush = async (): Promise<void> => { await new Promise(resolve => setTimeout(resolve, 0)); };
const create = (id: string): FloatingWidgetHandle => {
  const widget = createFloatingWidget({ id, title: id, initialPosition: { left: 100, top: 150 } });
  handles.push(widget); widget.mount(); return widget;
};
beforeEach(() => {
  storage.cleanup(); storage.invalidateCache();
  for (const key of Object.keys(backing)) delete backing[key];
  vi.stubGlobal('chrome', { runtime: { id: 'test' }, storage: {
    local: {
      get: vi.fn(async (keys: string | string[] | null) => keys === null ? { ...backing } : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter(k => k in backing).map(k => [k, backing[k]]))),
      set: vi.fn(async (patch: Record<string, unknown>) => { Object.assign(backing, patch); }),
      remove: vi.fn(async (key: string) => { delete backing[key]; }),
    }, onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  } });
});
afterEach(() => {
  handles.splice(0).forEach(w => w.destroy()); widgetStack.destroy(); storage.cleanup(); vi.unstubAllGlobals(); document.body.replaceChildren();
});

describe('Widget stack integration', () => {
  it.each(['vkvideo.ru', 'www.vkvideo.ru'])('updates free widgets and the stack on %s when site visibility changes', async hostname => {
    vi.stubGlobal('location', { hostname });
    backing.widgetStack = { showOnVkVideo: false };
    backing['widget:stacked'] = { mode: 'stacked' };
    const free = create('free');
    const stacked = create('stacked');
    await flush();
    const root = document.querySelector<HTMLElement>('.vkify-stack')!;
    expect(free.root.classList.contains('is-stack-hidden')).toBe(true);
    expect(stacked.root.classList.contains('is-stack-hidden')).toBe(true);
    expect(root.hidden).toBe(true);
    free.show(); stacked.reattach();
    expect(root.hidden).toBe(true);
    free.hide();
    await storage.set('widgetStack', { showOnVkVideo: true });
    expect(free.root.classList.contains('is-stack-hidden')).toBe(false);
    expect(free.root.classList.contains('is-hidden')).toBe(true);
    expect(stacked.root.classList.contains('is-stack-hidden')).toBe(false);
    expect(root.hidden).toBe(false);
    await storage.set('widgetStack', { showOnVkVideo: false });
    expect(root.hidden).toBe(true);
    expect(backing['widget:stacked']).toEqual({ mode: 'stacked' });
  });
  it('keeps VK widgets visible when VK Video visibility is disabled', async () => {
    vi.stubGlobal('location', { hostname: 'vk.ru' });
    backing.widgetStack = { showOnVkVideo: false };
    backing['widget:stacked'] = { mode: 'stacked' };
    const free = create('free');
    const stacked = create('stacked');
    await flush();
    expect(free.root.classList.contains('is-stack-hidden')).toBe(false);
    expect(stacked.root.classList.contains('is-stack-hidden')).toBe(false);
    expect(document.querySelector<HTMLElement>('.vkify-stack')!.hidden).toBe(false);
  });
  it('preserves the last free position through stacking, remote moves, and extraction', async () => {
    const widget = create('test'); await flush();
    await storage.set('widget:test', { mode: 'stacked' });
    expect(widget.root.parentElement?.className).toBe('vkify-stack__items');
    await storage.set('widget:test', { mode: 'stacked', position: { left: 42, top: 73 } });
    await storage.set('widget:test', { mode: 'free', position: { left: 42, top: 73 } });
    expect(widget.root.parentElement).toBe(document.body);
    expect(widget.root.style.left).toBe('42px'); expect(widget.root.style.top).toBe('73px');
  });
  it('persists one unified record on drag release without losing stack preferences', async () => {
    backing['widget:test'] = { mode: 'free', visible: true, order: 9, position: { left: 10, top: 20 } };
    const widget = create('test'); await flush();
    vi.mocked(chrome.storage.local.set).mockClear();
    widget.head.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 0, clientY: 0 }));
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 150, clientY: 200 }));
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    document.dispatchEvent(new PointerEvent('pointerup')); await flush();
    expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
    expect(backing['widget:test']).toEqual({ mode: 'free', visible: true, order: 9, position: { left: 150, top: 200 } });
  });
  it('treats a persist callback as an override instead of writing twice', async () => {
    const onPositionChange = vi.fn();
    const widget = createFloatingWidget({ id: 'clock', title: 'Clock', onPositionChange });
    handles.push(widget); widget.mount(); await flush();
    vi.mocked(chrome.storage.local.set).mockClear();
    widget.head.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 90, clientY: 120 }));
    document.dispatchEvent(new PointerEvent('pointerup')); await flush();
    expect(onPositionChange).toHaveBeenCalledTimes(1);
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
  it('completes legacy page-position migration once and respects later resets', async () => {
    localStorage.setItem('vkify-music_visualizer-widget', JSON.stringify({ left: 75, top: 95, width: 360 }));
    backing['widget:music_visualizer'] = { mode: 'free', visible: true, order: 3, position: null };
    backing['widgetPositionMigration:music_visualizer'] = true;
    try {
      const widget = create('music_visualizer'); await flush();
      expect(widget.root.style.left).toBe('75px');
      expect(backing['widget:music_visualizer']).toMatchObject({ order: 3, position: { left: 75, top: 95 } });
      expect(backing['widgetPositionMigration:music_visualizer']).toBeUndefined();
      await storage.set('widget:music_visualizer', { mode: 'free', visible: true, order: 3, position: null });
      widget.destroy();
      const next = create('music_visualizer'); await flush();
      expect(next.root.style.left).toBe('100px');
    } finally { localStorage.removeItem('vkify-music_visualizer-widget'); }
  });
  it('hydrates a collapsed stack, excludes hidden panels, and cleans up on last destroy', async () => {
    backing.widgetStack = { collapsed: true };
    backing['widget:test'] = { mode: 'stacked' };
    const widget = create('test'); await flush();
    const root = document.querySelector<HTMLElement>('.vkify-stack')!;
    expect(root.hidden).toBe(false);
    expect(root.querySelector('.vkify-stack__items')?.hasAttribute('hidden')).toBe(true);
    widget.hide(); expect(root.hidden).toBe(true);
    widget.show(); expect(root.hidden).toBe(false);
    widget.destroy(); expect(document.querySelector('.vkify-stack')).toBeNull();
    expect(chrome.storage.onChanged.removeListener).toHaveBeenCalled();
    expect(document.getElementById('vkify-widget-stack-css')).toBeNull();
  });
  it('supports keyboard reordering and keeps keyboard focus', async () => {
    backing['widget:a'] = { mode: 'stacked', order: 0 };
    backing['widget:b'] = { mode: 'stacked', order: 1 };
    const a = create('a'); create('b'); await flush();
    a.head.focus(); a.head.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect([...document.querySelectorAll('.vkify-stack__items > *')].map(node => node.getAttribute('data-vkify-widget'))).toEqual(['b', 'a']);
    expect(document.activeElement).toBe(a.head);
    await flush(); expect(backing['widget:a']).toMatchObject({ order: 1 });
  });
  it('restores after DOM removal without duplicating controls or containers', async () => {
    backing['widget:test'] = { mode: 'stacked' };
    const widget = create('test'); await flush();
    document.querySelector('.vkify-stack')?.remove(); widget.reattach(); widget.mount();
    expect(widget.isMounted()).toBe(true);
    expect(document.querySelectorAll('.vkify-stack')).toHaveLength(1);
    expect(widget.head.querySelectorAll('[data-stack-toggle]')).toHaveLength(1);
  });
  it('reconciles chrome local changes from another tab and ignores sync changes', async () => {
    const widget = create('test'); await flush();
    const listener = vi.mocked(chrome.storage.onChanged.addListener).mock.calls[0][0];
    listener({ 'widget:test': { newValue: { mode: 'stacked' } } }, 'sync');
    expect(widget.root.classList.contains('is-stacked')).toBe(false);
    listener({ 'widget:test': { newValue: { mode: 'stacked' } } }, 'local');
    expect(widget.root.classList.contains('is-stacked')).toBe(true);
  });
  it('destroys all registered panels during content shutdown', async () => {
    create('a'); create('b'); await flush(); widgetStack.destroy();
    expect(document.querySelectorAll('.vkify-fw')).toHaveLength(0);
    expect(document.querySelector('.vkify-stack')).toBeNull();
    const fresh = create('new'); await flush(); expect(fresh.isMounted()).toBe(true);
  });
  it('supports an explicit load override and subsequent remote reset', async () => {
    backing['widget:test'] = { position: null };
    const widget = createFloatingWidget({ id: 'test', title: 'Test', initialPosition: { left: 10, top: 20 }, loadPosition: () => ({ left: 500, top: 500 }) });
    handles.push(widget); widget.mount(); await flush();
    expect(widget.root.style.left).toBe('500px');
    await storage.set('widget:test', { position: null });
    expect(widget.root.style.left).toBe('10px'); expect(widget.root.style.top).toBe('20px');
  });
  it('does not resurrect destroyed widgets when hydration completes', async () => {
    const widget = create('test'); widget.destroy(); await flush();
    expect(widget.isMounted()).toBe(false); expect(document.querySelector('.vkify-stack')).toBeNull();
  });
  it('handles external settings and remote reset without enabling feature-hidden content', async () => {
    const widget = create('test'); await flush(); widget.hide();
    await storage.set('widget:test', { mode: 'stacked', visible: true });
    expect(widget.root.classList.contains('is-hidden')).toBe(true);
    await storage.set('widget:test', { mode: 'free', visible: false });
    expect(widget.root.classList.contains('is-stack-hidden')).toBe(true);
    await storage.set('widget:test', { position: null });
    expect(widget.root.style.left).toBe('100px');
  });
});

describe('stored data boundaries', () => {
  it('normalizes damaged settings and finite viewport inputs', () => {
    expect(parseStack(undefined).showOnVkVideo).toBe(true);
    expect(parseStack({ showOnVkVideo: false }).showOnVkVideo).toBe(false);
    expect(parseStack({ opacity: -3, width: Infinity, gap: 900, side: 'invalid', position: { left: NaN, top: 1 } })).toMatchObject({ opacity: .4, width: 340, gap: 80, side: 'right', position: null });
    expect(parseWidget(null)).toEqual({ mode: 'free', visible: true, order: 0, position: null });
  });
  it('retains hidden members when reordering and ignores unknown targets', () => {
    const values = { 'widget:a': { mode: 'stacked', order: 0 }, 'widget:b': { mode: 'stacked', order: 1, visible: false } };
    expect(reorderWidgets(['a', 'b'], 'a', 'b', values)['widget:b']).toEqual({ mode: 'stacked', visible: false, order: 0, position: null });
    expect(reorderWidgets(['a'], 'a', 'absent', values)).toEqual({});
  });
});
