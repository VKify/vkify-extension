/** Стили карточки центра загрузок (поверх общих .vkify-card из floating-card). */

import { ensureCardStyles } from '../floating-card.js';
import { DL_CENTER_CSS_ID } from './constants.js';

const DL_CENTER_CSS = `
  @keyframes vkify-dlc-spin { to { transform: rotate(360deg); } }
  .vkify-dl-center { right: 16px; bottom: 16px; width: 300px; max-height: 60vh; display: none; }
  .vkify-dl-center.is-open { display: flex; animation: vkify-card-in .18s ease-out; }
  .vkify-dl-center.is-dragging { animation: none; user-select: none; cursor: grabbing; }
  .vkify-dl-center .vkify-card__head { cursor: move; touch-action: none; }
  .vkify-dl-center__grip { color: var(--vkui--color_icon_tertiary, #99a2ad); flex: 0 0 auto; }
  .vkify-dl-center__count { margin-left: auto; font-size: 11px; font-weight: 600; color: var(--vkui--color_text_secondary, #818c99); }
  .vkify-dl-center__clear {
    border: 0; background: transparent; cursor: pointer; padding: 2px 5px; border-radius: 6px;
    color: var(--vkui--color_text_secondary, #818c99); font-size: 14px; line-height: 1;
  }
  .vkify-dl-center__clear:hover { background: rgba(127,127,127,.14); }
  .vkify-dl-center__ic {
    flex: 0 0 auto; width: 16px; height: 16px;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700; line-height: 1;
  }
  .vkify-dl-center__ic.s-load::before {
    content: ''; width: 13px; height: 13px; border-radius: 50%;
    border: 2px solid rgba(127,127,127,.3); border-top-color: var(--vkui--color_text_accent, #2688eb);
    animation: vkify-dlc-spin .7s linear infinite;
  }
  .vkify-dl-center__ic.s-done { color: #4bb34b; }
  .vkify-dl-center__ic.s-err  { color: #e64646; }
  .vkify-dl-center__cancel {
    flex: 0 0 auto; border: 0; background: transparent; cursor: pointer;
    padding: 2px 5px; border-radius: 6px; line-height: 1; font-size: 13px;
    color: var(--vkui--color_text_secondary, #818c99);
  }
  .vkify-dl-center__cancel:hover { background: rgba(127,127,127,.14); color: #e64646; }
  .vkify-dl-center__bar {
    height: 4px; margin-top: 5px; border-radius: 2px;
    background: rgba(127,127,127,.16); overflow: hidden;
  }
  .vkify-dl-center__fill {
    height: 100%; width: 0%; border-radius: inherit;
    background: linear-gradient(90deg, #0077ff, #4c9aff);
    transition: width .2s ease;
  }
`;

/** Внедряет стили центра (идемпотентно); тянет за собой общие стили карточки. */
export function ensureDlCenterStyles(): void {
  ensureCardStyles();
  if (document.getElementById(DL_CENTER_CSS_ID)) return;
  const s = document.createElement('style');
  s.id = DL_CENTER_CSS_ID;
  s.textContent = DL_CENTER_CSS;
  document.head.appendChild(s);
}

/** Удаляет стили центра (для тестов/жёсткой очистки). */
export function removeDlCenterStyles(): void {
  document.getElementById(DL_CENTER_CSS_ID)?.remove();
}
