import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Скрывает промо-блок мини-приложения на профиле — чистый CSS (hide-promo-link.css). */
export const hidePromoLinkFeature: FeatureDefinition = cssFeature({
  id: 'hide_promo_link',
  name: 'Скрыть промо-ссылку',
  category: 'hiding',
  cssFiles: 'hiding/profile/hide-promo-link.css',
});
