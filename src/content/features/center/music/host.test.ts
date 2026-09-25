import { describe, expect, it } from 'vitest';
import { isVkVideoHost } from './host.js';

describe('music widget host guard', () => {
  it('blocks vkvideo.ru and its subdomains', () => {
    expect(isVkVideoHost('vkvideo.ru')).toBe(true);
    expect(isVkVideoHost('www.vkvideo.ru')).toBe(true);
    expect(isVkVideoHost('VKVIDEO.RU.')).toBe(true);
  });

  it('keeps VK music pages available', () => {
    expect(isVkVideoHost('vk.ru')).toBe(false);
    expect(isVkVideoHost('m.vk.ru')).toBe(false);
    expect(isVkVideoHost('notvkvideo.ru')).toBe(false);
  });
});
