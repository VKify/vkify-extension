import { DEFAULT_BLOCK_RADIUS, normalizeBlockRadius } from '@/shared/constants/theme-radius.js';
import { setThemeProperty, setThemeMarker } from './dom-state.js';

/** Shared by live settings and the early theme mirror, including explicit zero. */
export function applyBlockRadius(value: unknown, root: HTMLElement = document.documentElement): void {
  const radius = normalizeBlockRadius(value);
  if (radius === DEFAULT_BLOCK_RADIUS) {
    setThemeMarker(root, 'data-vkify-theme-radius', false);
    setThemeProperty(root, '--vkify-block-radius');
    setThemeProperty(root, '--vkify-block-radius-half');
    return;
  }
  setThemeProperty(root, '--vkify-block-radius', `${radius}px`);
  setThemeProperty(root, '--vkify-block-radius-half', `${Math.round(radius / 2)}px`);
  setThemeMarker(root, 'data-vkify-theme-radius', true);
}
