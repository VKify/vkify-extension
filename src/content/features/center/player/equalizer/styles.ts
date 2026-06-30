/** Стили плавающей панели эквалайзера и кнопки в плеере (тёмная тема vkui-vars). */

export const EQ_STYLES_ID = 'vkify-eq-css';

const CSS = `
  .vkify-eq { padding: 12px 14px 14px; }

  /* Пресеты */
  .vkify-eq__presets {
    display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px;
  }
  .vkify-eq__preset {
    border: 1px solid rgba(127,127,127,.22); background: transparent;
    color: var(--vkui--color_text_secondary, #818c99);
    font-size: 11px; font-weight: 600; line-height: 1;
    padding: 6px 9px; border-radius: 8px; cursor: pointer;
    transition: background .12s, color .12s, border-color .12s;
    white-space: nowrap;
  }
  .vkify-eq__preset:hover { background: rgba(127,127,127,.12); }
  .vkify-eq__preset.is-active {
    background: var(--vkui--color_background_accent, #2688eb);
    border-color: transparent; color: #fff;
  }
  .vkify-eq__preset--custom { position: relative; padding-right: 22px; }
  .vkify-eq__preset-del {
    position: absolute; top: 50%; right: 5px; transform: translateY(-50%);
    width: 14px; height: 14px; border-radius: 50%; border: 0;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,.18); color: inherit; cursor: pointer;
    font-size: 11px; line-height: 1; padding: 0;
  }
  .vkify-eq__preset-del:hover { background: rgba(0,0,0,.34); }

  /* Полосы */
  .vkify-eq__sliders {
    display: flex; align-items: stretch; justify-content: space-between;
    gap: 4px;
  }
  .vkify-eq__band {
    display: flex; flex-direction: column; align-items: center;
    gap: 6px; flex: 1 1 0; min-width: 0;
  }
  .vkify-eq__band--pre {
    margin-right: 6px; padding-right: 8px;
    border-right: 1px solid rgba(127,127,127,.18);
  }
  .vkify-eq__val {
    font-size: 10px; font-weight: 700; line-height: 1;
    color: var(--vkui--color_text_primary, #19191a);
    font-variant-numeric: tabular-nums;
  }
  .vkify-eq__band--pre .vkify-eq__val,
  .vkify-eq__band--pre .vkify-eq__freq { color: var(--vkui--color_text_accent, #2688eb); }
  .vkify-eq__slider {
    /* Стандартизированный кросс-браузерный вертикальный range (Chrome 124+,
       Firefox 124+, Safari 17.4+); устаревшее appearance: slider-vertical
       убрано — вызывало депрекейшен-варнинг в Chromium. Для старых Firefox
       вертикаль дублируется атрибутом orient="vertical" (см. panel.ts). */
    writing-mode: vertical-lr; direction: rtl;
    width: 18px; height: 116px; margin: 0; cursor: pointer;
    accent-color: var(--vkui--color_background_accent, #2688eb);
  }
  .vkify-eq__freq {
    font-size: 9px; font-weight: 600; line-height: 1;
    color: var(--vkui--color_text_tertiary, #99a2ad);
    font-variant-numeric: tabular-nums;
  }

  /* Действия */
  .vkify-eq__actions {
    display: flex; gap: 8px; margin-top: 14px;
  }
  .vkify-eq__btn {
    flex: 1 1 0; border: 1px solid rgba(127,127,127,.22); background: transparent;
    color: var(--vkui--color_text_secondary, #818c99);
    font-size: 12px; font-weight: 600; line-height: 1;
    padding: 8px 10px; border-radius: 9px; cursor: pointer;
    transition: background .12s, color .12s;
  }
  .vkify-eq__btn:hover { background: rgba(127,127,127,.12); }
  .vkify-eq__btn--accent {
    background: var(--vkui--color_background_accent, #2688eb);
    border-color: transparent; color: #fff;
  }
  .vkify-eq__btn--accent:hover { filter: brightness(1.06); background: var(--vkui--color_background_accent, #2688eb); }

  /* Кнопка в плеере (наследует native-класс; маркер активного состояния) */
  [data-vkify-eq-btn].is-open { color: var(--vkui--color_background_accent, #2688eb); }

  /* Быстрый выбор пресета в шапке (виден и в свёрнутом баре) */
  .vkify-eq__aux-select {
    max-width: 130px; border: 1px solid rgba(127,127,127,.22);
    background: var(--vkui--color_background_modal, rgba(127,127,127,.08));
    color: var(--vkui--color_text_primary, #19191a);
    font-size: 11px; font-weight: 600; line-height: 1;
    padding: 3px 6px; border-radius: 7px; cursor: pointer;
    outline: none; appearance: auto;
  }
`;

export function ensureEqualizerStyles(): void {
  if (document.getElementById(EQ_STYLES_ID)) return;
  const s = document.createElement('style');
  s.id = EQ_STYLES_ID;
  s.textContent = CSS;
  (document.head ?? document.documentElement).appendChild(s);
}

export function removeEqualizerStyles(): void {
  document.getElementById(EQ_STYLES_ID)?.remove();
}
