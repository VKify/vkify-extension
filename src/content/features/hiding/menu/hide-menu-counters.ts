import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Скрывает счётчики у пунктов левого меню — чистый CSS (hide-menu-counters.css). */
export const hideMenuCountersFeature: FeatureDefinition = cssFeature({
  id: 'hide_menu_counters',
  name: 'Скрыть счётчики меню',
  category: 'hiding',
  cssFiles: 'hiding/menu/hide-menu-counters.css',
});
