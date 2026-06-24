import { describe, it, expect, vi } from 'vitest';
import { FeatureRegistry } from './feature-registry.js';
import type { FeatureHandler } from '@/types/index.js';

const noop: FeatureHandler = { enable: () => {}, disable: () => {} };

describe('FeatureRegistry', () => {
  it('applies defaults when registered without metadata', () => {
    const r = new FeatureRegistry();
    r.register('plain', noop);
    const meta = r.getMeta('plain')!;
    expect(meta).toMatchObject({
      id: 'plain', name: 'plain', category: 'misc', impact: 'light',
      dependencies: [], initOrder: 100, enabledByDefault: false, requiresDomLayer: false, tags: [],
    });
  });

  it('register preserves prior metadata when re-registering handler only', () => {
    const r = new FeatureRegistry();
    r.register('x', noop, { category: 'ads', impact: 'heavy' });
    const newHandler: FeatureHandler = { enable: () => {}, disable: () => {} };
    r.register('x', newHandler); // старый стиль: только handler
    expect(r.getHandler('x')).toBe(newHandler);
    expect(r.getMeta('x')!.category).toBe('ads'); // метадата сохранена
    expect(r.getMeta('x')!.impact).toBe('heavy');
  });

  it('describe merges metadata onto an existing feature', () => {
    const r = new FeatureRegistry();
    r.register('x', noop);
    r.describe('x', { category: 'media', tags: ['audio'] });
    expect(r.getMeta('x')!.category).toBe('media');
    expect(r.getMeta('x')!.tags).toEqual(['audio']);
  });

  it('describe warns for unregistered feature', () => {
    const r = new FeatureRegistry();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    r.describe('ghost', { category: 'ads' });
    expect(warn).toHaveBeenCalled();
    expect(r.has('ghost')).toBe(false);
    warn.mockRestore();
  });

  it('queries by category, impact, tag and enabledByDefault', () => {
    const r = new FeatureRegistry();
    r.register('a', noop, { category: 'ads', impact: 'heavy', tags: ['dom'], enabledByDefault: true });
    r.register('b', noop, { category: 'media', impact: 'light', tags: ['dom'] });
    r.register('c', noop, { category: 'ads', impact: 'light' });

    expect(r.getByCategory('ads').map(d => d.meta.id)).toEqual(['a', 'c']);
    expect(r.getByImpact('heavy').map(d => d.meta.id)).toEqual(['a']);
    expect(r.getByTag('dom').map(d => d.meta.id)).toEqual(['a', 'b']);
    expect(r.getEnabled().map(d => d.meta.id)).toEqual(['a']);
  });

  it('getAll sorts by initOrder then id', () => {
    const r = new FeatureRegistry();
    r.register('late', noop, { initOrder: 90 });
    r.register('early', noop, { initOrder: 10 });
    r.register('mid2', noop, { initOrder: 50 });
    r.register('mid1', noop, { initOrder: 50 });
    expect(r.getAll().map(d => d.meta.id)).toEqual(['early', 'mid1', 'mid2', 'late']);
  });

  it('resolveDependencies orders dependencies before dependents', () => {
    const r = new FeatureRegistry();
    r.register('app', noop, { dependencies: ['core'], initOrder: 10 });
    r.register('core', noop, { initOrder: 90 });
    // app идёт первой по initOrder, но core обязана активироваться раньше.
    expect(r.resolveDependencies(['app', 'core'])).toEqual(['core', 'app']);
  });

  it('resolveDependencies respects initOrder for independent features', () => {
    const r = new FeatureRegistry();
    r.register('a', noop, { initOrder: 30 });
    r.register('b', noop, { initOrder: 10 });
    r.register('c', noop, { initOrder: 20 });
    expect(r.resolveDependencies(['a', 'b', 'c'])).toEqual(['b', 'c', 'a']);
  });

  it('resolveDependencies skips and warns for a dependency outside the enable set', () => {
    const r = new FeatureRegistry();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    r.register('app', noop, { dependencies: ['core'] });
    r.register('core', noop);
    // core зарегистрирована, но не включается — связь пропускается с предупреждением.
    expect(r.resolveDependencies(['app'])).toEqual(['app']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('resolveDependencies tolerates cycles without infinite loop', () => {
    const r = new FeatureRegistry();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    r.register('a', noop, { dependencies: ['b'] });
    r.register('b', noop, { dependencies: ['a'] });
    const order = r.resolveDependencies(['a', 'b']);
    expect(order.sort()).toEqual(['a', 'b']);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/цикл/i));
    warn.mockRestore();
  });

  it('resolveDependencies(all) defaults to every registered feature', () => {
    const r = new FeatureRegistry();
    r.register('a', noop, { initOrder: 20 });
    r.register('b', noop, { initOrder: 10 });
    expect(r.resolveDependencies()).toEqual(['b', 'a']);
  });
});
