// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { createSearchMenu } from './search-menu.js';
describe('photo search export-style menu', () => {
  it('opens without a native VK menu, handles keyboard and removes the floating card on cleanup', () => {
    document.body.innerHTML = '';
    const items = ['Google', 'Bing'].map(name => { const button = document.createElement('button'); button.textContent = name; return button; });
    const menu = createSearchMenu('Search image', items);
    document.body.append(menu.element);
    const trigger = menu.element as HTMLButtonElement;
    trigger.click();
    const card = document.getElementById('vkify-photo-search-popup')!;
    expect(card.classList.contains('vkify-card')).toBe(true);
    expect(card.querySelector('.vkify-card__head')?.textContent).toBe('Search image');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(items[0]);
    items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[1]);
    items[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('vkify-photo-search-popup')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    trigger.click(); document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    trigger.click(); items[1].click();
    expect(document.getElementById('vkify-photo-search-popup')).toBeNull();
    trigger.click(); menu.destroy();
    expect(document.getElementById('vkify-photo-search-popup')).toBeNull();
    expect(menu.element.isConnected).toBe(false);
    document.body.innerHTML = '';
  });
});
