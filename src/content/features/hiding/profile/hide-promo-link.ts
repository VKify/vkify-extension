import type { FeatureManager } from '@/content/core/feature-manager.js';

/** Скрывает промо-блок мини-приложения на профиле (CSS — hide-promo-link.css). */
export function registerHidePromoLinkFeature(manager: FeatureManager): void {
  manager.register('hide_promo_link', {
    enable: () => manager.enableCss('hide_promo_link'),
    disable: () => manager.disableCss('hide_promo_link'),
  });
}
