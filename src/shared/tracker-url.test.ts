import { describe, expect, it } from 'vitest';
import { isTrackerUrl } from './tracker-url.js';

describe('tracker destinations', () => {
  it.each([
    'https://sdk-api.apptracer.ru/api/crash/trackSession?sdkVersion=2',
    'https://sdk-api.apptracer.ru/api/crash/upload', 'https://r3.mail.ru/k?fixture=1',
    'https://top-fwz1.mail.ru/counter', 'https://stats.vk.ru/collect',
    'https://child.mc.yandex.ru/watch/1', 'wss://stats.vk.ru/events',
    'https://vk.com/rtrg?p=1', 'https://web.api.vk.ru/method/ads.events',
    '/al_stats.php?act=collect',
  ])('blocks a verified destination: %s', url => expect(isTrackerUrl(url)).toBe(true));

  it.each([
    'https://mc.yandex.ru.invalid/collect', 'https://sdk-api.apptracer.ru.invalid/api/crash/trackSession',
    'https://vk.ru/method/account.getInfo?source=mc.yandex.ru',
    'https://web.api.vk.ru/method/batch.call', 'https://login.vk.ru/',
    'https://sun9.userapi.com/pixel.gif', 'https://example.org/al_stats.php',
    'https://r3.mail.ru/keep', 'https://sdk-api.apptracer.ru/docs',
    'https://ad.mail.ru/static/motion_lib.js', 'https://r.mradx.net/img/cover.png',
    'data:text/plain,stats.vk.ru',
  ])('preserves content and lookalikes: %s', url => expect(isTrackerUrl(url)).toBe(false));

});
