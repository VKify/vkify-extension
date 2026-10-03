import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Скрывает предложение сделать профиль открытым и следующий за ним элемент. */
export const hideOpenProfileBlockFeature: FeatureDefinition = cssFeature({
  id: 'hide_open_profile_block',
  name: 'Скрыть «Сделать профиль открытым»',
  category: 'hiding',
  cssFiles: 'hiding/profile/hide-open-profile-block.css',
});
