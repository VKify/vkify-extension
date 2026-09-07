// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const page = window as unknown as { cur?: { apiPrefetchCache?: unknown[] } };
const organic = { type: 'post', post_id: 1, marked_as_ads: 0 };
const ad = { type: 'ads', ads: [{ post: { post_type: 'post_ads', marked_as_ads: 0 } }] };
const entry = (method = 'newsfeed.getFeedExp') => ({ method, response: {
  items: [organic, ad], next_from: 'cursor', groups: [{ id: 1 }],
} });
const settings = (enabled: boolean) => window.dispatchEvent(new CustomEvent('vkify-update-settings', {
  detail: { block_feed_ads_api: enabled },
}));

beforeEach(async () => {
  vi.resetModules();
  window.location.href = 'https://vk.ru/feed';
  window.fetch = vi.fn(async () => new Response(JSON.stringify(entry())));
  await import('../content/injected/feed-ad-blocker.js');
});
afterEach(() => {
  window.dispatchEvent(new MessageEvent('message', { source: window, data: { type: 'VKIFY_DESTROY' } }));
  delete page.cur;
});

describe('feed API filtering', () => {
  it('filters inline prefetch before the ready resolver consumes it', () => {
    settings(true);
    page.cur = {};
    const feed = entry();
    const other = entry('wall.get');
    page.cur.apiPrefetchCache = [feed, other];
    expect(feed.response.items).toEqual([organic]);
    expect(feed.response.next_from).toBe('cursor');
    expect(feed.response.groups).toEqual([{ id: 1 }]);
    expect(other.response.items).toHaveLength(2);
  });

  it('handles settings arriving after the cache and SPA replacement', () => {
    const initial = entry();
    page.cur = { apiPrefetchCache: [initial] };
    expect(initial.response.items).toHaveLength(2);
    settings(true);
    expect(initial.response.items).toEqual([organic]);
    const next = entry();
    page.cur = { apiPrefetchCache: [next] };
    expect(next.response.items).toEqual([organic]);
    settings(false);
    const disabled = entry();
    page.cur.apiPrefetchCache = [disabled];
    expect(disabled.response.items).toHaveLength(2);
  });

  it('filters subsequent getFeedExp fetch responses', async () => {
    settings(true);
    const result = await window.fetch('https://api.vk.ru/method/newsfeed.getFeedExp?v=5.288');
    expect((await result.json()).response.items).toEqual([organic]);
  });

  it('preserves unrelated requests and disabled responses', async () => {
    expect((await (await window.fetch('https://api.vk.ru/method/newsfeed.getFeedExp')).json()).response.items).toHaveLength(2);
    settings(true);
    expect((await (await window.fetch('https://example.com/method/newsfeed.get')).json()).response.items).toHaveLength(2);
  });

  it('restores cache properties on destroy without discarding current data', () => {
    settings(true);
    const feed = entry();
    page.cur = { apiPrefetchCache: [feed] };
    window.dispatchEvent(new MessageEvent('message', { source: window, data: { type: 'VKIFY_DESTROY' } }));
    expect(Object.getOwnPropertyDescriptor(window, 'cur')?.get).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(page.cur!, 'apiPrefetchCache')?.get).toBeUndefined();
    expect(page.cur?.apiPrefetchCache).toEqual([feed]);
  });
});
