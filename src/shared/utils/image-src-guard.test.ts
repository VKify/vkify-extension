// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGuardedImageSrcDescriptor } from './image-src-guard.js';

describe('createGuardedImageSrcDescriptor', () => {
  let imagePrototype = Object.getPrototypeOf(document.createElement('img')) as object;
  while (imagePrototype && !Object.getOwnPropertyDescriptor(imagePrototype, 'src')) {
    imagePrototype = Object.getPrototypeOf(imagePrototype) as object;
  }
  const original = Object.getOwnPropertyDescriptor(imagePrototype, 'src')!;

  beforeEach(() => {
    Object.defineProperty(imagePrototype, 'src', createGuardedImageSrcDescriptor(
      original,
      url => url.includes('pixel.example'),
      vi.fn(),
    ));
  });

  afterEach(() => {
    Object.defineProperty(imagePrototype, 'src', original);
  });

  it('keeps src readable for images created from markup', () => {
    const host = document.createElement('div');
    host.innerHTML = '<img class="Emoji" src="https://vk.ru/emoji/1f602.svg" alt="😂">';
    expect((host.firstElementChild as HTMLImageElement).src).toBe('https://vk.ru/emoji/1f602.svg');
  });

  it('keeps src readable when VK uses setAttribute', () => {
    const img = new Image();
    img.setAttribute('src', 'https://vk.ru/emoji/2764-fe0f.svg');
    expect(img.src).toBe('https://vk.ru/emoji/2764-fe0f.svg');
  });

  it('passes normal property assignments through and blocks tracker URLs', () => {
    const img = new Image();
    img.src = 'https://vk.ru/emoji/1f44d-1f3fb.svg';
    expect(img.src).toBe('https://vk.ru/emoji/1f44d-1f3fb.svg');

    img.src = 'https://pixel.example/collect.gif';
    expect(img.src).toBe('');
  });
});
