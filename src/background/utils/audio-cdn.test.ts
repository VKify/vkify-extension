import { expect, it } from 'vitest';
import manifest from '@/../manifest/base.json';
import { isVkAudioUrl } from './audio-cdn.js';
import { AUDIO_HOST_ORIGINS } from '@/shared/constants/host-permissions.js';

it.each(['vkuser.net', 'vk-cdn.net', 'vkuseraudio.ru'])('accepts the VK CDN %s declared in the manifest', host => {
  expect(isVkAudioUrl(`https://audio.${host}/index.m3u8`)).toBe(true);
  expect(isVkAudioUrl(`https://${host}/segment.ts`)).toBe(true);
  expect(AUDIO_HOST_ORIGINS).toContain(`https://*.${host}/*`);
});

it('requests only audio hosts declared in the shipped manifest', () => {
  for (const origin of AUDIO_HOST_ORIGINS) expect(manifest.host_permissions).toContain(origin);
});

it.each([
  'https://vkuser.net.evil.test/index.m3u8',
  'https://evilvk-cdn.net/index.m3u8',
  'https://cs9-11v4.vkuseraudio.ru.evil.test/index.m3u8',
  'https://evilvkuseraudio.ru/index.m3u8',
  'https://localhost/index.m3u8',
  'http://audio.vkuser.net/index.m3u8',
  'not a url',
])('rejects URLs outside the CDN whitelist: %s', url => {
  expect(isVkAudioUrl(url)).toBe(false);
});

it.each(['cs9-11v4', 'cs9-26v4', 'cs9-4v4', 'cs1-69v4'])('accepts the .ru audio host from the reported VK response: %s', prefix => {
  expect(isVkAudioUrl(`https://${prefix}.vkuseraudio.ru/index.m3u8`)).toBe(true);
});
