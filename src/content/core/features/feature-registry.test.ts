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
      id: 'plain', name: 'plain', category: 'misc', impact: 'light', phase: 'dom-ready',
      dependencies: [], initOrder: 100, enabledByDefault: false, requiresDomLayer: false,
      cssFiles: [], settingsKeys: [], tags: [],
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

  it('resolveByPhase groups dependency-ordered ids into phase buckets', () => {
    const r = new FeatureRegistry();
    r.register('css', noop, { phase: 'early-css', initOrder: 10 });
    r.register('main', noop, { phase: 'dom-ready', initOrder: 20 });
    r.register('api', noop, { phase: 'late', initOrder: 30 });
    r.register('main2', noop, { phase: 'dom-ready', initOrder: 5 });

    const byPhase = r.resolveByPhase(['css', 'main', 'api', 'main2']);
    expect(byPhase['early-css']).toEqual(['css']);
    expect(byPhase['dom-ready']).toEqual(['main2', 'main']); // initOrder внутри фазы
    expect(byPhase['late']).toEqual(['api']);
  });

  it('resolveByPhase keeps dependencies before dependents within a phase', () => {
    const r = new FeatureRegistry();
    r.register('app', noop, { phase: 'dom-ready', dependencies: ['core'], initOrder: 10 });
    r.register('core', noop, { phase: 'dom-ready', initOrder: 90 });
    expect(r.resolveByPhase(['app', 'core'])['dom-ready']).toEqual(['core', 'app']);
  });

  it('resolveByPhase promotes a feature to its dependency\'s later phase (with a warning)', () => {
    const r = new FeatureRegistry();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    r.register('early', noop, { phase: 'dom-ready', dependencies: ['slow'] });
    r.register('slow', noop, { phase: 'late' });

    const byPhase = r.resolveByPhase(['early', 'slow']);

    // 'early' объявлена dom-ready, но зависит от late-фичи → поднята в late,
    // чтобы зависимость активировалась не позже её (инвариант порядка).
    expect(byPhase['dom-ready']).toEqual([]);
    expect(byPhase['late']).toEqual(['slow', 'early']); // dep раньше зависящей
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/поднята в фазу/));
    warn.mockRestore();
  });

  it('resolveByPhase propagates phase promotion transitively', () => {
    const r = new FeatureRegistry();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // a(early-css) → b(dom-ready) → c(late): a и b должны подняться в late.
    r.register('a', noop, { phase: 'early-css', dependencies: ['b'] });
    r.register('b', noop, { phase: 'dom-ready', dependencies: ['c'] });
    r.register('c', noop, { phase: 'late' });

    const byPhase = r.resolveByPhase(['a', 'b', 'c']);
    expect(byPhase['early-css']).toEqual([]);
    expect(byPhase['dom-ready']).toEqual([]);
    expect(byPhase['late']).toEqual(['c', 'b', 'a']);
    warn.mockRestore();
  });
});
