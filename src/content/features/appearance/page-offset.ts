import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';

// Slider range: 0 – 100
//   0   = maximum shift left   (content left edge → viewport left edge)
//   50  = center               (0 px, no CSS injected)
//   100 = maximum shift right  (content right edge → viewport right edge)
//
// Смещение считается ОТ СВОБОДНОЙ ШИРИНЫ окна, а не фиксированными пикселями:
//   shift = fraction · (100vw − contentWidth) / 2,  fraction = (slider−50)/50 ∈ [−1, 1]
// Так контент никогда не уезжает за край монитора (на ±1 его край ровно
// упирается в край окна), а результат не зависит от размера экрана: конфиг,
// сохранённый на ноутбуке «у самого края», на большом мониторе тоже встанет
// у края (vw берётся от ТЕКУЩЕГО окна). Свободная ширина берётся из
// `--vkify-cw` (ширину контента ставит widescreen.ts); если ширина контента
// не настроена — из измеренной ширины колонки страницы.

const CSS_ID = 'page_offset';
const CW_VAR = '--vkify-cw';
// Запасная ширина контента, если измерить не удалось (px).
const FALLBACK_CONTENT_WIDTH = 1000;

export function createPageOffsetFeature(manager: FeatureManager): FeatureMap {
  let isEnabled   = false;
  let sliderValue = 50;

  // Реальная ширина дефолтной раскладки VK (не зависит от монитора). Нужна как
  // запасное значение, когда «Ширина контента» выключена и `--vkify-cw` не задан.
  function measureDefaultWidth(): number {
    const layout = document.getElementById('page_layout');
    const w = layout?.offsetWidth ?? 0;
    return w > 200 ? w : FALLBACK_CONTENT_WIDTH;
  }

  function apply(): void {
    manager.removeCSS(CSS_ID);
    if (!isEnabled || sliderValue === 50) return;

    const fraction = (sliderValue - 50) / 50; // −1 … +1
    if (fraction === 0) return;

    const fallbackW = measureDefaultWidth();

    manager.injectCSS(CSS_ID, `
      :root {
        --vkify-page-shift: calc(${fraction} * max(0px, (100vw - var(${CW_VAR}, ${fallbackW}px))) / 2);
      }
      #page_header, #page_layout, #footer_wrap {
        transform: translateX(var(--vkify-page-shift)) !important;
      }
    `);
  }

  return {
    page_offset_enabled: {
      reapplyOnNavigate: true,

      enable: async () => {
        isEnabled = true;
        // Читаем актуальное значение слайдера из кэша хранилища.
        // Это нужно на случай, если page_offset_enabled инициализируется
        // раньше page_offset_value в цикле init() и sliderValue ещё = 50.
        const stored = await manager.getSetting<number>('page_offset_value');
        if (typeof stored === 'number') sliderValue = stored;
        apply();
      },

      disable: () => {
        isEnabled = false;
        manager.removeCSS(CSS_ID);
      },
    },

    page_offset_value: {
      enable: (value?: unknown) => {
        if (typeof value === 'number') sliderValue = value;
        apply();
      },
      disable: () => {
        sliderValue = 0;
        apply();
      },
    },
  };
}
