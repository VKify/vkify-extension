/** CSS кнопки экспорта и меню форматов (прогресс — в общем центре загрузок). */

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

  .vkify-pdf-selector { display: none; }
  .vkify-pdf-selection-active .ConvoHistory__messageBlock {
    position: relative;
    padding-left: 38px;
    box-sizing: border-box;
  }
  .vkify-pdf-selection-active .vkify-pdf-selector {
    position: absolute;
    left: 10px;
    top: 50%;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: translateY(-50%);
    cursor: pointer;
  }
  .vkify-pdf-selector input {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--vkui--color_background_accent, #2688eb);
    cursor: pointer;
  }
  .vkify-pdf-selection-active .vkify-pdf-message-selected {
    background: rgba(38, 136, 235, 0.09);
    border-radius: 10px;
  }
  #vkify-pdf-selection-bar {
    position: fixed;
    left: 50%;
    bottom: 24px;
    z-index: 2147483645;
    display: flex;
    align-items: center;
    gap: 18px;
    min-width: 330px;
    padding: 10px 12px 10px 16px;
    border: 1px solid rgba(0,0,0,.1);
    border-radius: 14px;
    background: var(--vkui--color_background_content, #fff);
    color: var(--vkui--color_text_primary, #2c2d2e);
    box-shadow: 0 8px 30px rgba(0,0,0,.22);
    font: 13px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    transform: translateX(-50%);
  }
  .vkify-pdf-selection-count { flex: 1; font-weight: 600; white-space: nowrap; }
  .vkify-pdf-selection-actions { display: flex; gap: 7px; }
  .vkify-pdf-selection-actions button {
    border: 0;
    border-radius: 8px;
    padding: 8px 11px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .vkify-pdf-selection-cancel {
    background: var(--vkui--color_background_secondary, #f0f2f5);
    color: var(--vkui--color_text_primary, #2c2d2e);
  }
  .vkify-pdf-selection-export { background: #2688eb; color: #fff; }
  .vkify-pdf-selection-export:disabled { opacity: .48; cursor: default; }
`;
