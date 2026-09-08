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

const searchResponse = () => ({
  newsfeed_items: [
    { id: 'ordinary', item: { type: 'post', text: 'Новости', marked_as_ads: 0 } },
    { id: 'ad', item: { type: 'post', text: 'VKify', marked_as_ads: 1 } },
    { id: 'keyword', item: { type: 'post', copy_history: [{ text: 'ВЕБИНАР' }] } },
    { id: 'allowed', item: { type: 'post', text: 'Вебинар VKify' } },
  ],
  catalog: { default_section: 'all', sections: [{ id: 'all', next_from: 'section-next', blocks: [
    { data_type: 'none', layout: { name: 'header_compact', title: 'Посты' } },
    { data_type: 'newsfeed_items', newsfeed_item_ids: ['ordinary', 'ad', 'keyword', 'allowed'], next_from: 'posts-next' },
    { data_type: 'videos', videos_ids: ['1_2'] },
  ] }, { id: 'more', blocks: [
    { data_type: 'newsfeed_items', newsfeed_item_ids: ['ad'], next_from: 'more-posts' },
  ] }] },
  profiles: [{ id: 1 }], groups: [{ id: 2, name: 'Вебинар' }],
  videos: [{ id: 2, owner_id: 1, title: 'Вебинар', ads: { can_play: true } }],
});

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
  it('applies custom words to prefetch, with exceptions and built-in API ads preserved as a separate rule', () => {
    window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: {
      block_feed_ads_api: true, custom_block_words: [' ВЕБИНАР ', ''], custom_allow_words: ['VKify'],
    } }));
    const blocked = { type: 'post', copy_history: [{ text: 'Новый вебинар' }] };
    const allowed = { type: 'post', text: 'ВЕБИНАР VKify' };
    const nativeAd = { type: 'ads', text: 'VKify' };
    const feed = { method: 'newsfeed.getFeedExp', response: { items: [organic, blocked, allowed, nativeAd] } };
    page.cur = { apiPrefetchCache: [feed] };
    expect(feed.response.items).toEqual([organic, allowed]);
  });

  it('updates API keyword lists live and stops filtering words after they are cleared', async () => {
    settings(true);
    // The coordinator retains the original mock so subsequent responses use this data.
    const coordinator = Reflect.get(window, '__vkifyFetchCoordinator');
    coordinator.original.mockImplementation(async () => new Response(JSON.stringify({ response: {
      items: [{ type: 'post', text: 'Казино' }, { type: 'post', text: 'Новости' }],
    } })));
    const read = async () => (await (await window.fetch('https://api.vk.ru/method/newsfeed.get')).json()).response.items;
    window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: { custom_block_words: ['казино'] } }));
    expect(await read()).toEqual([{ type: 'post', text: 'Новости' }]);
    window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: { custom_block_words: [] } }));
    expect(await read()).toHaveLength(2);
  });

  it('filters inline prefetch before the ready resolver consumes it', () => {
    settings(true);
    page.cur = {};
    const feed = entry();
    const other = entry('wall.getComments');
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

describe('community wall API filtering', () => {
  // Shape from the supplied wall.get response, without private data.
  const wallPost = {
    inner_type: 'wall_wallpost', id: 16, owner_id: -123, from_id: -123,
    type: 'post', post_type: 'post', marked_as_ads: 0, text: 'Новости сообщества',
    ads_easy_promote: {
      type: 1, text: '', label_text: 'Ждём команды, чтобы начать продвижение',
      button_text: 'Продвигать', is_ad_not_easy: false,
    },
  };
  const wallUrl = 'https://api.vk.ru/method/wall.get?v=5.288&client_id=6287487';

  it('filters a POST wall.get response while preserving promotion controls and pagination metadata', async () => {
    window.location.href = 'https://vk.ru/club123';
    const allowed = { ...wallPost, id: 17, text: 'Вебинар VKify' };
    const response = { count: 9, next_from: 'next-page',
      items: [wallPost, { ...wallPost, id: 18, marked_as_ads: 1 },
        { ...wallPost, id: 19, post_type: 'post_ads' },
        { ...wallPost, id: 20, text: 'Новый ВЕБИНАР' }, allowed],
      groups: [{ id: 123 }], profiles: [{ id: 1 }],
    };
    const original = Reflect.get(window, '__vkifyFetchCoordinator').original;
    original.mockImplementation(async () => new Response(JSON.stringify({ response })));
    window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: {
      block_feed_ads_api: true, custom_block_words: ['вебинар', 'продвигать'], custom_allow_words: ['vkify'],
    } }));
    const init = { method: 'POST', body: new URLSearchParams({ owner_id: '-123', offset: '0' }) };
    const result = await (await window.fetch(wallUrl, init)).json();
    expect(result.response).toEqual({ ...response, items: [wallPost, allowed] });
    expect(original).toHaveBeenCalledWith(wallUrl, init);
  });

  it('filters wall.get prefetch using the same rules and leaves comments intact', () => {
    window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: {
      block_feed_ads_api: true, custom_block_words: ['вебинар'],
    } }));
    const response = { count: 9, items: [wallPost,
      { ...wallPost, id: 21, copy_history: [{ text: 'Вебинар' }] },
      { ...wallPost, id: 22, marked_as_ads: 1 }],
    };
    const wall = { method: 'wall.get', response: structuredClone(response) };
    const comments = { method: 'wall.getComments', response: structuredClone(response) };
    page.cur = { apiPrefetchCache: [wall, comments] };
    expect(wall.response).toEqual({ count: 9, items: [wallPost] });
    expect(comments.response).toEqual(response);
  });

  it('passes community responses through unchanged when the API option is disabled', async () => {
    const original = Reflect.get(window, '__vkifyFetchCoordinator').original;
    const response = new Response(JSON.stringify({ response: { count: 1, items: [{ ...wallPost, marked_as_ads: 1 }] } }));
    original.mockResolvedValue(response);
    settings(true);
    settings(false);
    expect(await window.fetch(wallUrl, { method: 'POST' })).toBe(response);
  });
});

