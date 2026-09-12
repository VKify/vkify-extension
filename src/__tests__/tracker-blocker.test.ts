// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const updateSettings = (detail: Record<string, boolean>) => {
  window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail }));
};

beforeEach(async () => {
  vi.resetModules();
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
