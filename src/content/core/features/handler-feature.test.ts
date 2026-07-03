import { describe, it, expect, vi } from 'vitest';
import { handlerFeature } from './handler-feature.js';
import type { ScopedFeatureContext } from './scoped-context.js';
import type { FeaturePlugin } from './feature-plugin.js';

describe('handlerFeature', () => {
  it('строит FeatureDefinition с метадатой и одним handlerPlugin в конце', () => {
    const def = handlerFeature({
      id: 'custom_css',
      name: 'Пользовательский CSS',
      category: 'custom-css',
      impact: 'medium',
      settingsKeys: ['custom_css', 'custom_css_enabled'],
      handler: { enable: () => {}, disable: () => {} },
    });

    expect(def.id).toBe('custom_css');
    expect(def.name).toBe('Пользовательский CSS');
    expect(def.category).toBe('custom-css');
    expect(def.impact).toBe('medium');
    expect(def.settingsKeys).toEqual(['custom_css', 'custom_css_enabled']);
    expect(def.plugins).toHaveLength(1);
    expect(def.plugins![0].name).toBe('handler');
    expect(def.init).toBeUndefined();
    expect(def.destroy).toBeUndefined();
  });

  it('переносит флаги reapply/matchPath с обработчика на определение', () => {
    const matchPath = (p: string): boolean => p.startsWith('/im');
    const def = handlerFeature({
      id: 'f',
      handler: { enable: () => {}, reapplyOnNavigate: true, reapplyOnUpdate: true, matchPath },
    });

    expect(def.reapplyOnNavigate).toBe(true);
    expect(def.reapplyOnUpdate).toBe(true);
    expect(def.matchPath).toBe(matchPath);
  });

  it('явные опции определения приоритетнее флагов обработчика', () => {
    const def = handlerFeature({
      id: 'f',
      reapplyOnNavigate: false,
      handler: { enable: () => {}, reapplyOnNavigate: true },
    });

    expect(def.reapplyOnNavigate).toBe(false);
  });

  it('дополнительные плагины идут ПЕРЕД handlerPlugin', () => {
    const extra: FeaturePlugin = { name: 'extra' };
    const def = handlerFeature({
      id: 'f',
      plugins: [extra],
      handler: { enable: () => {} },
    });

    expect(def.plugins!.map((p) => p.name)).toEqual(['extra', 'handler']);
  });

  it('handlerPlugin делегирует enable/disable с прокидыванием значения', async () => {
    const enable = vi.fn();
    const disable = vi.fn();
    const def = handlerFeature({ id: 'f', handler: { enable, disable } });
    const [plugin] = def.plugins!;

    // Значение триггера (ctx.value) имеет приоритет над storage.
    const ctxWithValue = {
      value: '#ff0000',
      getOwnSetting: async () => true,
    } as unknown as ScopedFeatureContext;
    await plugin.onEnable?.(ctxWithValue);
    expect(enable).toHaveBeenLastCalledWith('#ff0000');

    // Без значения триггера (reapply) — читается из storage.
    const ctxFromStorage = {
      value: undefined,
      getOwnSetting: async () => 42,
    } as unknown as ScopedFeatureContext;
    await plugin.onEnable?.(ctxFromStorage);
    expect(enable).toHaveBeenLastCalledWith(42);

    await plugin.onDisable?.(ctxFromStorage);
    expect(disable).toHaveBeenCalledTimes(1);
  });
});
