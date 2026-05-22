import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';

// Slider range: 0 – 100
//   0   = maximum shift left  (–MAX_OFFSET px)
//   50  = center              (0 px, no CSS injected)
//   100 = maximum shift right (+MAX_OFFSET px)

const CSS_ID     = 'page_offset';
const MAX_OFFSET = 600; // px

export function createPageOffsetFeature(manager: FeatureManager): FeatureMap {
  let isEnabled   = false;
  let sliderValue = 50;

  function apply(): void {
    manager.removeCSS(CSS_ID);
    if (!isEnabled || sliderValue === 50) return;

    // Map 0–100 → –MAX_OFFSET…+MAX_OFFSET
    const px = Math.round(((sliderValue - 50) / 50) * MAX_OFFSET);
    if (px === 0) return;

    manager.injectCSS(CSS_ID, `
      #page_header, #page_layout, #footer_wrap {
        transform: translateX(${px}px) !important;
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