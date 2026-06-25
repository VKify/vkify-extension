import type { FeatureManager } from '@/content/core/feature-manager.js';
import { registerSwapProfileColumnsFeature } from './swap-columns.js';

/**
 * Фичи страницы профиля — соответствуют странице «Профиль» хаба «Центр» в
 * попапе. Пока единственная фича переставляет колонки профиля местами (чистый
 * CSS, без observer'ов). Новая фича профиля = новый файл + регистрация здесь.
 */
export function registerProfileFeatures(manager: FeatureManager): void {
  registerSwapProfileColumnsFeature(manager);

  manager.describeFeatures({
    profile_swap_columns: { name: 'Поменять колонки профиля местами', category: 'appearance', tags: ['profile', 'css'] },
  });
}
