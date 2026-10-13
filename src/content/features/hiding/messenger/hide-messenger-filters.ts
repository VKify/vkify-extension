import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

export const hideMessengerFiltersFeature: FeatureDefinition = cssFeature({
  id: 'hide_messenger_filters',
  name: 'Скрыть панель фильтров и папок',
  category: 'hiding',
  cssFiles: 'hiding/messenger/hide-messenger-filters.css',
});
