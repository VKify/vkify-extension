import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Скрывает кнопку прокрутки «Наверх» — чистый CSS (hide-scroll-top.css). */
export const hideScrollTopFeature: FeatureDefinition = cssFeature({
  id: 'hide_scroll_top',
  name: 'Скрыть кнопку «наверх»',
  category: 'hiding',
  cssFiles: 'hiding/global/hide-scroll-top.css',
});
