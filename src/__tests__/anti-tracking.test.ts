// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const endpoint = 'https://web.api.vk.ru/method/';
const settings = (value: boolean) => window.dispatchEvent(new CustomEvent('vkify-update-settings', {
  detail: { prevent_story_views: value },
}));
let fetchOriginal = vi.fn(async () => new Response());
let sendOriginal: ReturnType<typeof vi.spyOn>;
let beaconOriginal = vi.fn(() => true);
beforeEach(async () => {
  vi.resetModules();
  fetchOriginal = vi.fn(async () => new Response('{"response":1}'));
  window.fetch = fetchOriginal;
  sendOriginal = vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(() => {});
  beaconOriginal = vi.fn(() => true);
  navigator.sendBeacon = beaconOriginal;
  await import('../content/injected/anti-tracking.js');
});
afterEach(() => {
  window.dispatchEvent(new MessageEvent('message', { source: window, data: { type: 'VKIFY_DESTROY' } }));
  vi.restoreAllMocks();
});
describe('anonymous story viewing', () => {
  it('defaults off and can be enabled and disabled without reloading', async () => {
    await window.fetch(endpoint + 'stories.markSeen');
    expect(fetchOriginal).toHaveBeenCalledTimes(1);
    settings(true);
    const response = await window.fetch(new Request(endpoint + 'stories.markSeen', { method: 'POST' }));
    expect(await response.json()).toEqual({ response: 1 });
    expect(fetchOriginal).toHaveBeenCalledTimes(1);
    settings(false);
    await window.fetch(endpoint + 'stories.markSeen');
    expect(fetchOriginal).toHaveBeenCalledTimes(2);
  });
  it('keeps story loading, media, message receipts and unrelated hosts working', async () => {
    settings(true);
    for (const url of [endpoint + 'stories.getById', endpoint + 'stories.get', endpoint + 'messages.markAsRead',
      'https://example.org/method/stories.markSeen', 'https://vk.com/video.mp4']) {
      await window.fetch(url, { method: 'POST', body: 'track_code=story_json/test' });
    }
    expect(fetchOriginal).toHaveBeenCalledTimes(5);
  });
  it('blocks encoded execute calls and form methods, including Request bodies', async () => {
    settings(true);
    await window.fetch(endpoint + 'execute', { method: 'POST', body: new URLSearchParams({ code: 'return API.stories.markSeen({});' }) });
    const form = new FormData(); form.set('method', 'stories.markSeen');
    await window.fetch(endpoint, { method: 'POST', body: form });
    await window.fetch(new Request(endpoint, { method: 'POST', body: 'method=stories.markSeen' }));
    expect(fetchOriginal).not.toHaveBeenCalled();
  });
  it('blocks XHR and beacon receipts, and restores hooks on teardown', async () => {
    settings(true);
    const abort = vi.spyOn(XMLHttpRequest.prototype, 'abort');
    const xhr = new XMLHttpRequest(); xhr.open('POST', endpoint + 'stories.markSeen'); xhr.send();
    await Promise.resolve();
    expect(sendOriginal).not.toHaveBeenCalled(); expect(abort).toHaveBeenCalledOnce();
    expect(navigator.sendBeacon(endpoint + 'stories.markSeen')).toBe(true);
    expect(beaconOriginal).not.toHaveBeenCalled();
    window.dispatchEvent(new MessageEvent('message', { source: window, data: { type: 'VKIFY_DESTROY' } }));
    expect(window.fetch).toBe(fetchOriginal); expect(navigator.sendBeacon).toBe(beaconOriginal);
  });
});
