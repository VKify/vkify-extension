import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Размытие страницы при потере фокуса */
export const blurOnUnfocusFeature: FeatureDefinition = cssFeature({
  id: 'blur_on_unfocus',
  name: 'Размытие при потере фокуса',
  category: 'privacy',
  cssFiles: 'privacy/blur-on-unfocus.css',
});
