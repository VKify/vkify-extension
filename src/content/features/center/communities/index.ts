import type { FeatureManager } from '@/content/core/feature-manager.js';
import { swapCommunitiesColumnsFeature } from './swap-columns.js';
import { myGroupsRedirectFeature } from './my-groups-redirect.js';

/**
 * Фичи страницы сообщества — соответствуют странице «Сообщества» хаба «Центр» в
 * попапе. Пока единственная фича переставляет колонки сообщества местами (чистый
 * CSS-плагин, без observer'ов). Новая фича сообщества = новый файл + регистрация здесь.
 */
export function registerCommunitiesFeatures(manager: FeatureManager): void {
  manager.registerDefinition(swapCommunitiesColumnsFeature);
  manager.registerDefinition(myGroupsRedirectFeature);
}