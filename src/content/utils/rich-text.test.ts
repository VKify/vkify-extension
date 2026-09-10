// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { getRichText } from './rich-text.js';

describe('getRichText', () => {
  it('restores VK img emoji without changing Unicode sequences', () => {
    const el = document.createElement('div');
    el.innerHTML = [
      'Текст ',
      '<img class="Emoji" alt="😂">',
      '<img class="emoji" alt="❤️">',
      '<img data-emoji="👍🏻">',
      '<img class="Emoji" alt="👨‍💻">',
    ].join('');

    expect(getRichText(el)).toBe('Текст 😂❤️👍🏻👨‍💻');
  });

  it('supports span and svg emoji replacements', () => {
    const el = document.createElement('div');
    el.innerHTML = '<span class="Emoji" data-emoji="❤️"></span><svg class="emoji" aria-label="👨‍💻"></svg>';
    expect(getRichText(el)).toBe('❤️👨‍💻');
  });

  it('keeps ordinary text and ignores non-emoji images', () => {
    const el = document.createElement('div');
    el.innerHTML = 'Обычный текст <img alt="Фотография"> без emoji';
    expect(getRichText(el)).toBe('Обычный текст  без emoji');
  });

  it('keeps line breaks used by contenteditable', () => {
    const el = document.createElement('div');
    el.innerHTML = 'Первая строка<br>Вторая строка';
    expect(getRichText(el)).toBe('Первая строка\nВторая строка');
  });
});
