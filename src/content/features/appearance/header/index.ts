import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Настройки шапки VK — чистый CSS, маркеры на <html>. */
export const headerFeatures: readonly FeatureDefinition[] = [
  cssFeature({
    id: 'static_header',
    name: 'Статичная шапка',
    category: 'appearance',
    cssFiles: 'appearance/header/static-header.css',
  }),
  cssFeature({
    id: 'collapse_search',
    name: 'Свернуть поиск',
    category: 'appearance',
    cssFiles: 'appearance/header/header.css',
  }),
];
