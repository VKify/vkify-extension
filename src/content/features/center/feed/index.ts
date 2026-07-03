import type { FeatureManager } from '@/content/core/feature-manager.js';
import { handlerFeature } from '@/content/core/features/index.js';
import { expandPostTextFeature } from './expand-post-text.js';
import { createStoryDownloadFeature } from '../story/index.js';

/**
 * Фичи ленты — страница «Лента» хаба «Центр» в попапе. Помимо поведения постов
 * сюда же отнесено скачивание историй: они живут в самом верху ленты.
 */
export function registerFeedFeatures(manager: FeatureManager): void {
  manager.registerDefinition(expandPostTextFeature); // декларативная (метадата в expand-post-text.ts)

  const story = createStoryDownloadFeature(manager);
  manager.registerDefinition(handlerFeature({
    id: 'story_download',
    name: 'Скачивание историй', category: 'media', impact: 'medium',
    requiresDomLayer: true, tags: ['download', 'story'],
    handler: story.story_download,
  }));
}
