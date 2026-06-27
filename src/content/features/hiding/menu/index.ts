import type { FeatureManager } from '@/content/core/feature-manager.js';
import { hideMenuSettingsFeature } from './hide-menu-settings.js';
import { hideMenuCountersFeature } from './hide-menu-counters.js';

/** Элементы левого меню — страница «Меню» хаба «Скрытие». */
export function registerMenuHiding(manager: FeatureManager): void {
  manager.registerDefinitions([hideMenuSettingsFeature, hideMenuCountersFeature]);
}
