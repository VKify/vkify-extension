import { t } from '@/content/i18n/index.js';
import { attachBrandTooltip } from '@/content/features/center/_shared/brand-tooltip.js';
import { playerIcon, type PlayerIcon } from './icons.js';
export const label = (key: string): string => t(`miniPlayer.${key}`);
export const time = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag); node.className = cls; node.textContent = text; return node;
};
export function tooltip(node: HTMLElement, text: string): void {
  node.dataset.tooltip = text;
  node.removeAttribute('title');
  if (node.dataset.mpTooltip) return;
  node.dataset.mpTooltip = 'true';
  attachBrandTooltip(node, () => node.dataset.tooltip || node.getAttribute('aria-label') || '');
}
export function button(key: string, icon: PlayerIcon, action: () => void): HTMLButtonElement {
  const b = el('button', 'mp-button'); b.type = 'button';
  b.setAttribute('aria-label', label(key)); b.append(playerIcon(icon)); b.dataset.playerIcon = icon;
  tooltip(b, label(key)); b.onclick = action; return b;
}
export function slider(key: string, max: number, step: number): HTMLInputElement {
  const input = el('input'); input.type = 'range'; input.min = '0'; input.max = String(max); input.step = String(step); input.setAttribute('aria-label', label(key)); return input;
}
