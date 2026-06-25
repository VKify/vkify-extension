import type { FeatureManager } from '@/content/core/feature-manager.js';
import { registerSwapCommunitiesColumnsFeature } from './swap-columns.js';

/**
 * Фичи страницы сообщества — соответствуют странице «Сообщества» хаба «Центр» в
 * попапе. Пока единственная фича переставляет колонки сообщества местами (чистый
 * CSS, без observer'ов). Новая фича сообщества = новый файл + регистрация здесь.
 */
export function registerCommunitiesFeatures(manager: FeatureManager): void {
  registerSwapCommunitiesColumnsFeature(manager);

  manager.describeFeatures({
    communities_swap_columns: { name: 'Поменять колонки сообщества местами', category: 'appearance', tags: ['communities', 'css'] },
  });
}
