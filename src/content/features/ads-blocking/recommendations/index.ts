import { cssPlugin, handlerFeature } from '@/content/core/features/index.js';
import { ADS_CONTENT_SETTINGS } from '@/shared/constants/ads-content.js';
import type { SharedContext } from '../shared.js';
import { createRecommendationTracker, type RecommendationSection } from './tracker.js';

const SECTIONS = ['feed', 'games', 'market', 'calls', 'profile', 'messenger', 'music', 'video', 'communities', 'yandex-browser'] as const;

export function createRecommendationFeatures(shared: SharedContext) {
  const tracker = createRecommendationTracker(shared);
  return ADS_CONTENT_SETTINGS.map((id, index) => handlerFeature({
    id,
    name: `Реклама и рекомендации: ${SECTIONS[index]}`,
    category: 'ads',
    enabledByDefault: true,
    cssFiles: [`ads-blocking/recommendations/${SECTIONS[index]}.css`],
    plugins: [cssPlugin([`ads-blocking/recommendations/${SECTIONS[index]}.css`])],
    handler: {
      enable: () => tracker.enable(id as RecommendationSection),
      disable: () => tracker.disable(id as RecommendationSection),
    },
  }))
  .filter(feature => !['block_music_ads', 'block_recommendations_video'].includes(feature.id));
}
