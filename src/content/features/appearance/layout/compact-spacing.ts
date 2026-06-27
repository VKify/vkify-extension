import { cssPlugin, type FeatureDefinition } from '@/content/core/features/index.js';

/**
 * Компактный режим — убирает отступы и скругления между блоками VK.
 *
 * Эталонный пример ЯВНОЙ плагинной фичи (см. feature-plugin.ts): поведение —
 * единственный `cssPlugin`, который ставит/снимает маркер data-vkify-compact_spacing.
 * Никакого init/destroy и никакой магии в ядре. Эквивалентно вызову
 * `cssFeature({...})`, но показывает, как фича собирается из плагинов вручную.
 */
export const compactSpacingFeature: FeatureDefinition = {
  id: 'compact_spacing',
  name: 'Компактные отступы',
  category: 'appearance',
  impact: 'light',
  phase: 'early-css',
  initOrder: 10,
  cssFiles: ['appearance/layout/compact-spacing.css'],
  settingsKeys: ['compact_spacing'],
  plugins: [cssPlugin(['appearance/layout/compact-spacing.css'])],
};
