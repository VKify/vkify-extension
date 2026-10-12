import type { FeatureContext } from '@/content/core/feature-context.js';
import type { FeatureMap } from '@/types/index.js';
import { applyThemeColorState, type ThemeInputs } from './state.js';
import { applyBlockRadius } from './radius.js';
import { setThemeMarker } from './dom-state.js';
import { invalidatePendingThemeRead, getThemeStateRevision } from './mirror.js';

const COLOR_KEYS = ['custom_theme', 'custom_accent', 'block_opacity', 'glass_blur'] as const;

export function createThemeFeatures(ctx: FeatureContext): FeatureMap {
  let inputs: ThemeInputs = {};
  let revision = 0;
  let pendingOverrides: ThemeInputs = {};
  let pendingRead: Promise<ThemeInputs> | null = null;
  let previewRaf: number | null = null;
  let pendingPreview: ThemeInputs = {};
  let previewRevision = 0;
  let radiusRevision = 0;

  function cancelPreview(): void {
    if (previewRaf !== null) cancelAnimationFrame(previewRaf);
    previewRaf = null;
    pendingPreview = {};
  }

  function readSettings(): Promise<ThemeInputs> {
    // Concurrent updates in one settings transaction share a single snapshot.
    if (!pendingRead) {
      pendingRead = Promise.all(COLOR_KEYS.map(async key => [key, await ctx.getSetting(key)] as const))
        .then(entries => Object.fromEntries(entries));
      const current = pendingRead;
      // A later event must read a fresh snapshot even if this request is slow.
      queueMicrotask(() => { if (pendingRead === current) pendingRead = null; });
    }
    return pendingRead;
  }

  async function refresh(overrides: ThemeInputs = {}): Promise<void> {
    const request = ++revision;
    invalidatePendingThemeRead();
    cancelPreview();
    pendingOverrides = { ...pendingOverrides, ...overrides };
    const settings = await readSettings();
    if (request !== revision) return;
    inputs = { ...settings, ...pendingOverrides };
    pendingOverrides = {};
    applyThemeColorState(inputs);
  }

  function preview(key: 'custom_theme' | 'custom_accent', value: unknown): void {
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) return;
    // A stale async feature update must not overwrite newer live feedback.
    revision++;
    previewRevision = invalidatePendingThemeRead();
    inputs = { ...inputs, ...pendingOverrides };
    pendingOverrides = {};
    pendingPreview[key] = value;
    if (previewRaf === null) previewRaf = requestAnimationFrame(() => {
      previewRaf = null;
      if (previewRevision !== getThemeStateRevision()) { pendingPreview = {}; return; }
      inputs = { ...inputs, ...pendingPreview };
      pendingPreview = {};
      applyThemeColorState(inputs);
    });
  }

  return {
    custom_theme: {
      reapplyOnUpdate: true,
      enable: value => refresh({ custom_theme: value }),
      disable: () => refresh({ custom_theme: null }),
    },
    custom_accent: {
      reapplyOnUpdate: true,
      enable: value => refresh({ custom_accent: value }),
      disable: () => refresh({ custom_accent: null }),
    },
    block_opacity: {
      reapplyOnUpdate: true,
      enable: value => refresh({ block_opacity: value }),
      // Zero is a valid opacity even though FeatureManager routes it to disable.
      disable: () => refresh(),
    },
    glass_blur: {
      reapplyOnUpdate: true,
      enable: value => refresh({ glass_blur: value }),
      disable: () => refresh({ glass_blur: 0 }),
    },
    theme_radius: {
      reapplyOnUpdate: true,
      enable: value => { radiusRevision++; applyBlockRadius(value); },
      disable: async () => {
        const request = ++radiusRevision;
        const value = await ctx.getSetting('theme_radius');
        if (request === radiusRevision) applyBlockRadius(value);
      },
    },
    block_depth: {
      reapplyOnUpdate: true,
      enable: () => setThemeMarker(document.documentElement, 'data-vkify-depth', true),
      disable: () => setThemeMarker(document.documentElement, 'data-vkify-depth', false),
    },
    custom_theme_preview: {
      reapplyOnUpdate: true,
      enable: value => preview('custom_theme', value),
      disable: () => { /* persisted settings end the preview */ },
    },
    custom_accent_preview: {
      reapplyOnUpdate: true,
      enable: value => preview('custom_accent', value),
      disable: () => { /* persisted settings end the preview */ },
    },
  };
}
