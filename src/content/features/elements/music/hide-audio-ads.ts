import type { FeatureManager } from '../../../core/feature-manager.js';

/** Скрывает рекламные блоки и баннеры подписки в разделе «Музыка». */
export function registerHideAudioAdsFeature(manager: FeatureManager): void {
  manager.register('hide_audio_ads', {
    enable: () => {
      manager.injectCSS('hide_audio_ads', `
        .CatalogBlock:has(>.CatalogBlock__subscription a[href*="/vk_pay_music"]),
        .CatalogBlock:has(>.CatalogBlock__subscription_ru),
        .CatalogSection:has(.audio_promo) {
          display: none !important;
        }
      `);
    },
    disable: () => manager.removeCSS('hide_audio_ads'),
  });
}
