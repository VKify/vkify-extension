// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { WelcomeModal } from '../content/ui/welcome-modal.js';

afterEach(() => {
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
  });

  it('does not mount duplicate markup or styles', () => {
    WelcomeModal.show();
    WelcomeModal.show();

    expect(document.querySelectorAll('#vkify-welcome')).toHaveLength(1);
    expect(document.querySelectorAll('#vkify-welcome-styles')).toHaveLength(1);
  });
});