describe('user profile API filtering', () => {
  const profileUrl = 'https://web.api.vk.ru/method/owners.getMainTab?v=5.288&client_id=6287487';
  const post = { type: 'post', source_id: 123, inner_type: 'wall_wallpost',
    post_id: 1, post_type: 'post', marked_as_ads: 0, text: '',
    attachments: [{ type: 'photo', photo: { id: 10, text: '', sizes: [] } }],
  };

  it('filters profile POST responses and preserves ordinary photo posts and the next-page cursor', async () => {
    window.location.href = 'https://vk.ru/id123';
    const allowed = { ...post, post_id: 2, text: 'Вебинар VKify' };
    const response = { items: [post, allowed,
      { ...post, post_id: 3, marked_as_ads: 1 },
      { ...post, post_id: 4, attachments: [{ type: 'link', link: { title: 'ВЕБИНАР' } }] },
      { ...post, post_id: 5, post_type: 'post_ads' }],
      profiles: [{ id: 123 }], groups: [], next_from: 'profile-next-page',
    };
    const original = Reflect.get(window, '__vkifyFetchCoordinator').original;
    original.mockImplementation(async () => new Response(JSON.stringify({ response })));
    window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: {
      block_feed_ads_api: true, custom_block_words: ['вебинар'], custom_allow_words: ['vkify'],
    } }));
    const init = { method: 'POST', body: new URLSearchParams({ owner_id: '123' }) };
    const result = await (await window.fetch(profileUrl, init)).json();
    expect(result.response).toEqual({ ...response, items: [post, allowed] });
    expect(original).toHaveBeenCalledWith(profileUrl, init);
    settings(false);
    expect((await (await window.fetch(profileUrl, init)).json()).response).toEqual(response);
  });

  it('applies the same rules to profile prefetch while leaving unrelated owner methods alone', async () => {
    window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: {
      block_feed_ads_api: true, custom_block_words: ['вебинар'],
    } }));
    const response = { items: [post, { ...post, post_id: 2, text: 'Вебинар' },
      { ...post, post_id: 3, marked_as_ads: 1 }], next_from: 'next-page' };
    const profile = { method: 'owners.getMainTab', response: structuredClone(response) };
    const unrelated = { method: 'owners.getMainTabOther', response: structuredClone(response) };
    page.cur = { apiPrefetchCache: [profile, unrelated] };
    expect(profile.response).toEqual({ items: [post], next_from: 'next-page' });
    expect(unrelated.response).toEqual(response);
    const original = Reflect.get(window, '__vkifyFetchCoordinator').original;
    const raw = new Response(JSON.stringify({ response }));
    original.mockResolvedValue(raw);
    expect(await window.fetch('https://example.com/method/owners.getMainTab')).toBe(raw);
  });
});

describe('search API filtering', () => {
  const url = 'https://web.api.vk.ru/method/search.getSearchAllWeb2?v=5.288&client_id=6287487';
  const enableWords = () => window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: {
    block_feed_ads_api: true, custom_block_words: ['вебинар'], custom_allow_words: ['vkify'],
  } }));

  it('filters search POST entities and every catalog reference while preserving other result types and cursors', async () => {
    enableWords();
    const response = searchResponse();
    const original = Reflect.get(window, '__vkifyFetchCoordinator').original;
    original.mockImplementation(async () => new Response(JSON.stringify({ response })));
    const init = { method: 'POST', body: new URLSearchParams({ q: 'test' }) };
    const result = (await (await window.fetch(url, init)).json()).response;
    const expected = searchResponse();
    expected.newsfeed_items = expected.newsfeed_items.filter(entry => ['ordinary', 'allowed'].includes(entry.id));
    expected.catalog.sections[0].blocks[1].newsfeed_item_ids = ['ordinary', 'allowed'];
    expected.catalog.sections[1].blocks[0].newsfeed_item_ids = [];
    expect(result).toEqual(expected);
    expect(original).toHaveBeenCalledWith(url, init);
  });

  it('filters search prefetch and leaves an empty result block with its pagination cursor', () => {
    enableWords();
    const search = { method: 'search.getSearchAllWeb2', response: searchResponse() };
    page.cur = { apiPrefetchCache: [search] };
    expect(search.response.newsfeed_items.map(entry => entry.id)).toEqual(['ordinary', 'allowed']);
    expect(search.response.catalog.sections[1].blocks[0]).toEqual({
      data_type: 'newsfeed_items', newsfeed_item_ids: [], next_from: 'more-posts',
    });
  });

  it('passes disabled, unrelated and malformed search responses through safely', async () => {
    const original = Reflect.get(window, '__vkifyFetchCoordinator').original;
    const raw = new Response(JSON.stringify({ response: searchResponse() }));
    original.mockResolvedValue(raw);
    expect(await window.fetch(url, { method: 'POST' })).toBe(raw);
    enableWords();
    expect(await window.fetch('https://example.com/method/search.getSearchAllWeb2')).toBe(raw);
    expect(await window.fetch('https://web.api.vk.ru/method/search.getSearchAllWeb2Other')).toBe(raw);
    original.mockImplementation(async () => new Response(JSON.stringify({ response: {
      newsfeed_items: [null, {}, { id: 'missing' }], catalog: { sections: [null] },
    } })));
    expect((await (await window.fetch(url)).json()).response.newsfeed_items).toEqual([null, {}, { id: 'missing' }]);
  });
});
