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
  it('filters featured right-column games independently of post filtering and logs no request secrets', async () => {
    const original = Reflect.get(window, '__vkifyFetchCoordinator').original;
    const block = { type: 'promo_banner', frb_type: 'frb_featured_promo_game', title: 'Помогите Леночке', hide_hash: 'secret' };
    const payload = { response: { block, layout: { name: 'card' }, next_from: 'next' } };
    original.mockImplementation(async () => new Response(JSON.stringify(payload)));
    const blocked = vi.fn();
    window.addEventListener('vkify:blocked', blocked);
    try {
      window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: { block_recommendations_feed: true, block_feed_ads_api: false } }));
      const url = 'https://web.api.vk.ru/method/newsfeed.getRightBlock?access_token=secret';
      expect(await (await window.fetch(url)).json()).toEqual({ response: { layout: { name: 'card' }, next_from: 'next' } });
      expect(blocked).toHaveBeenCalledOnce();
      expect(blocked.mock.calls[0][0].detail).toMatchObject({ method: 'api', section: 'block_recommendations_feed', trigger: 'frb_featured_promo_game' });
      expect(JSON.stringify(blocked.mock.calls[0][0].detail)).not.toContain('secret');
      const prefetch = { method: 'newsfeed.getRightBlock', ...structuredClone(payload) };
      page.cur = { apiPrefetchCache: [prefetch] };
      expect(prefetch.response).not.toHaveProperty('block');
      window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: { block_recommendations_feed: false } }));
      expect(await (await window.fetch(url)).json()).toEqual(payload);
      const untouched = { method: 'newsfeed.getRightBlock', ...structuredClone(payload) };
      page.cur.apiPrefetchCache = [untouched];
      expect(untouched.response.block).toEqual(block);
    } finally { window.removeEventListener('vkify:blocked', blocked); }
  });

  it('preserves other right-column blocks, errors and unrelated API responses', async () => {
    const original = Reflect.get(window, '__vkifyFetchCoordinator').original;
    window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: { block_recommendations_feed: true } }));
    for (const value of [{ response: {} }, { error: { error_code: 6 } },
      { response: { block: { type: 'friends', profiles: [{ id: 1 }] } } },
      { response: { block: { type: 'promo_banner', frb_type: 'frb_sale_day' } } },
      { response: { block: { type: 'continue_apps', frb_type: 'frb_continue_apps' } } }]) {
      const response = new Response(JSON.stringify(value));
      original.mockResolvedValue(response);
      expect(await window.fetch('https://web.api.vk.ru/method/newsfeed.getRightBlock')).toBe(response);
    }
    const unrelated = new Response(JSON.stringify({ response: { block: { frb_type: 'frb_featured_promo_game' } } }));
    original.mockResolvedValue(unrelated);
    expect(await window.fetch('https://web.api.vk.ru/method/apps.get')).toBe(unrelated);
  });

  it('does not remove a right-column promo if its filter is disabled while the request is in flight', async () => {
    const original = Reflect.get(window, '__vkifyFetchCoordinator').original;
    let finish!: (response: Response) => void;
    original.mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
    window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: { block_recommendations_feed: true } }));
    const pending = window.fetch('https://web.api.vk.ru/method/newsfeed.getRightBlock');
    await Promise.resolve();
    window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: { block_recommendations_feed: false } }));
    const response = new Response(JSON.stringify({ response: { block: { frb_type: 'frb_featured_promo_game' } } }));
    finish(response);
    expect(await pending).toBe(response);
  });
  it('logs the nested advertised post with its author, title and method rather than wrapper placeholders', async () => {
    const original=Reflect.get(window,'__vkifyFetchCoordinator').original, blocked=vi.fn();
    original.mockResolvedValue(new Response(JSON.stringify({response:{groups:[{id:42,name:'Игровое сообщество'}],items:[{
      type:'ads',source_id:0,date:0,track_code:'secret',ads:[{post:{id:55,owner_id:-42,text:'Новый ролик',
        attachments:[{type:'video',video:{title:'Обзор игры',access_key:'secret'}}]}}],
    }]}})));
    window.addEventListener('vkify:blocked',blocked);
    try {
      settings(true);
      await window.fetch('https://web.api.vk.ru/method/newsfeed.getFeed?v=5.289');
      expect(blocked).toHaveBeenCalledOnce();
      const detail=blocked.mock.calls[0][0].detail;
      expect(detail.trigger).toBe('ads');
      expect(detail.detail).toContain('Игровое сообщество');
      expect(detail.detail).toContain('Обзор игры');
      expect(JSON.parse(detail.payload)).toMatchObject({api_method:'newsfeed.getFeed',entries:[{
        post:{url:'https://vk.ru/wall-42_55',text:'Новый ролик'},owner:{name:'Игровое сообщество'},
      }]});
      expect(detail.payload.length).toBeLessThanOrEqual(4096);
      expect(detail.payload).not.toContain('secret');
    } finally {window.removeEventListener('vkify:blocked',blocked);}
  });
  it('discovers a renamed feed endpoint and keeps ordinary responses unchanged', async () => {
    const original=Reflect.get(window,'__vkifyFetchCoordinator').original;
    const clean=new Response(JSON.stringify({response:{items:[organic],next_from:'next',groups:[]}}),{headers:{'content-type':'application/json'}});
    original.mockResolvedValue(clean);
    settings(true);
    const url='https://web.api.vk.ru/method/newsfeed.loadNextV3?v=6&access_token=secret';
    expect(await window.fetch(url)).toBe(clean);
    const response=new Response(JSON.stringify(entry()),{headers:{'content-type':'application/json'}});
    original.mockResolvedValue(response);
    expect((await (await window.fetch(url)).json()).response.items).toEqual([organic]);
    expect((await response.json()).response.items).toEqual([organic,ad]);
  });

  it('recognizes renamed timeline methods in both fetch and replaced prefetch caches', async () => {
    const original=Reflect.get(window,'__vkifyFetchCoordinator').original;
    original.mockImplementation(async()=>new Response(JSON.stringify(entry()),{headers:{'content-type':'application/json'}}));
    settings(true);
    expect((await (await window.fetch('https://api.vk.com/method/internal.loadTimelineV3')).json()).response.items).toEqual([organic]);
    const first=entry('newsfeed.futureMethod'),next={...entry('newnamespace.load'),response:{...entry().response,feed_type:'recent'}};
    page.cur={apiPrefetchCache:[first]};
    expect(first.response.items).toEqual([organic]);
    page.cur.apiPrefetchCache=[next];
    expect(next.response.items).toEqual([organic]);
    expect((await (await window.fetch('https://api.vk.com/method/newnamespace.load')).json()).response.items).toEqual([organic]);
    settings(false);
    const disabled=entry('newsfeed.futureMethod');
    page.cur.apiPrefetchCache=[disabled];
    expect(disabled.response.items).toEqual([organic,ad]);
  });

  it('revalidates learned methods and cools down after a schema change without mutating unrelated data', async () => {
    const original=Reflect.get(window,'__vkifyFetchCoordinator').original;
    const url='https://web.api.vk.ru/method/newsfeed.changed';
    settings(true);
    original.mockResolvedValue(new Response(JSON.stringify(entry()),{headers:{'content-type':'application/json'}}));
    expect((await (await window.fetch(url)).json()).response.items).toEqual([organic]);
    const unrelated=new Response(JSON.stringify({response:{items:[{type:'message',id:1,is_ad:1}],profiles:[],next_from:'next'}}),{headers:{'content-type':'application/json'}});
    const clone=vi.spyOn(unrelated,'clone');
    original.mockResolvedValue(unrelated);
    expect(await window.fetch(url)).toBe(unrelated);
    expect(clone).toHaveBeenCalledTimes(1);
    expect(await window.fetch(url)).toBe(unrelated);
    expect(clone).toHaveBeenCalledTimes(1);
  });

  it('discovers search catalog methods and removes matching catalog references only', async () => {
    const original=Reflect.get(window,'__vkifyFetchCoordinator').original;
    original.mockResolvedValue(new Response(JSON.stringify({response:searchResponse()}),{headers:{'content-type':'application/json'}}));
    settings(true);
    const response=(await (await window.fetch('https://web.api.vk.ru/method/search.getSearchAllWeb3')).json()).response;
    expect(response.newsfeed_items.map((item:{id:string})=>item.id)).toEqual(['ordinary','keyword','allowed']);
    expect(response.catalog.sections[0].blocks[1].newsfeed_item_ids).toEqual(['ordinary','keyword','allowed']);
    expect(response.videos).toEqual(searchResponse().videos);
  });

  it('does not clone or parse unrelated, external, non-JSON, failed, or disabled responses', async () => {
    const original=Reflect.get(window,'__vkifyFetchCoordinator').original;
    settings(true);
    for(const [url,headers,status] of [
      ['https://web.api.vk.ru/method/messages.getHistory',{'content-type':'application/json'},200],
      ['https://web.api.vk.ru/method/wall.getComments',{'content-type':'application/json'},200],
      ['https://vk.ru.evil.test/method/newsfeed.changed',{'content-type':'application/json'},200],
      ['https://web.api.vk.ru/method/newsfeed.changed',{'content-type':'text/html'},200],
      ['https://web.api.vk.ru/method/newsfeed.changed',{'content-type':'application/json'},503],
    ] as const) {
      const response=new Response(JSON.stringify(entry()),{headers,status}),clone=vi.spyOn(response,'clone');
      original.mockResolvedValue(response);
      expect(await window.fetch(url)).toBe(response);
      expect(clone).not.toHaveBeenCalled();
    }
    settings(false);
    const response=new Response(JSON.stringify(entry()),{headers:{'content-type':'application/json'}}),clone=vi.spyOn(response,'clone');
    original.mockResolvedValue(response);
    expect(await window.fetch('https://web.api.vk.ru/method/newsfeed.changed')).toBe(response);
    expect(clone).not.toHaveBeenCalled();
  });

  it('bounds unknown endpoint probes without limiting known or learned feed filtering', async () => {
    const original=Reflect.get(window,'__vkifyFetchCoordinator').original;
    settings(true);
    for(let i=0;i<10;i++) {
      const response=new Response(JSON.stringify(entry()),{headers:{'content-type':'application/json'}}),clone=vi.spyOn(response,'clone');
      original.mockResolvedValue(response);
      const result=await window.fetch(`https://web.api.vk.ru/method/newsfeed.future${i}`);
      if(i<8) expect((await result.json()).response.items).toEqual([organic]);
      else { expect(result).toBe(response); expect(clone).not.toHaveBeenCalled(); }
    }
    for(const method of ['newsfeed.getFeed','newsfeed.future0']) {
      original.mockResolvedValue(new Response(JSON.stringify(entry()),{headers:{'content-type':'application/json'}}));
      expect((await (await window.fetch(`https://web.api.vk.ru/method/${method}`)).json()).response.items).toEqual([organic]);
    }
  });

  it('keeps discovery and DOM fallback diagnostics method-only and bounded', async () => {
    const original=Reflect.get(window,'__vkifyFetchCoordinator').original;
    settings(true);
    original.mockResolvedValue(new Response(JSON.stringify(entry()),{headers:{'content-type':'application/json'}}));
    await window.fetch('https://web.api.vk.ru/method/newsfeed.changed?access_token=secret&private=body');
    window.dispatchEvent(new Event('vkify:feed-dom-fallback'));
    window.dispatchEvent(new Event('vkify:feed-dom-fallback'));
    expect(Reflect.get(window,'__vkifyFeedDiagnostics')).toEqual([
      {method:'newsfeed.changed',reason:'feed-detected'},
      {method:'newsfeed.changed',reason:'dom-fallback-after-recent-request'},
    ]);
    const snapshot=Reflect.get(window,'__vkifyFeedDiagnostics');
    snapshot.length=0;
    expect(Reflect.get(window,'__vkifyFeedDiagnostics')).toHaveLength(2);
  });

  it('does not filter an in-flight discovery response after protection is disabled', async () => {
    const original=Reflect.get(window,'__vkifyFetchCoordinator').original;
    let controller!:ReadableStreamDefaultController<Uint8Array>;
    const response=new Response(new ReadableStream<Uint8Array>({start(value){controller=value;}}),{headers:{'content-type':'application/json'}});
    const clone=vi.spyOn(response,'clone');
    original.mockResolvedValue(response);
    settings(true);
    const pending=window.fetch('https://web.api.vk.ru/method/newsfeed.inFlight');
    await vi.waitFor(()=>expect(clone).toHaveBeenCalledOnce(),{interval:1});
    settings(false);
    controller.enqueue(new TextEncoder().encode(JSON.stringify(entry())));controller.close();
    expect(await pending).toBe(response);
    expect((await response.json()).response.items).toEqual([organic,ad]);
  });

  it('uses one browser promo setting for feed, search, and profile regardless of feed filters', () => {
    const config = { toggles: { feed_yandex_browser: true, feed_search_ya_bro_p1: true },
      pe: { 'frontend.vkconnect_profile_menu_ya_browser_banner_enabled': true } };
    Reflect.set(window, 'vk', config);
    window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: {
      block_recommendations_feed: true, block_feed_ads_api: true,
    } }));
    expect(config.toggles.feed_yandex_browser).toBe(true);
    window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: { block_yandex_browser_promo: true } }));
    expect(config.toggles.feed_yandex_browser).toBe(false);
    expect(config.toggles.feed_search_ya_bro_p1).toBe(false);
    expect(config.pe['frontend.vkconnect_profile_menu_ya_browser_banner_enabled']).toBe(false);
    window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: { block_yandex_browser_promo: false } }));
    expect(config.toggles.feed_yandex_browser).toBe(true);
    expect(config.toggles.feed_search_ya_bro_p1).toBe(true);
    expect(config.pe['frontend.vkconnect_profile_menu_ya_browser_banner_enabled']).toBe(true);
  });

  it('removes server browser promo menu entries from fetch and prefetch independently of feed filtering', async () => {
    const response = { sections: { main: { items: [{ id: 'l_pr' }, { id: 'l_invite_menu_promo' }, { id: 'l_invite_promo' }] },
      footer: { items: [{ id: 'help' }] } }, other: 1 };
    const expected = { ...response, sections: { ...response.sections, main: { items: [{ id: 'l_pr' }] } } };
    const original = Reflect.get(window, '__vkifyFetchCoordinator').original;
    original.mockImplementation(async () => new Response(JSON.stringify({ response })));
    const url = 'https://web.api.vk.ru/method/internal.getWebLeftMenu?v=5.289';
    expect((await (await window.fetch(url)).json()).response).toEqual(response);
    window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: { block_yandex_browser_promo: true } }));
    expect((await (await window.fetch(url, { method: 'POST' })).json()).response).toEqual(expected);
    const cache = { method: 'internal.getWebLeftMenu', response: structuredClone(response) };
    page.cur = { apiPrefetchCache: [cache] };
    expect(cache.response).toEqual(expected);
    const arrayCache = { method: 'internal.getWebLeftMenu', response: { sections: [structuredClone(response.sections.main)] } };
    page.cur.apiPrefetchCache = [arrayCache];
    expect(arrayCache.response.sections[0].items).toEqual([{ id: 'l_pr' }]);
    expect((await (await window.fetch(url.replace('web.api.vk.ru', 'example.com'))).json()).response).toEqual(response);
    window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: { block_yandex_browser_promo: false } }));
    expect((await (await window.fetch(url)).json()).response).toEqual(response);
  });

  it.each(['newsfeed.getFeed', 'newsfeed.getFeedExp'])('removes game promotions from %s fetch and prefetch without removing game posts', async method => {
    const gamePost = { ...organic, text: 'Игра для вас', attachments: [{ type: 'app', app: { id: 1 } }] };
    const response = { items: [gamePost, { type: 'recommended_game' }, { type: 'recommended_games_carousel' },
      { type: 'recommended_groups' }, { type: 'recommended_game_review' }], next_from: 'next', groups: [{ id: 1 }] };
    const original = Reflect.get(window, '__vkifyFetchCoordinator').original;
    original.mockImplementation(async () => new Response(JSON.stringify({ response })));
    const url = `https://web.api.vk.ru/method/${method}?v=5.289`;
    expect((await (await window.fetch(url)).json()).response).toEqual(response);
    settings(true);
    const expected = { ...response, items: [gamePost, { type: 'recommended_groups' }, { type: 'recommended_game_review' }] };
    expect((await (await window.fetch(url, { method: 'POST' })).json()).response).toEqual(expected);
    const feed = { method, response: structuredClone(response) };
    page.cur = { apiPrefetchCache: [feed] };
    expect(feed.response).toEqual(expected);
  });

  it('filters newsfeed.getFeed POST responses while preserving metadata and request arguments', async () => {
    settings(true);
    const url = 'https://web.api.vk.ru/method/newsfeed.getFeed?v=5.289&client_id=6287487';
    const feed = entry('newsfeed.getFeed');
    const original = Reflect.get(window, '__vkifyFetchCoordinator').original;
    original.mockImplementation(async () => new Response(JSON.stringify(feed)));
    const init = { method: 'POST', body: new URLSearchParams({ feed_type: 'recent' }) };
    const result = await (await window.fetch(url, init)).json();
    expect(result).toEqual({ ...feed, response: { ...feed.response, items: [organic] } });
    expect(original).toHaveBeenCalledWith(url, init);

    settings(false);
    expect(await (await window.fetch(url, init)).json()).toEqual(feed);
    settings(true);
    expect(await (await window.fetch(url.replace('newsfeed.getFeed?', 'newsfeed.getFeedOther?'), init)).json()).toEqual(feed);
  });

  it('filters newsfeed.getFeed prefetch when settings arrive after the cache', () => {
    const feed = entry('newsfeed.getFeed');
    page.cur = { apiPrefetchCache: [feed] };
    expect(feed.response.items).toHaveLength(2);
    settings(true);
    expect(feed.response).toEqual({ items: [organic], next_from: 'cursor', groups: [{ id: 1 }] });
  });

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
