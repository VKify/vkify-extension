import { derivedCssFeature } from '@/content/core/features/index.js';
import type { FeatureDefinition } from '@/content/core/features/index.js';

const CW_VAR = '--vkify-cw';
const SHIFT_VAR = '--vkify-page-shift';

const FALLBACK_CONTENT_WIDTH = 1000;

/**
 * Реальная ширина дефолтной раскладки VK (не зависит от монитора). Нужна как
 * запасное значение, когда «Ширина контента» выключена и `--vkify-cw` не задан.
 * DOM-чтение — допустимо внутри compute (записи делает derivedCssPlugin).
 */
function measureDefaultWidth(): number {
  const layout = document.getElementById('page_layout');
  const w = layout?.offsetWidth ?? 0;
  return w > 200 ? w : FALLBACK_CONTENT_WIDTH;
}

/**
 * Горизонтальное смещение страницы:
 *   • `page_offset_enabled` — boolean-тоггл (id фичи);
 *   • `page_offset_value`   — слайдер 0–100 (watch-ключ; 50 = по центру).
 *
 * Декларативная derived-CSS-фича: compute отдаёт `--vkify-page-shift`
 * относительно свободного места (100vw − ширина контента), механику — общий
 * derivedCssPlugin. Colocated-правила гейтятся маркером `data-vkify-page_offset`.
 */
/** Shared calculation for manual offset and temporary lyrics layouts. */
export function pageOffsetShift(slider: number): string {
  const fraction = (Math.max(0, Math.min(100, slider)) - 50) / 50;
  return `calc(${fraction} * max(0px, (100vw - var(${CW_VAR}, ${measureDefaultWidth()}px))) / 2)`;
}

export const pageOffsetFeature: FeatureDefinition = derivedCssFeature({
  id: 'page_offset_enabled',
  name: 'Смещение страницы',
  category: 'appearance',
  watch: ['page_offset_value'],
  marker: 'page_offset',
  reapplyOnNavigate: true,
  // Live-preview слайдера (ENABLE_FEATURE с числом) — без кадра-сброса.
  reapplyOnUpdate: true,
  cssFiles: 'appearance/layout/page-offset.css',
  compute: (settings) => {
    const raw = settings['page_offset_value'];
    const slider = typeof raw === 'number' ? raw : 50;
    if (slider === 50) return null; // по центру — визуально выключено

    return { vars: { [SHIFT_VAR]: pageOffsetShift(slider) } };
  },
});
