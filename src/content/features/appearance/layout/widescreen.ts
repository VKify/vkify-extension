import { derivedCssFeature } from '@/content/core/features/index.js';
import type { FeatureDefinition } from '@/content/core/features/index.js';

/**
 * Ширина контента VK:
 *   • `content_width_enabled` — boolean-тоггл (id фичи);
 *   • `content_width`         — числовое значение в px (watch-ключ).
 *
 * Декларативная derived-CSS-фича: compute отдаёт `--vkify-cw`, механику
 * (маркер, rAF-коалесинг, дебаунс персиста, teardown) обеспечивает
 * derivedCssPlugin. Colocated-правила (widescreen.css) гейтятся историческим
 * маркером `data-vkify-content_width` — он задан явно через `marker`.
 *
 * Ширину ограничиваем шириной окна (`min(Vpx, 100vw)`), чтобы на маленьком
 * мониторе/ноутбуке контент не вылезал за край и не появлялся гориз. скролл.
 */
export const widescreenFeature: FeatureDefinition = derivedCssFeature({
  id: 'content_width_enabled',
  name: 'Ширина контента',
  category: 'appearance',
  watch: ['content_width'],
  marker: 'content_width',
  reapplyOnNavigate: true,
  // Live-preview слайдера (ENABLE_FEATURE с числом) — без кадра-сброса.
  reapplyOnUpdate: true,
  cssFiles: 'appearance/layout/widescreen.css',
  compute: (settings) => {
    const width = Number(settings['content_width']) || 0;
    if (width <= 0) return null; // слайдер в нуле — визуально выключено
    return { vars: { '--vkify-cw': `min(${width}px, 100vw)` } };
  },
});
