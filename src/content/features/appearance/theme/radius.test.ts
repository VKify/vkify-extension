// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import type { FeatureContext } from '@/content/core/feature-context.js';
import { appearanceDefault } from '@/shared/constants/appearance.js';
import { buildApplyPatch, captureAppearance } from '@/popup/utils/appearanceProfile.js';
import { migrateV25ToV26 } from '@/shared/storage/migrations/migrate_v25_to_v26.js';
import { applyBlockRadius } from './radius.js';
import { applyThemeState } from './mirror.js';
import { createThemeFeatures } from './feature.js';

afterEach(() => applyBlockRadius(undefined));

describe('block radius defaults and transitions', () => {
  it('restores native VK styles at 12px and treats zero as square corners', () => {
    for (const value of [24, 0, 8]) {
      applyBlockRadius(value);
      expect(document.documentElement.style.getPropertyValue('--vkify-block-radius')).toBe(`${value}px`);
      expect(document.documentElement.hasAttribute('data-vkify-theme-radius')).toBe(true);
    }
    for (const value of [12, undefined, null, NaN, '24']) {
      applyBlockRadius(24);
      applyBlockRadius(value);
      expect(document.documentElement.hasAttribute('data-vkify-theme-radius')).toBe(false);
      expect(document.documentElement.style.getPropertyValue('--vkify-block-radius')).toBe('');
      expect(document.documentElement.style.getPropertyValue('--vkify-block-radius-half')).toBe('');
    }
  });

  it('agrees between the early mirror and numeric-zero disable in the feature manager', async () => {
    let stored: unknown = 24;
    const ctx = { getSetting: async () => stored } as unknown as FeatureContext;
    const feature = createThemeFeatures(ctx).theme_radius;
    await feature.enable?.(24);
    stored = 0;
    await feature.disable?.();
    expect(document.documentElement.style.getPropertyValue('--vkify-block-radius')).toBe('0px');
    applyThemeState({ theme_radius: 0 });
    expect(document.documentElement.style.getPropertyValue('--vkify-block-radius')).toBe('0px');
    await feature.enable?.(12);
    expect(document.documentElement.hasAttribute('data-vkify-theme-radius')).toBe(false);
    applyThemeState({});
    expect(document.documentElement.hasAttribute('data-vkify-theme-radius')).toBe(false);
  });

  it('resets profiles to 12px and retains an explicitly selected zero', () => {
    expect(appearanceDefault('theme_radius')).toBe(12);
    expect(buildApplyPatch({}).theme_radius).toBe(12);
    expect(captureAppearance({ theme_radius: 12 })).not.toHaveProperty('theme_radius');
    expect(captureAppearance({ theme_radius: 0 })).toMatchObject({ theme_radius: 0 });
  });

  it('preserves native rounding for existing settings and saved profiles during migration', () => {
    const old = { theme_radius: 0, appearance_profiles: [
      { id: 'native', settings: { theme_radius: 0, custom_accent: '#0077ff' } },
      { id: 'custom', settings: { theme_radius: 24 } },
    ] };
    const migrated = migrateV25ToV26.migrate(old);
    expect(migrated.theme_radius).toBe(12);
    expect(migrated.appearance_profiles).toEqual([
      { id: 'native', settings: { theme_radius: 12, custom_accent: '#0077ff' } },
      { id: 'custom', settings: { theme_radius: 24 } },
    ]);
    expect(old.theme_radius).toBe(0);
    expect(old.appearance_profiles[0].settings.theme_radius).toBe(0);
    expect(migrateV25ToV26.migrate({}).theme_radius).toBe(12);
    expect(migrateV25ToV26.migrate({ theme_radius: 8 }).theme_radius).toBe(8);
    expect(migrateV25ToV26.migrate(migrated)).toEqual(migrated);
  });
});
