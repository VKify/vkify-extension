// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tryInjectSidebarItem } from './menu-item.js';

beforeEach(() => {
  document.body.innerHTML = `<ol><li id="l_pr" data-testid="leftmenuitem" class="native-item">
    <a href="/profile" class="native-link"><div><svg viewBox="0 0 20 20"></svg></div>
    <span data-testid="leftmenuitem-label"><div role="heading" data-testid="leftmenuitem-text">Профиль</div></span>
    <span data-testid="leftmenuitem-counter">3</span></a>
    <div data-testid="leftmenuitem-settings" role="button"></div></li></ol>`;
});

describe('VKify sidebar link', () => {
  it('copies native styling without counters, settings buttons or duplicate IDs', () => {
    const menu = document.querySelector('ol')!;
    tryInjectSidebarItem(menu);
    tryInjectSidebarItem(menu);
    const items = menu.querySelectorAll('#l_vkify_settings');
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item.className).toBe('native-item');
    expect(item.querySelector('a')?.getAttribute('href')).toBe('/vkify_settings');
    expect(item.querySelector('a')?.className).toBe('native-link');
    expect(item.querySelector('[data-testid="leftmenuitem-text"]')?.textContent).toBe('Настройки VKify');
    expect(item.querySelector('[data-testid="leftmenuitem-counter"], [data-testid="leftmenuitem-settings"], [role="heading"]')).toBeNull();
    expect(menu.querySelector('#l_pr')).not.toBeNull();
    item.remove();
    tryInjectSidebarItem(menu);
    expect(menu.querySelector('#l_vkify_settings')).not.toBeNull();
  });

  it('opens the embedded route for ordinary clicks and preserves modified clicks', () => {
    tryInjectSidebarItem(document.querySelector('ol')!);
    const link = document.querySelector<HTMLAnchorElement>('#l_vkify_settings a')!;
    const push = vi.spyOn(history, 'pushState').mockImplementation(() => {});
    const pop = vi.fn();
    window.addEventListener('popstate', pop);
    try {
      const modified = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
      link.dispatchEvent(modified);
      expect(modified.defaultPrevented).toBe(false);
      expect(push).not.toHaveBeenCalled();
      const click = new MouseEvent('click', { bubbles: true, cancelable: true });
      link.dispatchEvent(click);
      expect(click.defaultPrevented).toBe(true);
      expect(push).toHaveBeenCalledWith({}, '', '/vkify_settings');
      expect(pop).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener('popstate', pop);
      push.mockRestore();
    }
  });
});
