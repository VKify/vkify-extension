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
    }, onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  } });
});
afterEach(() => {
  handles.splice(0).forEach(w => w.destroy()); widgetStack.destroy(); storage.cleanup(); vi.unstubAllGlobals(); document.body.replaceChildren();
});

describe('Widget stack integration', () => {
  it('preserves the last free position through stacking, remote moves, and extraction', async () => {
    const widget = create('test'); await flush();
    await storage.set('widgetState:test', { mode: 'stacked' });
    expect(widget.root.parentElement?.className).toBe('vkify-stack__items');
    await storage.set('widgetPosition:test', { left: 42, top: 73 });
    await storage.set('widgetState:test', { mode: 'free' });
    expect(widget.root.parentElement).toBe(document.body);
    expect(widget.root.style.left).toBe('42px'); expect(widget.root.style.top).toBe('73px');
  });
  it('hydrates a collapsed stack, excludes hidden panels, and cleans up on last destroy', async () => {
    backing.widgetStack = { collapsed: true };
    backing['widgetState:test'] = { mode: 'stacked' };
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
    backing['widgetState:a'] = { mode: 'stacked', order: 0 };
    backing['widgetState:b'] = { mode: 'stacked', order: 1 };
    const a = create('a'); create('b'); await flush();
    a.head.focus(); a.head.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect([...document.querySelectorAll('.vkify-stack__items > *')].map(node => node.getAttribute('data-vkify-widget'))).toEqual(['b', 'a']);
    expect(document.activeElement).toBe(a.head);
    await flush(); expect(backing['widgetState:a']).toMatchObject({ order: 1 });
  });
  it('restores after DOM removal without duplicating controls or containers', async () => {
    backing['widgetState:test'] = { mode: 'stacked' };
    const widget = create('test'); await flush();
    document.querySelector('.vkify-stack')?.remove(); widget.reattach(); widget.mount();
    expect(widget.isMounted()).toBe(true);
    expect(document.querySelectorAll('.vkify-stack')).toHaveLength(1);
    expect(widget.head.querySelectorAll('[data-stack-toggle]')).toHaveLength(1);
  });
  it('reconciles chrome local changes from another tab and ignores sync changes', async () => {
    const widget = create('test'); await flush();
    const listener = vi.mocked(chrome.storage.onChanged.addListener).mock.calls[0][0];
    listener({ 'widgetState:test': { newValue: { mode: 'stacked' } } }, 'sync');
    expect(widget.root.classList.contains('is-stacked')).toBe(false);
    listener({ 'widgetState:test': { newValue: { mode: 'stacked' } } }, 'local');
    expect(widget.root.classList.contains('is-stacked')).toBe(true);
  });
  it('destroys all registered panels during content shutdown', async () => {
    create('a'); create('b'); await flush(); widgetStack.destroy();
    expect(document.querySelectorAll('.vkify-fw')).toHaveLength(0);
    expect(document.querySelector('.vkify-stack')).toBeNull();
    const fresh = create('new'); await flush(); expect(fresh.isMounted()).toBe(true);
  });
  it('uses explicit position resets instead of legacy position loaders', async () => {
    backing['widgetPosition:test'] = null;
    const widget = createFloatingWidget({ id: 'test', title: 'Test', initialPosition: { left: 10, top: 20 }, loadPosition: () => ({ left: 500, top: 500 }) });
    handles.push(widget); widget.mount(); await flush();
    expect(widget.root.style.left).toBe('10px'); expect(widget.root.style.top).toBe('20px');
  });
  it('does not resurrect destroyed widgets when hydration completes', async () => {
    const widget = create('test'); widget.destroy(); await flush();
    expect(widget.isMounted()).toBe(false); expect(document.querySelector('.vkify-stack')).toBeNull();
  });
  it('handles external settings and remote reset without enabling feature-hidden content', async () => {
    const widget = create('test'); await flush(); widget.hide();
    await storage.set('widgetState:test', { mode: 'stacked', visible: true });
    expect(widget.root.classList.contains('is-hidden')).toBe(true);
    await storage.set('widgetState:test', { mode: 'free', visible: false });
    expect(widget.root.classList.contains('is-stack-hidden')).toBe(true);
    await storage.set('widgetPosition:test', null);
    expect(widget.root.style.left).toBe('100px');
  });
});

describe('stored data boundaries', () => {
  it('normalizes damaged settings and finite viewport inputs', () => {
    expect(parseStack({ opacity: -3, width: Infinity, gap: 900, side: 'invalid', position: { left: NaN, top: 1 } })).toMatchObject({ opacity: .4, width: 340, gap: 80, side: 'right', position: null });
    expect(parseWidget(null)).toEqual({ mode: 'free', visible: true, order: 0 });
  });
  it('retains hidden members when reordering and ignores unknown targets', () => {
    const values = { 'widgetState:a': { mode: 'stacked', order: 0 }, 'widgetState:b': { mode: 'stacked', order: 1, visible: false } };
    expect(reorderWidgets(['a', 'b'], 'a', 'b', values)['widgetState:b']).toEqual({ mode: 'stacked', visible: false, order: 0 });
    expect(reorderWidgets(['a'], 'a', 'absent', values)).toEqual({});
  });
});
