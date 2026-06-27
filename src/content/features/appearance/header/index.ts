import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Сворачивание поиска в шапке VK — чистый CSS (header.css), маркер на <html>. */
export const headerFeatures: readonly FeatureDefinition[] = [
  cssFeature({
    id: 'collapse_search',
    name: 'Свернуть поиск',
    category: 'appearance',
    cssFiles: 'appearance/header/header.css',
  }),
];
