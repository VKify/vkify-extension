// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSharedContext } from '../content/features/ads-blocking/shared.js';

const set = vi.fn(async () => {});

beforeEach(() => {
  vi.useFakeTimers();
  set.mockClear();
  vi.stubGlobal('chrome', {
    storage: {
      local: { get: vi.fn(async () => ({})), set },
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('audio ad statistics', () => {
  it('assigns filtered right-column promos to the feed section', async () => {
    const shared = createSharedContext();
    await shared.loadStats(); shared.addListenerUser();
    try {
      window.dispatchEvent(new CustomEvent('vkify:blocked', { detail: { kind: 'ad', domain: 'VK API', method: 'api',
        section: 'block_recommendations_feed', trigger: 'frb_featured_promo_game', detail: 'Игровой промоблок' } }));
      await vi.advanceTimersByTimeAsync(1500);
      expect(set).toHaveBeenLastCalledWith(expect.objectContaining({ stats_ads_blocked: 1,
        stats_ads_by_section: { block_recommendations_feed: 1 },
        stats_block_log: [expect.objectContaining({ method: 'api', section: 'block_recommendations_feed' })],
      }));
    } finally { shared.releaseListenerUser(); }
  });
  it('persists an API ad description separately from its blocking reason', async () => {
    const shared=createSharedContext();
    await shared.loadStats();shared.addListenerUser();
    try {
      window.dispatchEvent(new CustomEvent('vkify:blocked',{detail:{kind:'ad',domain:'VK API',method:'api',
        detail:'Обзор игры · Игровое сообщество',trigger:'ads',payload:'{"version":1,"entries":[]}'}}));
      await vi.advanceTimersByTimeAsync(1500);
      expect(set).toHaveBeenCalledWith(expect.objectContaining({stats_block_log:[expect.objectContaining({
        detail:'Обзор игры · Игровое сообщество',trigger:'ads',method:'api',
      })]}));
    } finally {shared.releaseListenerUser();}
  });
  it('persists network interceptions in the ads counter and shared journal', async () => {
    const shared = createSharedContext();
    await shared.loadStats();
    shared.addListenerUser();
    window.dispatchEvent(new CustomEvent('vkify:blocked', { detail: {
      kind: 'ad', domain: 'r.mradx.net', url: 'https://r.mradx.net/audio/test.mp3',
      detail: 'Аудиореклама · сетевой запрос', method: 'network',
    } }));

    await vi.advanceTimersByTimeAsync(1_500);
    shared.releaseListenerUser();

    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      stats_ads_blocked: 1,
      stats_block_log: [expect.objectContaining({
        kind: 'ad', domain: 'r.mradx.net', method: 'network',
      })],
    }));
  });
});
