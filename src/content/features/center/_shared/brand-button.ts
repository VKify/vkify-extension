/**
 * Фирменная кнопка VKify (база для всех download-кнопок): градиентная «пилюля»
 * с логотипом и подписью.
 */

import { buildVkifyLogo } from '../../../ui/floating-card.js';
import { attachBrandTooltip } from './brand-tooltip.js';

// Логотип живёт в едином компоненте карточки; реэкспорт — для существующих фич.
export { buildVkifyLogo };

const BRAND_BTN_CSS_ID = 'vkify-brand-btn-css';

function ensureBrandButtonStyles(): void {
  if (document.getElementById(BRAND_BTN_CSS_ID)) return;
  const s = document.createElement('style');
  s.id = BRAND_BTN_CSS_ID;
  s.textContent = `
    @keyframes vkify-bb-spin { to { transform: rotate(360deg); } }
    .vkify-brand-btn {
      display: inline-flex; align-items: center; gap: 8px;
      height: 34px; padding: 0 15px; border: 0; border-radius: 10px;
      font: 600 12.5px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #fff; cursor: pointer; white-space: nowrap;
      background: linear-gradient(135deg, #4da3ff 0%, #8a6cff 55%, #b06cff 100%);
      box-shadow: 0 4px 14px rgba(93,124,236,.45);
      transition: filter .15s ease, transform .1s ease, box-shadow .15s ease;
    }
    .vkify-brand-btn:hover  { filter: brightness(1.08); box-shadow: 0 6px 20px rgba(93,124,236,.6); }
    .vkify-brand-btn:active { transform: scale(.97); }
    /* Во время загрузки кнопка кликабельна: повторный клик = «стоп и сохранить». */
    .vkify-brand-btn[data-busy="1"] { cursor: pointer; opacity: .95; }
    .vkify-brand-btn[data-busy="1"]:hover {
      filter: none;
      background: linear-gradient(135deg, #ff7a7a 0%, #ff5c8a 100%);
      box-shadow: 0 4px 14px rgba(255,92,138,.45);
    }
    .vkify-brand-btn .vkify-logo { color: #fff; }
    .vkify-brand-btn-label { display: inline-block; }
    /* Обычный лоадер во время загрузки; лого — только в покое */
    .vkify-bb-spinner {
      display: none; flex: 0 0 auto;
      width: 15px; height: 15px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.45); border-top-color: #fff;
      animation: vkify-bb-spin .8s linear infinite;
    }
    .vkify-brand-btn[data-busy="1"] .vkify-logo     { display: none; }
    .vkify-brand-btn[data-busy="1"] .vkify-bb-spinner { display: block; }
  `;
  document.head.appendChild(s);
}

/**
 * Единая брендовая кнопка VKify (по образцу кнопки скачивания видео):
 * градиентная «пилюля» с логотипом и подписью. База для всех download-кнопок.
 */
export function createBrandButton(label: string, tooltip?: string | (() => string)): HTMLButtonElement {
  ensureBrandButtonStyles();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'vkify-brand-btn';
  btn.appendChild(buildVkifyLogo(18));        // лого — в покое
  const spinner = document.createElement('span');
  spinner.className = 'vkify-bb-spinner';      // лоадер — во время загрузки
  btn.appendChild(spinner);
  const span = document.createElement('span');
  span.className = 'vkify-brand-btn-label';
  span.textContent = label;
  btn.appendChild(span);
  if (tooltip) attachBrandTooltip(btn, tooltip);
  return btn;
}

/** Меняет подпись брендовой кнопки (для прогресса). */
export function setBrandButtonLabel(btn: HTMLElement, text: string): void {
  const el = btn.querySelector('.vkify-brand-btn-label');
  if (el) el.textContent = text;
}

/** Снимает стили брендовой кнопки (при выключении фич). */
export function removeBrandButtonStyles(): void {
  document.getElementById(BRAND_BTN_CSS_ID)?.remove();
}
