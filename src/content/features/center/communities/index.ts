import type { FeatureManager } from '@/content/core/feature-manager.js';
import { swapCommunitiesColumnsFeature } from './swap-columns.js';
import { myGroupsRedirectFeature } from './my-groups-redirect.js';
import { createGlobalScrollFeature, disableMessageHoverFeature } from './discussions/reading.js';

/**
 * Фичи страницы сообщества — соответствуют странице «Сообщества» хаба «Центр» в
 * попапе: раскладка, переход к своим группам и чтение обсуждений.
 * Новая фича сообщества = новый файл + регистрация здесь.
 */
export function registerCommunitiesFeatures(manager: FeatureManager): void {
  manager.registerDefinitions([createGlobalScrollFeature(manager), disableMessageHoverFeature]);
  manager.registerDefinition(swapCommunitiesColumnsFeature);
  manager.registerDefinition(myGroupsRedirectFeature);
}