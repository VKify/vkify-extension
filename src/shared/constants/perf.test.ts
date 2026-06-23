import { describe, it, expect } from 'vitest';
import {
  PERF_FEATURE_CATALOG,
  getFeatureMeta,
  heavyFeatureKeys,
  emptyPerfContext,
} from './perf.js';

describe('perf catalog', () => {
  it('getFeatureMeta returns a catalog entry', () => {
    expect(getFeatureMeta('spy_enabled').impact).toBe('heavy');
    expect(getFeatureMeta('hide_sidebar').impact).toBe('light');
  });

  it('classifies features by real mechanism', () => {
    // Статический CSS-маркер — не «средняя», а лёгкая (нулевой runtime).
    expect(getFeatureMeta('block_left_ads').impact).toBe('light');
    expect(getFeatureMeta('expand_post_text').impact).toBe('light');
    // Непрерывное сканирование ленты обсервером+интервалом — тяжёлая.
    expect(getFeatureMeta('block_feed_ads_dom').impact).toBe('heavy');
    // Инжектированный перехватчик сети — средняя.
    expect(getFeatureMeta('block_feed_ads_api').impact).toBe('medium');
  });

  it('getFeatureMeta falls back for unknown id', () => {
    expect(getFeatureMeta('totally_unknown_key')).toEqual({
      label: 'totally_unknown_key',
      impact: 'light',
    });
  });

  it('heavyFeatureKeys returns only heavy entries', () => {
    const keys = heavyFeatureKeys();
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) expect(PERF_FEATURE_CATALOG[k]!.impact).toBe('heavy');
    expect(keys).toContain('profile_spy');
    expect(keys).not.toContain('hide_sidebar');
    // Лёгкие CSS-фичи не должны попадать в «Reset heavy».
    expect(keys).not.toContain('block_left_ads');
  });

  it('emptyPerfContext is unavailable with zeroed metrics', () => {
    const ctx = emptyPerfContext();
    expect(ctx.available).toBe(false);
    expect(ctx.features).toEqual([]);
    expect(ctx.apiCalls).toBe(0);
    expect(ctx.pageLoad).toBeNull();
  });
});
