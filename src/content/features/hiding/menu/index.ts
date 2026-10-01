import type { FeatureManager } from '@/content/core/feature-manager.js';
import { hideMenuSettingsFeature } from './hide-menu-settings.js';
import { hideMenuCountersFeature } from './hide-menu-counters.js';
import { hideMenuItemsFeature } from './hide-menu-items.js';
import { menuItemsOrderFeature } from './menu-items-order.js';

/** Элементы левого меню — страница «Меню» хаба «Скрытие». */
export function registerMenuHiding(manager: FeatureManager): void {
  manager.registerDefinitions([hideMenuSettingsFeature, hideMenuCountersFeature, hideMenuItemsFeature, menuItemsOrderFeature]);
}
