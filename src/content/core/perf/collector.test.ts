import { describe, it, expect, vi, afterEach } from 'vitest';
import { perfCollector } from './collector.js';

// perfCollector — синглтон; тесты используют уникальные id фич и снимают
// baseline у кумулятивных счётчиков, чтобы не зависеть от порядка выполнения.
describe('perfCollector', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records and overwrites feature init time', () => {
    perfCollector.recordFeatureInit('feat_a', 12);
    expect(perfCollector.getFeatureInit('feat_a')).toBe(12);
    perfCollector.recordFeatureInit('feat_a', 5);
    expect(perfCollector.getFeatureInit('feat_a')).toBe(5);
  });

  it('accumulates feature runtime', () => {
    perfCollector.addFeatureRuntime('feat_b', 2);
    perfCollector.addFeatureRuntime('feat_b', 3.5);
    expect(perfCollector.getFeatureRuntime('feat_b')).toBe(5.5);
  });

  it('clearFeature drops both init and runtime', () => {
    perfCollector.recordFeatureInit('feat_c', 9);
    perfCollector.addFeatureRuntime('feat_c', 4);
    perfCollector.clearFeature('feat_c');
    expect(perfCollector.getFeatureInit('feat_c')).toBe(0);
    expect(perfCollector.getFeatureRuntime('feat_c')).toBe(0);
  });

  it('counts api calls and windows the rate to 60s', () => {
    let now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    const baseTotal = perfCollector.getApiCalls();
    perfCollector.recordApiCall();
    perfCollector.recordApiCall();

    expect(perfCollector.getApiCalls()).toBe(baseTotal + 2);
    expect(perfCollector.apiCallsLastMin()).toBeGreaterThanOrEqual(2);

    // Через 61 секунду старые вызовы выпадают из окна.
    now += 61_000;
    expect(perfCollector.apiCallsLastMin()).toBe(0);
  });

  it('getTotalInitMs sums recorded inits', () => {
    perfCollector.clearFeature('sum_t1');
    perfCollector.clearFeature('sum_t2');
    const base = perfCollector.getTotalInitMs();
    perfCollector.recordFeatureInit('sum_t1', 10);
    perfCollector.recordFeatureInit('sum_t2', 20);
    expect(perfCollector.getTotalInitMs()).toBe(base + 30);
  });
});
