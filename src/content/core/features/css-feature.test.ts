import { describe, it, expect, vi } from 'vitest';
import { cssFeature } from './css-feature.js';
import type { ScopedFeatureContext } from './scoped-context.js';

describe('cssFeature', () => {
  it('builds a CSS-marker FeatureDefinition composed of a single cssPlugin', () => {
    const def = cssFeature({
      id: 'fixed_sidebar',
      name: 'Фиксированный сайдбар',
      category: 'appearance',
      cssFiles: 'appearance/sidebar/fixed-sidebar.css',
    });

    expect(def.id).toBe('fixed_sidebar');
    expect(def.name).toBe('Фиксированный сайдбар');
    expect(def.category).toBe('appearance');
    expect(def.impact).toBe('light');
    expect(def.phase).toBe('early-css');
    // cssFiles/settingsKeys остаются метадатой (интроспекция).
    expect(def.cssFiles).toEqual(['appearance/sidebar/fixed-sidebar.css']);
    expect(def.settingsKeys).toEqual(['fixed_sidebar']);
    // Поведение — ровно один плагин; никакого init/destroy.
    expect(def.plugins).toHaveLength(1);
    expect(def.init).toBeUndefined();
    expect(def.destroy).toBeUndefined();
  });

  it('the composed cssPlugin toggles the marker via the scope', () => {
    const def = cssFeature({
      id: 'x', name: 'X', category: 'appearance', cssFiles: 'a.css',
    });
    const scope = { enableCss: vi.fn(), disableCss: vi.fn() } as unknown as ScopedFeatureContext;
    const [plugin] = def.plugins!;

    plugin.onEnable?.(scope);
    expect(scope.enableCss).toHaveBeenCalledTimes(1);

    plugin.onDisable?.(scope);
    expect(scope.disableCss).toHaveBeenCalledTimes(1);
  });

  it('normalises a single css path and passes options through', () => {
    const def = cssFeature({
      id: 'y', name: 'Y', category: 'ads',
      cssFiles: 'a.css', initOrder: 10, impact: 'medium',
      reapplyOnNavigate: true, tags: ['css-marker'],
    });
    expect(def.cssFiles).toEqual(['a.css']);
    expect(def.initOrder).toBe(10);
    expect(def.impact).toBe('medium');
    expect(def.reapplyOnNavigate).toBe(true);
    expect(def.tags).toEqual(['css-marker']);
  });

  it('keeps an array of css paths as-is', () => {
    const def = cssFeature({
      id: 'z', name: 'Z', category: 'appearance',
      cssFiles: ['a.css', 'b.css'],
    });
    expect(def.cssFiles).toEqual(['a.css', 'b.css']);
  });
});
