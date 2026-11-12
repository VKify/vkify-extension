import { describe, expect, it, vi } from 'vitest';
import { isVideoAdApiRequest, emptyVideoAdResponse, filterVideoPremium } from './video-ad-request.js';

describe('video advertising API interception', () => {
  it('matches only dedicated campaign endpoints on trusted API hosts', () => {
    vi.stubGlobal('location', { href: 'https://vkvideo.ru/video-34241059_456240309' });
    for (const host of ['api.vk.ru', 'web.api.vk.ru', 'api.vkvideo.ru']) {
      for (const method of ['video.getAds', 'video.getAdsData']) expect(isVideoAdApiRequest(`https://${host}/method/${method}?v=5.199`)).toBe(true);
    }
    for (const url of ['https://api.vk.ru/method/video.get', 'https://api.vk.ru/method/video.trackAdEvent', 'https://evil.test/method/video.getAds', 'https://api.vk.ru.evil.test/method/video.getAds', 'https://api.vk.ru/method/batch.call', 'https://vkvideo.ru/video-34241059_456240309']) expect(isVideoAdApiRequest(url)).toBe(false);
    vi.unstubAllGlobals();
  });
  it('returns a valid empty VK response without an ad or playback error', async () => {
    const response = emptyVideoAdResponse();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ response: {} });
  });
});

 it('suppresses Premium offers without changing entitlement or unrelated user data', () => {
   const data = { subscription: { is_available: true, is_active: true, expires: 12345 }, user: { id: 1 } };
   expect(filterVideoPremium('video.getUserInfo', data)).toBe(true);
   expect(data).toEqual({ subscription: { is_available: false, is_active: true, expires: 12345 }, user: { id: 1 } });
   expect(filterVideoPremium('video.getUserInfo', data)).toBe(false);
   const other = { subscription: { is_available: true } };
   expect(filterVideoPremium('users.get', other)).toBe(false);
   expect(other.subscription.is_available).toBe(true);
   const snackbar = { can_show: true, ttl: 42 };
   expect(filterVideoPremium('video.getSnackBarInfo', snackbar)).toBe(true);
   expect(snackbar).toEqual({ can_show: false, ttl: 42 });
   expect(filterVideoPremium('video.getUserInfo', { error: { code: 5 } })).toBe(false);
 });
