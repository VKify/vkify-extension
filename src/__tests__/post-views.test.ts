// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ScopedFeatureContext } from '../content/core/features/scoped-context.js';
import { postViewsFeature, postViewsPage } from '../content/features/center/feed/post-views.js';

vi.mock('../content/core/features/index.js', () => ({ cssPlugin: () => ({}) }));
vi.mock('../content/i18n/lang.js', () => ({ getLang: () => 'ru' }));

let intersect: IntersectionObserverCallback;
let cleanup: (() => void) | void;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback; }
    observe() {} unobserve() {} disconnect() {}
  });
});
afterEach(() => { cleanup?.(); cleanup = undefined; document.body.innerHTML = ''; vi.useRealTimers(); vi.unstubAllGlobals(); });

function mount(key: string, contents = '<div><a data-testid="post_date_block_preview">Сегодня</a></div>'): HTMLElement {
  const post = document.createElement('article');
  post.dataset.testid = 'post'; post.dataset.postId = key; post.innerHTML = contents;
  document.body.append(post);
  return post;
}
function setup(call = vi.fn().mockResolvedValue([])) {
  let attach: (post: Element) => void = () => {};
  const scans = new Map<Element, () => void>();
  const ctx = {
    vkApi: { call },
    registerMutationObserver: (_selector: string, callback: typeof attach) => { attach = callback; },
    observeChanges: (callback: () => void, options: { container: Element }) => {
      scans.set(options.container, callback); return () => { scans.delete(options.container); };
    },
  };
  cleanup = postViewsFeature.plugins!.find(p => p.name === 'post-views')!.setup!(ctx as unknown as ScopedFeatureContext);
  return { call, attach: (post: Element) => attach(post), scan: () => scans.forEach(fn => fn()),
    show: (...posts: Element[]) => intersect(posts.map(target => ({ target, isIntersecting: true }) as IntersectionObserverEntry), {} as IntersectionObserver) };
}
const label = (post: Element) => post.querySelector('[data-vkify-post-views]')?.getAttribute('aria-label');

it('accepts both API response shapes and preserves zero while rejecting absent or invalid counts', () => {
  const items = [
    { owner_id: -1, id: 2, views: { count: 0 } }, { owner_id: 3, id: 4, views: { count: 1234 } },
    { owner_id: -1, id: 5 }, { owner_id: -1, id: 6, views: { count: -1 } },
    { owner_id: -1, id: 7, views: { count: Infinity } }, { owner_id: 'bad', id: 8, views: { count: 1 } },
  ];
  expect([...postViewsPage(items)]).toEqual([['-1_2', 0], ['3_4', 1234]]);
  expect(postViewsPage({ items })).toEqual(postViewsPage(items));
  expect(() => postViewsPage({ error: 'denied' })).toThrow();
});

it('batches visible posts, excludes nested reposts, and reuses results for duplicate posts', async () => {
  const first = mount('-1_2'), second = mount('3_4'), offscreen = mount('-1_8');
  const nested = mount('-1_9'); first.append(nested);
  const api = vi.fn().mockResolvedValue({ items: [{ owner_id: -1, id: 2, views: { count: 0 } }] });
  const feature = setup(api);
  [first, second, offscreen, nested].forEach(feature.attach);
  feature.show(first, second);
  await vi.advanceTimersByTimeAsync(180);
  expect(api).toHaveBeenCalledExactlyOnceWith('wall.getById', { posts: '-1_2,3_4', extended: 0, copy_history_depth: 0 });
  expect(label(first)).toBe('Просмотры: 0');
  expect(label(second)).toBe('VK не предоставил число просмотров');
  expect(offscreen.querySelector('[data-vkify-post-views]')).toBeNull();
  expect(nested.querySelector('[data-vkify-post-views]')).toBeNull();
  const duplicate = mount('-1_2'); feature.attach(duplicate); feature.show(duplicate);
  await vi.advanceTimersByTimeAsync(400);
  expect(label(duplicate)).toBe('Просмотры: 0'); expect(api).toHaveBeenCalledOnce();
});

it('avoids repeated requests during rendering and ignores late responses after disabling', async () => {
  let resolve!: (value: unknown) => void;
  const api = vi.fn(() => new Promise(r => { resolve = r; }));
  const post = mount('-1_2'), feature = setup(api);
  feature.attach(post); feature.show(post);
  await vi.advanceTimersByTimeAsync(180);
  feature.scan(); feature.scan();
  cleanup?.(); cleanup = undefined;
  resolve([{ owner_id: -1, id: 2, views: { count: 44 } }]);
  await vi.advanceTimersByTimeAsync(500);
  expect(api).toHaveBeenCalledOnce();
  expect(post.querySelector('[data-vkify-post-views]')).toBeNull();
  expect(post.querySelector('[data-vkify-post-meta]')).toBeNull();
});

it('uses an existing exact native counter without a request and restores it on disable', async () => {
  const post = mount('-1_2', '<div class="like_wrap"><span class="like_views" title="1 234"></span></div>');
  const feature = setup(); feature.attach(post); feature.show(post);
  await vi.advanceTimersByTimeAsync(200);
  expect(label(post)).toBe('Просмотры: 1\u00a0234');
  expect(feature.call).not.toHaveBeenCalled();
  expect(post.querySelector('[data-vkify-views-source]')).not.toBeNull();
  cleanup?.(); cleanup = undefined;
  expect(post.querySelector('[data-vkify-views-source]')).toBeNull();
});

it('attaches to late footers and updates a reused post when its id changes', async () => {
  const post = mount('-1_2', ''), feature = setup(vi.fn().mockImplementation((_method, params) =>
    Promise.resolve([{ owner_id: -1, id: Number(params.posts.split('_')[1]), views: { count: 12 } }])));
  feature.attach(post); feature.show(post);
  post.innerHTML = '<div><a data-testid="post_date_block_preview">Сегодня</a></div>'; feature.scan();
  await vi.advanceTimersByTimeAsync(180);
  expect(label(post)).toBe('Просмотры: 12');
  post.dataset.postId = '-1_3';
  await new Promise<void>(resolve => { queueMicrotask(resolve); });
  feature.scan();
  await vi.advanceTimersByTimeAsync(180);
  expect(feature.call).toHaveBeenCalledTimes(2);
  expect(feature.call.mock.calls[1][1].posts).toBe('-1_3');
  expect(post.querySelectorAll('[data-vkify-post-views]')).toHaveLength(1);
});

it('shows unavailable counts after an API error without retrying on every DOM change', async () => {
  const post = mount('-1_2'), feature = setup(vi.fn().mockRejectedValue(new Error('Access denied')));
  feature.attach(post); feature.show(post); await vi.advanceTimersByTimeAsync(180);
  feature.scan(); await vi.advanceTimersByTimeAsync(400);
  expect(label(post)).toBe('VK не предоставил число просмотров');
  expect(feature.call).toHaveBeenCalledOnce();
});
