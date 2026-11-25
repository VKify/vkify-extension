// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installProfilePromoBanner } from './profile-promo-banner.js';

const api = 'https://web.api.vk.ru/method/';
const nativeFetch = window.fetch;
let enabled: boolean;
let stop: () => void;
let report = vi.fn<() => void>();
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  window.location.href = 'https://vk.ru/binaryghost';
  enabled = true; report = vi.fn();
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ response: { banner: { title: 'Розыгрыш призов' } } })));
  window.fetch = fetchMock as typeof fetch;
  stop = installProfilePromoBanner(() => enabled, report);
});
afterEach(() => { stop(); window.fetch = nativeFetch; Reflect.deleteProperty(window, 'cur'); });

it.each(['query', 'form', 'json', 'request', 'formData'])('blocks profile promo before the network call (%s)', async format => {
  let input: RequestInfo = api + 'owners.getBanner';
  let init: RequestInit | undefined;
  if (format === 'query') input += '?banner_type=26&owner_id=1';
  else if (format === 'request') input = new Request(input, { method: 'POST', body: 'banner_type=26' });
  else {
    const form = new FormData(); form.set('banner_type', '26');
    init = { method: 'POST', body: format === 'json' ? JSON.stringify({ banner_type: 26 }) : format === 'formData' ? form : new URLSearchParams({ banner_type: '26' }) };
  }
  expect(await (await window.fetch(input, init)).json()).toEqual({ response: {} });
  expect(fetchMock).not.toHaveBeenCalled(); expect(report).toHaveBeenCalledTimes(1);
});
it('preserves unrelated owner banners, other origins and disabled protection', async () => {
  for (const url of [api + 'owners.getBanner?banner_type=25', api + 'owners.getBanner', 'https://example.org/method/owners.getBanner?banner_type=26']) await window.fetch(url);
  enabled = false; await window.fetch(api + 'owners.getBanner?banner_type=26');
  expect(fetchMock).toHaveBeenCalledTimes(4); expect(report).not.toHaveBeenCalled();
});
it.each([false, true])('filters only the matching batched response, retaining native results and headers (Request=%s)', async request => {
  const normal = { id: 'normal', body: { response: { banner: { title: 'Other banner' } } } };
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ responses: [normal, { id: 'promo', body: { response: { banner: { title: 'Ad' }, extra: 1 } } }] }), { headers: { 'X-Test': 'kept', 'Content-Length': '999' } }));
  const body = JSON.stringify({ requests: [{ id: 'promo', method: 'owners.getBanner', params: { banner_type: 26 } }, { id: 'normal', method: 'owners.getBanner', params: { banner_type: 25 } }] });
  const response = request ? await window.fetch(new Request(api + 'batch.call', { method: 'POST', body })) : await window.fetch(api + 'batch.call', { method: 'POST', body });
  expect(await response.json()).toEqual({ responses: [normal, { id: 'promo', body: { response: { extra: 1 } } }] });
  expect(response.headers.get('X-Test')).toBe('kept'); expect(response.headers.has('Content-Length')).toBe(false);
  expect(report).toHaveBeenCalledTimes(1);
});
it('removes embedded and replacement prefetch banners without touching other data', () => {
  const entries = [{ method: 'owners.getBanner', request: { banner_type: 26 }, response: { banner: { title: 'Ad' } } }, { method: 'owners.getBanner', request: { banner_type: 25 }, response: { banner: { title: 'Keep' } } }];
  Reflect.set(window, 'cur', { apiPrefetchCache: entries });
  expect(entries[0].response).toEqual({}); expect(entries[1].response.banner.title).toBe('Keep');
  expect(report).toHaveBeenCalledTimes(1);
  stop(); stop = () => {};
  expect(window.fetch).toBe(fetchMock);
});
