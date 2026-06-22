import type { FeatureManager } from '@/content/core/feature-manager.js';

/** Зеркальная раскладка панелей мессенджера (CSS — swap-panels.css). */
export function registerSwapMessengerPanelsFeature(manager: FeatureManager): void {
  manager.register('messenger_swap_panels', {
    enable: () => manager.enableCss('messenger_swap_panels'),
    disable: () => manager.disableCss('messenger_swap_panels'),
  });
}
