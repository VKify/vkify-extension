// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const url = 'https://web.api.vk.ru/method/friends.getRecommendations?v=5.289';
const ref = 'friends_main_recommended_friends_right_block';
const payload = { response: { count: 2, title: 'People you may know', track_code: 'metadata', items: [{ id: 1 }, { id: 2 }] } };
const nativeFetch = window.fetch;
const setEnabled = (enabled: boolean) => window.dispatchEvent(new CustomEvent('vkify-update-settings', {
  detail: { hide_friends_suggestions: enabled },
}));
const entry = (source = ref) => ({ method: 'friends.getRecommendations', request: { ref: source }, ...structuredClone(payload) });

beforeEach(async () => {
  vi.resetModules();
  window.fetch = vi.fn(async () => new Response(JSON.stringify(payload)));
  await import('./friends-suggestions-filter.js');
});
afterEach(() => {
  window.dispatchEvent(new MessageEvent('message', { source: window, data: { type: 'VKIFY_DESTROY' } }));
  window.fetch = nativeFetch;
  Reflect.deleteProperty(window, 'cur');
});

it('filters initial and later SPA caches while retaining friends and search results', () => {
  const friends = { method: 'friends.get', response: { count: 1, items: [{ id: 9 }] } };
  const suggested = entry();
  const search = entry('friends_search');
  Reflect.set(window, 'cur', { apiPrefetchCache: [friends, suggested, search] });
  expect(suggested.response.items).toHaveLength(2);
  setEnabled(true);
  expect(suggested.response).toEqual({ ...payload.response, count: 0, items: [] });
  expect(friends.response.items).toEqual([{ id: 9 }]);
  expect(search.response).toEqual(payload.response);
  const later = entry('friends_main_recommended_block');
  Reflect.set(window, 'cur', { apiPrefetchCache: [later] });
  expect(later.response.items).toEqual([]);
  const replacement = entry();
  Reflect.get(window, 'cur').apiPrefetchCache = [replacement];
  expect(replacement.response.items).toEqual([]);
  setEnabled(false);
  const disabled = entry();
  Reflect.set(window, 'cur', { apiPrefetchCache: [disabled] });
  expect(disabled.response).toEqual(payload.response);
});

it('short-circuits only the two recommendation refs and leaves other requests untouched', async () => {
  const fetch = window.fetch;
  setEnabled(true);
  for (const body of [`ref=${ref}`, new URLSearchParams({ ref }), new FormData()]) {
    if (body instanceof FormData) body.set('ref', ref);
    expect(await (await window.fetch(url, { method: 'POST', body })).json()).toEqual({ response: { count: 0, items: [] } });
  }
  const request = new Request(url, { method: 'POST', body: new URLSearchParams({ ref }) });
  expect(await (await window.fetch(request)).json()).toEqual({ response: { count: 0, items: [] } });
  expect(await (await window.fetch(`${url}&ref=${ref}`)).json()).toEqual({ response: { count: 0, items: [] } });
  expect(fetch).not.toHaveBeenCalled();
  for (const target of [url, `${url}&ref=friends_search`, url.replace('getRecommendations', 'get'), url.replace('getRecommendations', 'getRecommendationsOther')]) {
    expect(await (await window.fetch(target)).json()).toEqual(payload);
  }
  expect(fetch).toHaveBeenCalledTimes(4);
  setEnabled(false);
  expect(window.fetch).toBe(fetch);
  expect(await (await window.fetch(`${url}&ref=${ref}`)).json()).toEqual(payload);
});

it('does not change malformed, unrelated, or error cache entries', () => {
  const entries = [
    { method: 'friends.getRecommendations', request: { ref }, response: null },
    { method: 'friends.getRecommendations', request: { ref }, error: { error_code: 5 } },
    { method: 'friends.getRecommendations', response: structuredClone(payload.response) },
    { method: 'friends.get', request: { ref }, response: structuredClone(payload.response) },
  ];
  const original = structuredClone(entries);
  Reflect.set(window, 'cur', { apiPrefetchCache: entries });
  setEnabled(true);
  expect(entries).toEqual(original);
});

it('cancels a pending Request-body read when disabled and restores the fetch coordinator', async () => {
  const fetch = window.fetch;
  setEnabled(true);
  const request = new Request(url, { method: 'POST', body: `ref=${ref}` });
  let finish!: (body: string) => void;
  vi.spyOn(request, 'clone').mockReturnValue({ text: () => new Promise<string>(resolve => { finish = resolve; }) } as Request);
  const pending = window.fetch(request);
  setEnabled(false);
  finish(`ref=${ref}`);
  expect(await (await pending).json()).toEqual(payload);
  expect(window.fetch).toBe(fetch);
});
