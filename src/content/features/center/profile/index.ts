import type { FeatureManager } from '@/content/core/feature-manager.js';
import { swapProfileColumnsFeature } from './swap-columns.js';

/**
 * Фичи страницы профиля — соответствуют странице «Профиль» хаба «Центр» в
 * попапе. Пока единственная фича переставляет колонки профиля местами (чистый
 * CSS-плагин, без observer'ов). Новая фича профиля = новый файл + регистрация здесь.
 */
export function registerProfileFeatures(manager: FeatureManager): void {
  manager.registerDefinition(swapProfileColumnsFeature);
}