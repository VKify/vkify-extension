// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { photoSearchButtons, photoSearchProviders, photoSearchUrl, getSearchPhotoUrl, PHOTO_SEARCH_PROVIDERS } from './photo-search.js';
describe('photo search', () => {
  it('preserves selection order, removes unknown providers and supports an empty selection', () => {
    expect(photoSearchProviders(['iqdb', 'bad', 'google', 'iqdb'])).toEqual(['iqdb', 'google']);
    expect(photoSearchProviders([])).toEqual([]);
    expect(photoSearchProviders(undefined, 'en')).toEqual(['google', 'yandex', 'ozon', 'wildberries']);
  });
  it('supports multiple quick buttons, filters disabled engines and keeps old default behaviour', () => {
    const enabled = ['yandex', 'google', 'bing'] as const;
    expect(photoSearchButtons(['google', 'yandex', 'iqdb', 'google'], [...enabled], 'bing')).toEqual(['yandex', 'google']);
    expect(photoSearchButtons(undefined, [...enabled], 'bing')).toEqual(['bing']);
    expect(photoSearchButtons(undefined, [...enabled], 'iqdb')).toEqual(['yandex']);
    expect(photoSearchButtons([], [...enabled], 'bing')).toEqual([]);
    expect(photoSearchButtons(undefined, [], 'bing')).toEqual([]);
  });
  it('encodes signed image URLs without losing query parameters', () => {
    const image = 'https://example.com/photo.jpg?token=a&size=2000';
    for (const provider of PHOTO_SEARCH_PROVIDERS) {
      const url = new URL(photoSearchUrl(provider, image));
      expect(url.searchParams.get(provider === 'bing' ? 'q' : 'url')).toBe(provider === 'bing' ? 'imgurl:' + image : image);
    }
  });
  it('places marketplaces after Yandex and restricts their Lens query to the shop domain', () => {
    expect(photoSearchProviders(undefined)).toEqual(['yandex', 'ozon', 'wildberries', 'google']);
    for (const provider of ['ozon', 'wildberries'] as const) {
      const url = new URL(photoSearchUrl(provider, 'https://example.com/photo.jpg'));
      expect(url.hostname).toBe('lens.google.com');
      expect(url.searchParams.get('q')).toBe('site:' + provider + '.ru');
    }
  });
  it('chooses the largest srcset candidate and falls back from unsupported sources', () => {
    const image = document.createElement('img');
    image.src = 'blob:https://vk.ru/test';
    image.srcset = 'https://example.com/small.jpg 320w, https://example.com/large.jpg 2000w';
    expect(getSearchPhotoUrl(image)).toBe('https://example.com/large.jpg');
    image.setAttribute('data-original', 'https://example.com/original.jpg');
    expect(getSearchPhotoUrl(image)).toBe('https://example.com/original.jpg');
    image.removeAttribute('data-original'); image.removeAttribute('srcset');
    expect(getSearchPhotoUrl(image)).toBeNull();
  });
});
