import { DEFAULT_BLOCK_RADIUS, normalizeBlockRadius } from '@/shared/constants/theme-radius.js';

/** Shared by live settings and the early theme mirror, including explicit zero. */
export function applyBlockRadius(value: unknown, root: HTMLElement = document.documentElement): void {
  const radius = normalizeBlockRadius(value);
  if (radius === DEFAULT_BLOCK_RADIUS) {
    root.removeAttribute('data-vkify-theme-radius');
    root.style.removeProperty('--vkify-block-radius');
    root.style.removeProperty('--vkify-block-radius-half');
    return;
  }
  root.style.setProperty('--vkify-block-radius', `${radius}px`);
  root.style.setProperty('--vkify-block-radius-half', `${Math.round(radius / 2)}px`);
  root.setAttribute('data-vkify-theme-radius', 'true');
}
