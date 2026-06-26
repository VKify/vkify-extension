import type { FeatureManager } from '@/content/core/feature-manager.js';
import { registerHideRecentGroupsFeature } from './hide-recent-groups.js';

/** Элементы раздела «Сообщества» — страница «Сообщества» хаба «Скрытие». */
export function registerCommunitiesHiding(manager: FeatureManager): void {
  registerHideRecentGroupsFeature(manager);
}
