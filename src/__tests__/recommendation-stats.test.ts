// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSharedContext } from '../content/features/ads-blocking/shared.js';
import { createRecommendationTracker } from '../content/features/ads-blocking/recommendations/tracker.js';

const set = vi.fn(async () => {});

beforeEach(() => {
  vi.useFakeTimers();
  set.mockClear();
  document.body.innerHTML = '';
  vi.stubGlobal('chrome', {
    storage: { local: { get: vi.fn(async () => ({})), set } },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('section recommendation statistics', () => {
  it('counts a hidden section block once and stores detailed log metadata', async () => {
    const block = document.createElement('div');
    block.dataset.testid = 'channels-recommendation-block';
    block.textContent = 'Recommended channels';
    document.body.append(block);

    const shared = createSharedContext();
    const tracker = createRecommendationTracker(shared);
    tracker.enable('block_recommendations_feed');
    tracker.enable('block_recommendations_feed');

    await vi.advanceTimersByTimeAsync(1_500);

    expect(set).toHaveBeenLastCalledWith(expect.objectContaining({
      stats_ads_blocked: 1,
      stats_ads_by_section: { block_recommendations_feed: 1 },
      stats_block_log: [expect.objectContaining({
        kind: 'ad',
        method: 'dom',
        section: 'block_recommendations_feed',
        trigger: 'Раздел: Лента',
      })],
    }));

    tracker.disable('block_recommendations_feed');
  });

  it('observes blocks added after the section filter is enabled', async () => {
    const shared = createSharedContext();
    const tracker = createRecommendationTracker(shared);
    tracker.enable('block_recommendations_communities');

    const block = document.createElement('section');
    block.dataset.testid = 'similar-group-block';
    document.body.append(block);
    await vi.advanceTimersByTimeAsync(1_550);

    expect(set).toHaveBeenLastCalledWith(expect.objectContaining({
      stats_ads_by_section: { block_recommendations_communities: 1 },
    }));

    tracker.disable('block_recommendations_communities');
  });

  it('handles hydrated calls banners without document rescans or duplicate logs', async () => {
    document.body.innerHTML = '<main id="spa_layout_content"><aside><div id="calls"><section data-testid="calls_aside_menu"></section><section class="vkuiBanner__host"><img><a>Promo</a></section></div></aside><div id="comments"></div></main>';
    const shared = createSharedContext();
    const record = vi.spyOn(shared, 'recordBlock');
    const tracker = createRecommendationTracker(shared);
    tracker.enable('block_recommendations_calls');
    const query = vi.spyOn(document, 'querySelectorAll');
    try {
      const promo = document.querySelector('.vkuiBanner__host')!;
      promo.querySelector('a')!.setAttribute('href', '/promo');
      await vi.advanceTimersByTimeAsync(100);
      expect(record).toHaveBeenCalledOnce();
      const comments = document.getElementById('comments')!;
      comments.insertAdjacentHTML('beforeend', '<article><div>Reply</div></article>');
      await vi.advanceTimersByTimeAsync(100);
      expect(query).not.toHaveBeenCalled();
      promo.remove(); await vi.advanceTimersByTimeAsync(100);
      document.getElementById('calls')!.append(promo); await vi.advanceTimersByTimeAsync(100);
      expect(record).toHaveBeenCalledOnce();
      tracker.disable('block_recommendations_calls');
      tracker.enable('block_recommendations_calls');
      expect(record).toHaveBeenCalledOnce();
    } finally {
      tracker.disable('block_recommendations_calls'); query.mockRestore(); record.mockRestore();
    }
  });
});
