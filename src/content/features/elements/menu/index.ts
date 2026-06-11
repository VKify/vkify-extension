import type { FeatureManager } from '../../../core/feature-manager.js';
import { registerHideMenuSettingsFeature } from './hide-menu-settings.js';
import { registerHideMenuCountersFeature } from './hide-menu-counters.js';

/** Элементы левого меню — страница «Меню» хаба «Элементы». */
export function registerMenuElements(manager: FeatureManager): void {
  registerHideMenuSettingsFeature(manager);
  registerHideMenuCountersFeature(manager);
}
