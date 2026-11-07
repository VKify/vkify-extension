import { expect, it, vi } from 'vitest';
import { interceptFeedPrefetch } from './feed-prefetch.js';

it('shares subscribers, detaches previous SPA caches and restores all owned descriptors', () => {
  const target: { cur?: { apiPrefetchCache: unknown[] } } = {}, first = vi.fn(), second = vi.fn();
  const offFirst = interceptFeedPrefetch(target, first), offSecond = interceptFeedPrefetch(target, second);
  const old = { apiPrefetchCache: [{ method: 'video.get' }] };
  target.cur = old; expect(first).toHaveBeenCalled(); expect(second).toHaveBeenCalled();
  const next = { apiPrefetchCache: [{ method: 'newsfeed.getFeed' }] };
  target.cur = next;
  expect(Object.getOwnPropertyDescriptor(old, 'apiPrefetchCache')?.get).toBeUndefined();
  offFirst(); const calls = first.mock.calls.length;
  target.cur.apiPrefetchCache = [{ method: 'catalog.getVideo' }];
  expect(first).toHaveBeenCalledTimes(calls); expect(second.mock.lastCall?.[0].method).toBe('catalog.getVideo');
  // Returning to an older cur object must install its observer again.
  target.cur = old; first.mockClear(); second.mockClear();
  old.apiPrefetchCache = [{ method: 'video.search' }]; expect(second).toHaveBeenCalledOnce();
  offSecond();
  expect(Object.getOwnPropertyDescriptor(target, 'cur')?.get).toBeUndefined();
  expect(Object.getOwnPropertyDescriptor(old, 'apiPrefetchCache')?.get).toBeUndefined();
  expect(Object.keys(target)).toEqual(['cur']);
});
