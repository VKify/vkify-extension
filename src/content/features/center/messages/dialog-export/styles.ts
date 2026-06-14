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
`;
