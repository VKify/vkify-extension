/** CSS кнопки экспорта, меню форматов и прогресс-оверлея. */

import { ROOT_ID } from './constants.js';

export const STYLE_CSS = `
  .vkify-export-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: none;
    background: transparent;
    border-radius: 8px;
    cursor: pointer;
    color: var(--vkui--color_icon_secondary, #818c99);
    transition: background 0.12s ease, color 0.12s ease;
  }
  .vkify-export-btn:hover {
    background: var(--vkui--color_background_secondary_alpha, rgba(0,0,0,0.06));
    color: var(--vkui--color_icon_primary, #2c2d2e);
  }
  .vkify-export-btn svg { width: 22px; height: 22px; pointer-events: none; }

  /* Меню форматов и прогресс — единая карточка VKify (ui/floating-card.ts). */
  .vkify-export-menu { width: 280px; animation: vkify-card-drop .18s ease-out; }
  .vkify-export-menu .vkify-fmt {
    flex-shrink: 0;
    min-width: 42px; text-align: center;
    font-size: 10px; font-weight: 700;
    padding: 3px 6px; border-radius: 6px;
    background: rgba(38,136,235,0.12);
    color: var(--vkui--color_text_accent, #2688eb);
    letter-spacing: 0.04em;
  }

  #${ROOT_ID} {
    position: fixed; inset: 0;
    z-index: 2147483647;
    background: rgba(0,0,0,0.55);
    display: flex; align-items: center; justify-content: center;
  }
  #${ROOT_ID} .vkify-export-progress { position: static; width: 320px; }
  #${ROOT_ID} .vkify-export-progress .vkify-card__list { padding: 12px 14px; gap: 0; }
  .vkify-export-sub {
    font-size: 12px; color: var(--vkui--color_text_secondary, #818c99);
    margin-bottom: 12px;
  }
  .vkify-export-bar {
    height: 6px;
    background: rgba(127,127,127,.16);
    border-radius: 3px;
    overflow: hidden;
  }
  .vkify-export-fill {
    height: 100%;
    background: linear-gradient(90deg, #0077ff, #4c9aff);
    width: 0%;
    transition: width 0.2s ease;
  }
  .vkify-export-actions {
    margin-top: 12px;
    display: flex; justify-content: flex-end;
  }
  button.vkify-export-cancel {
    background: transparent;
    border: none;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 13px; font-family: inherit;
    color: inherit;
    cursor: pointer;
    opacity: 0.7;
  }
  button.vkify-export-cancel:hover { background: rgba(127,127,127,.14); opacity: 1; }
`;
