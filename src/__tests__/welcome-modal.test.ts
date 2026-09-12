// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WelcomeModal } from '../content/ui/welcome-modal.js';

afterEach(() => {
  vi.useRealTimers();
  document.getElementById('vkify-welcome')?.remove();
});

describe('welcome modal', () => {
  it('keeps its stylesheet in the mounted modal', () => {
    WelcomeModal.show();

    const modal = document.getElementById('vkify-welcome');
    const style = modal?.querySelector<HTMLStyleElement>(':scope > #vkify-welcome-styles');
    expect(style?.textContent).toContain('#vkify-welcome-card');
    expect(style?.textContent).toContain('.vkw-feature');
    expect(document.getElementById('vkify-welcome-card')).not.toBeNull();
    expect(document.getElementById('vkify-welcome-settings')?.getAttribute('href'))
      .toBe('https://vk.ru/vkify_settings');
    expect(document.getElementById('vkify-welcome-card')?.getAttribute('role')).toBe('dialog');
    expect(modal?.querySelectorAll('.vkw-feature')).toHaveLength(4);
    expect(modal?.querySelectorAll('.vkw-feature-icon svg')).toHaveLength(4);
    expect(modal?.textContent).not.toContain('Ctrl + K');
    expect(style?.textContent).toContain('overflow-y: hidden');
  });

  it('does not mount duplicate markup or styles', () => {
    WelcomeModal.show();
    WelcomeModal.show();

    expect(document.querySelectorAll('#vkify-welcome')).toHaveLength(1);
    expect(document.querySelectorAll('#vkify-welcome-styles')).toHaveLength(1);
  });

  it('closes when opening settings', () => {
    vi.useFakeTimers();
    WelcomeModal.show();

    const settings = document.getElementById('vkify-welcome-settings');
    settings?.addEventListener('click', (event) => event.preventDefault());
    settings?.click();
    vi.advanceTimersByTime(200);

    expect(document.getElementById('vkify-welcome')).toBeNull();
  });
});
