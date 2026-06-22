import type { FeatureManager } from '@/content/core/feature-manager.js';
import { registerHideRecentGroupsFeature } from './hide-recent-groups.js';

/** Элементы раздела «Сообщества» — страница «Сообщества» хаба «Элементы». */
export function registerCommunitiesElements(manager: FeatureManager): void {
  registerHideRecentGroupsFeature(manager);
}
