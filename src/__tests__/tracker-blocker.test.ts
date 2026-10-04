// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setPageUrl = (url: string) => (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(url);

const updateSettings = (detail: Record<string, boolean>) => {
  window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail }));
};

beforeEach(async () => {
  vi.resetModules();
  setPageUrl('https://vk.ru/');
  window.fetch = vi.fn(async () => new Response('original', { status: 201 }));
  await import('../content/injected/tracker-blocker.js');
});

afterEach(() => {
  window.dispatchEvent(new MessageEvent('message', {
    source: window,
    data: { type: 'VKIFY_DESTROY' },
  }));
  vi.restoreAllMocks();
});

describe('page-level audio ad blocking', () => {
  it.each([true, false])('video ad campaigns use their own switch even when music blocking is %s', async music => {
    setPageUrl('https://vkvideo.ru/video-123_456');
    updateSettings({ block_music_ads: music, block_recommendations_video: true });
    expect((await window.fetch('https://ad.mail.ru/vp/123/')).status).toBe(204);
    updateSettings({ block_recommendations_video: false, block_trackers: true });
    expect((await window.fetch('https://ad.mail.ru/vp/123/')).status).toBe(201);
    expect((await window.fetch('https://r.mradx.net/vrs/ad.mp4')).status).toBe(201);
  });

  it('preserves the video SDK, auth bridge, main media and lookalike domains', async () => {
    setPageUrl('https://vkvideo.ru/video-123_456');
    updateSettings({ block_recommendations_video: true, block_trackers: true });
    for (const url of ['https://ad.mail.ru/static/motion_lib.js', 'https://ad.mail.ru/dist/vkAuth.html',
      'https://vkuser.net/video.mp4', 'https://ad.mail.ru.evil.test/vp/123/', 'https://example.com/?url=ad.mail.ru']) {
      expect((await window.fetch(url)).status).toBe(201);
    }
    const video = document.createElement('video');
    video.src = 'https://r.mradx.net/vrs/ad.mp4';
    expect(video.src).toBe('data:video/mp4;base64,');
  });

  it('does not enable music blocking just because video blocking is enabled', async () => {
    updateSettings({ block_recommendations_video: true, block_music_ads: false, block_trackers: true });
    expect((await window.fetch('https://ad.mail.ru/vp/123/')).status).toBe(201);
  });
  it('preserves the _tmr runtime API while neutralizing tracker calls', () => {
    const original = { push: vi.fn(), activity: vi.fn(), beat: vi.fn(), custom: vi.fn() };
    (window as unknown as Record<string, unknown>)._tmr = original;
    updateSettings({ block_trackers: true });
    expect((window as unknown as Record<string, unknown>)._tmr).toBe(original);
    expect(typeof original.activity).toBe('function');
    expect(typeof original.beat).toBe('function');
    expect(() => { original.activity(); original.beat(); }).not.toThrow();
    expect(original.custom).not.toHaveBeenCalled();
  });
  it('blocks Mail.ru campaign fetches as ads and reports every hit', async () => {
    const events: CustomEvent[] = [];
    const listener = (event: Event) => events.push(event as CustomEvent);
    window.addEventListener('vkify:blocked', listener);
    updateSettings({ block_music_ads: true });

    const response = await window.fetch('https://ad.mail.ru/vp/1164570/');

    window.removeEventListener('vkify:blocked', listener);
    expect(response.status).toBe(204);
    expect(events).toHaveLength(1);
    expect(events[0].detail).toMatchObject({
      kind: 'ad', domain: 'ad.mail.ru', method: 'network',
    });
  });

  it('blocks dynamic script/media URLs without manifest host permissions', () => {
    updateSettings({ block_music_ads: true });
    const script = document.createElement('script');
    script.src = 'https://ad.mail.ru/static/admanhtml/rbadman-html5.min.js';
    const audio = document.createElement('audio');
    audio.setAttribute('src', 'https://r.mradx.net/audio/test.mp3');
    const pixel = document.createElement('img');
    pixel.setAttribute('src', 'https://r.mradx.net/imgs/test.png');

    expect(script.src).not.toContain('ad.mail.ru');
    expect(audio.src).not.toContain('mradx.net');
    expect(pixel.src).not.toContain('mradx.net');
  });

  it('aborts advertising XMLHttpRequests and records them', async () => {
    const abort = vi.spyOn(XMLHttpRequest.prototype, 'abort');
    const events: CustomEvent[] = [];
    const listener = (event: Event) => events.push(event as CustomEvent);
    window.addEventListener('vkify:blocked', listener);
    updateSettings({ block_music_ads: true });

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://ad.mail.ru/vp/1164570/');
    xhr.send();
    await Promise.resolve();

    window.removeEventListener('vkify:blocked', listener);
    expect(abort).toHaveBeenCalledOnce();
    expect(events).toHaveLength(1);
    expect(events[0].detail.kind).toBe('ad');
  });

  it('keeps music ads independent from general tracker blocking', async () => {
    updateSettings({ block_music_ads: false, block_trackers: true });
    const adResponse = await window.fetch('https://ad.mail.ru/vp/1164570/');
    const pixelResponse = await window.fetch('https://rs.mail.ru/pixel/test.gif');

    expect(adResponse.status).toBe(201);
    expect(pixelResponse.status).toBe(200);
  });
});
