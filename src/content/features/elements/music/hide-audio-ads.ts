import type { FeatureManager } from '../../../core/feature-manager.js';

/** Скрывает рекламу в разделе «Музыка» (CSS — hide-audio-ads.css). */
export function registerHideAudioAdsFeature(manager: FeatureManager): void {
  manager.register('hide_audio_ads', {
    enable: () => manager.enableCss('hide_audio_ads'),
    disable: () => manager.disableCss('hide_audio_ads'),
  });
}
