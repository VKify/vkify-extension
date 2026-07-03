// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { FeatureManager } from '@/content/core/feature-manager.js';
import type { StorageManager } from '@/content/core/storage.js';
import { registerAppearanceFeatures } from './index.js';
import { createBackgroundFeatures } from './background/index.js';
import { createThemeFeatures } from './theme/index.js';
import { createFontFeatures } from './font/index.js';
import { createBorderRadiusFeature } from './theme/border-radius.js';

const fakeStorage = {
  getAll: async () => ({}),
  get: async () => null,
  set: async () => {},
  onChange: () => () => {},
} as unknown as StorageManager;

/**
 * Регрессия миграции 2026-07: у background 16 ключей-обработчиков создавались
 * через createSettingHandler() и при переводе с registerHandlerMap на
 * handlerFeature выпали из регистрации — storage-изменения из попапа перестали
 * доходить до фичи (registry.has(key) — фильтр реактивности FeatureManager).
 * Тест гарантирует: КАЖДЫЙ ключ каждой stateful-фабрики appearance
 * зарегистрирован как фича.
 */
describe('registerAppearanceFeatures — полнота регистрации фабричных ключей', () => {
  it('каждый ключ каждой appearance-фабрики зарегистрирован', () => {
    const fm = new FeatureManager(fakeStorage);
    registerAppearanceFeatures(fm);

    const factories = {
      background: createBackgroundFeatures,
      theme: createThemeFeatures,
      font: createFontFeatures,
      borderRadius: createBorderRadiusFeature,
    };

    for (const [name, factory] of Object.entries(factories)) {
      for (const key of Object.keys(factory(fm))) {
        expect(fm.hasFeature(key), `${name}: ключ «${key}» не зарегистрирован`).toBe(true);
      }
    }
  });

  it('derived-фичи лэйаута зарегистрированы под id-тогглами (value-ключи — watch)', () => {
    const fm = new FeatureManager(fakeStorage);
    registerAppearanceFeatures(fm);

    expect(fm.hasFeature('content_width_enabled')).toBe(true);
    expect(fm.hasFeature('page_offset_enabled')).toBe(true);
    // Значения-слайдеры — watch-ключи тех же фич, НЕ отдельные фичи.
    expect(fm.hasFeature('content_width')).toBe(false);
    expect(fm.hasFeature('page_offset_value')).toBe(false);
    expect(fm.featureRegistry.getMeta('content_width_enabled')?.settingsKeys).toContain('content_width');
    expect(fm.featureRegistry.getMeta('page_offset_enabled')?.settingsKeys).toContain('page_offset_value');
  });
});
