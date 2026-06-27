import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Скрывает рекламу в разделе «Музыка» — чистый CSS (hide-audio-ads.css). */
export const hideAudioAdsFeature: FeatureDefinition = cssFeature({
  id: 'hide_audio_ads',
  name: 'Скрыть аудиорекламу',
  category: 'hiding',
  cssFiles: 'hiding/music/hide-audio-ads.css',
});
