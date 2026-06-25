import { describe, it, expect } from 'vitest';
import { emptyPerfContext, emptyFeatureRegistrySummary } from './perf.js';

// Метадата фич (label/impact/category) больше не хардкодится здесь — единый
// источник истины перенесён в FeatureRegistry (content). См.
// content/core/features/feature-registry.test.ts. Здесь тестируем только
// shared-хелперы пустых снимков.
describe('perf shared helpers', () => {
  it('emptyPerfContext is unavailable with zeroed metrics', () => {
    const ctx = emptyPerfContext();
    expect(ctx.available).toBe(false);
    expect(ctx.features).toEqual([]);
    expect(ctx.apiCalls).toBe(0);
    expect(ctx.pageLoad).toBeNull();
  });

  it('emptyFeatureRegistrySummary is unavailable and empty', () => {
    const s = emptyFeatureRegistrySummary();
    expect(s.available).toBe(false);
    expect(s.total).toBe(0);
    expect(s.features).toEqual([]);
    expect(typeof s.collectedAt).toBe('number');
  });
});
