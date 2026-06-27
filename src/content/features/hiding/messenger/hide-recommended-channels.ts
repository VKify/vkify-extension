import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Скрывает рекомендуемые каналы в мессенджере — чистый CSS (hide-recommended-channels.css). */
export const hideRecommendedChannelsFeature: FeatureDefinition = cssFeature({
  id: 'hide_recommended_channels',
  name: 'Скрыть рекомендованные каналы',
  category: 'hiding',
  cssFiles: 'hiding/messenger/hide-recommended-channels.css',
});
