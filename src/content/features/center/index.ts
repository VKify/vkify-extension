import type { FeatureManager } from '../../core/feature-manager.js';
import { registerMessagesFeatures } from './messages/index.js';
import { registerPlayerFeatures } from './player/index.js';
import { registerFeedFeatures } from './feed/index.js';

/**
 * Фичи хаба «Центр» — зеркалит структуру одноимённой вкладки попапа:
 * каждая подпапка соответствует странице хаба (messages → «Мессенджер»,
 * player → «Плеер», feed → «Лента»). Новая страница хаба = новая подпапка +
 * регистрация здесь.
 */
export function registerCenterFeatures(manager: FeatureManager): void {
  registerMessagesFeatures(manager);
  registerPlayerFeatures(manager);
  registerFeedFeatures(manager);
}
