import type { FeatureManager } from '../../core/feature-manager.js';
import { registerMessagesFeatures } from './messages/index.js';
import { registerPlayerFeatures } from './player/index.js';

/**
 * Фичи хаба «Центр» — зеркалит структуру одноимённой вкладки попапа:
 * каждая подпапка соответствует странице хаба (messages → «Сообщения»,
 * player → «Плеер»). Новая страница хаба = новая подпапка + регистрация здесь.
 */
export function registerCenterFeatures(manager: FeatureManager): void {
  registerMessagesFeatures(manager);
  registerPlayerFeatures(manager);
}
