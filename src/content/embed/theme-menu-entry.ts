import { installExtApi } from '@/shared/ext-api.js';
import { startThemeMenuObserver } from './theme-menu.js';

installExtApi();
const scope = globalThis as typeof globalThis & { __vkifyThemeMenuStarted?: boolean };
if (!scope.__vkifyThemeMenuStarted) {
  startThemeMenuObserver();
  scope.__vkifyThemeMenuStarted = true;
}
