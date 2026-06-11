/** CSS кнопки скачивания трека и инлайн-статуса. */

import { STYLES_ID } from './constants.js';

export function ensureStyles(): void {
  if (document.getElementById(STYLES_ID)) return;
  const s = document.createElement('style');
  s.id = STYLES_ID;
  s.textContent = `
    /* ── Кнопка: повторяет структуру нативных VK audio_row__action ── */
    .vkify-dl-btn .audio_row__icon {
      position: relative;
      width: 20px; height: 20px;
    }
    /* Основная иконка ⬇ — в потоке, задаёт размеры бокса */
    .vkify-dl-ic-dl {
      display: flex; align-items: center; justify-content: center;
      width: 20px; height: 20px;
    }
    .vkify-dl-ic-dl svg { display: block; }
    /* Оверлеи (спиннер/✓/✗) — поверх, абсолютно, по центру 20×20 */
    .vkify-dl-ic-spin, .vkify-dl-ic-ok, .vkify-dl-ic-err {
      display: none;
      position: absolute; top: 0; left: 0;
      width: 20px; height: 20px;
      align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700; line-height: 1;
    }

    @keyframes vkify-spin {
      to { transform: rotate(360deg); }
    }
    .vkify-dl-ic-spin::before {
      content: ''; display: block;
      width: 14px; height: 14px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: vkify-spin .7s linear infinite;
    }

    /* Переключение состояний по классу на кнопке */
    .vkify-dl-btn.is-loading .vkify-dl-ic-dl,
    .vkify-dl-btn.is-done    .vkify-dl-ic-dl,
    .vkify-dl-btn.is-error   .vkify-dl-ic-dl { visibility: hidden; }
    .vkify-dl-btn.is-loading { color: var(--vkui--color_text_accent, #2688eb) !important; }
    .vkify-dl-btn.is-loading .vkify-dl-ic-spin { display: flex; }
    .vkify-dl-btn.is-done    { color: #4bb34b !important; }
    .vkify-dl-btn.is-done    .vkify-dl-ic-ok  { display: flex; }
    .vkify-dl-btn.is-error   { color: #e64646 !important; }
    .vkify-dl-btn.is-error   .vkify-dl-ic-err { display: flex; }

    /* ── Инлайн-статус — внутри элемента длительности, рядом со временем ──
       Наследует visibility от ._audio_row__duration: VK сам прячет время и
       показывает кнопки при наведении и возвращает время при уходе курсора. */
    .vkify-dl-status {
      display: none;
      align-items: center; gap: 4px;
      margin-left: 8px; max-width: 220px;
      font-size: 11px; font-weight: 500;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      vertical-align: middle;
      color: var(--vkui--color_text_secondary, #818c99);
    }
    .vkify-dl-status.is-visible { display: inline-flex; }
    .vkify-dl-status-dot {
      flex: 0 0 auto;
      width: 6px; height: 6px; border-radius: 50%;
      background: currentColor;
    }
    .vkify-dl-status.s-load { color: var(--vkui--color_text_accent, #2688eb); }
    .vkify-dl-status.s-load .vkify-dl-status-dot { animation: vkify-pulse 1s ease-in-out infinite; }
    .vkify-dl-status.s-done { color: #4bb34b; }
    .vkify-dl-status.s-err  { color: #e64646; }
    .vkify-dl-status-text { overflow: hidden; text-overflow: ellipsis; }
    @keyframes vkify-pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
  `;
  document.head.appendChild(s);
}
