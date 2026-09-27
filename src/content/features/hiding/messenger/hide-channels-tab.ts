import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Скрывает вкладку «Каналы» в списке папок мессенджера. */
export const hideChannelsTabFeature: FeatureDefinition = cssFeature({
  id: 'hide_channels_tab',
  name: 'Скрыть вкладку «Каналы»',
  category: 'hiding',
  cssFiles: 'hiding/messenger/hide-channels-tab.css',
});
