import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Зеркальная раскладка панелей мессенджера — чистый CSS (swap-panels.css). */
export const swapMessengerPanelsFeature: FeatureDefinition = cssFeature({
  id: 'messenger_swap_panels',
  name: 'Зеркальные панели мессенджера',
  category: 'messages',
  cssFiles: 'center/messages/swap-panels.css',
});
