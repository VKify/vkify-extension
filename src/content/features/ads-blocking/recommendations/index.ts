import { cssFeature } from '@/content/core/features/index.js';
import { ADS_CONTENT_SETTINGS } from '@/shared/constants/ads-content.js';

const SECTIONS = ['feed', 'games', 'market', 'calls', 'profile', 'messenger', 'music', 'communities', 'yandex-browser'] as const;

export const recommendationFeatures = ADS_CONTENT_SETTINGS
  .map((id, index) => cssFeature({
    id,
    name: `Реклама и рекомендации: ${SECTIONS[index]}`,
    category: 'ads',
    enabledByDefault: true,
    cssFiles: `ads-blocking/recommendations/${SECTIONS[index]}.css`,
  }))
  .filter(feature => feature.id !== 'block_music_ads');
