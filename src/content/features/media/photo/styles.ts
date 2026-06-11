/** CSS кнопок скачивания фото/альбома и inline-прогресс-бара. */

import { PV_BTN_ID, ALBUM_BTN_ID, STYLE_ID } from './constants.js';

export function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${PV_BTN_ID} { font-weight: 600; }
    #${PV_BTN_ID}[disabled],
    #${ALBUM_BTN_ID}[disabled] { opacity: 0.6; pointer-events: none; cursor: wait; }

    @keyframes vkify-album-pulse {
      0%   { transform: translateY(0);   opacity: 1; }
      50%  { transform: translateY(2px); opacity: 0.6; }
      100% { transform: translateY(0);   opacity: 1; }
    }
    #${ALBUM_BTN_ID}[disabled] svg { animation: vkify-album-pulse 1s ease-in-out infinite; }

    @keyframes vkify-pb-fadein {
      from { opacity: 0; transform: translateX(-4px); }
      to   { opacity: 1; transform: translateX(0);    }
    }
    .vkify-pb {
      display: inline-flex; align-items: center; gap: 8px;
      margin-left: 8px; vertical-align: middle;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      animation: vkify-pb-fadein 0.18s ease;
    }
    .vkify-pb-track {
      width: 100px; height: 4px; border-radius: 2px;
      background: rgba(120, 120, 120, 0.25); overflow: hidden; position: relative;
    }
    .vkify-pb-fill {
      height: 100%; width: 0%; border-radius: 2px;
      background: linear-gradient(90deg, #4caf50 0%, #66bb6a 100%);
      transition: width 0.25s ease;
    }
    .vkify-pb-fill.vkify-pb-done { background: linear-gradient(90deg, #4caf50 0%, #2e7d32 100%); }
    .vkify-pb-fill.vkify-pb-err  { background: linear-gradient(90deg, #ef5350 0%, #c62828 100%); }
    .vkify-pb-text {
      font-size: 11px; font-weight: 600; letter-spacing: 0.01em;
      color: var(--vkui--color_text_secondary, #707579);
      white-space: nowrap; min-width: 42px;
    }
  `;
  document.head.appendChild(style);
}
